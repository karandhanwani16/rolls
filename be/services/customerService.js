const prisma = require('../prisma/client');
const {
    parseDateStart,
    parseDateEnd,
    dayBeforeDateStr,
    toDateStr,
    buildLedgerWithOpeningBalance,
    rowNet,
} = require('../utils/ledgerHelpers');

class CustomerService {
    async getAllCustomers() {
        try {
            const customers = await prisma.customer.findMany();
            return customers;
        } catch (error) {
            console.error('Error fetching customers:', error);
            throw error;
        }
    }

    async createCustomer(data) {
        try {
            const customer = await prisma.customer.create({ data });
            return customer;
        } catch (error) {
            console.error('Error creating customer:', error);
            throw error;
        }
    }

    async updateCustomer(id, data) {
        try {
            const customer = await prisma.customer.update({
                where: { id },
                data
            });
            return customer;
        } catch (error) {
            console.error('Error updating customer:', error);
            throw error;
        }
    }

    async deleteCustomer(id) {
        try {
            await prisma.customer.delete({ where: { id } });
        } catch (error) {
            console.error('Error deleting customer:', error);
            throw error;
        }
    }

    formatCustomerSale(sale) {
        return {
            date: sale.date,
            particulars: `Sale to ${sale.customer_name}`,
            voucherNo: sale.sales_no,
            debit: sale.total,
            credit: 0,
            discount: 0,
            salesReturn: 0,
        };
    }

    formatCustomerPayment(payment) {
        const { customerCreditAmount, PAYMENT_CATEGORY } = require('./paymentInService');
        const isWatav = payment.payment_category === PAYMENT_CATEGORY.VATAV;
        // Settlement = received + discount; report splits discount into its own column
        const settlement = customerCreditAmount(payment);
        const discount = settlement > 0 ? (Number(payment.discount) || 0) : 0;
        const credit = settlement - discount;
        const particulars = isWatav
            ? `Watav payment from ${payment.actual_customer?.name || 'Unknown'}`
            : `Payment from ${payment.actual_customer?.name || 'Unknown'}`;
        return {
            date: payment.payment_date,
            particulars,
            voucherNo: '-',
            debit: 0,
            credit,
            discount,
            salesReturn: 0,
            paymentCategory: payment.payment_category || PAYMENT_CATEGORY.NORMAL,
            entryType: payment.entry_type || null,
        };
    }

    formatCustomerReturn(saleReturn) {
        const billDate = saleReturn.sale?.date
            ? toDateStr(new Date(saleReturn.sale.date))
            : null;
        const billNo = saleReturn.sale?.sales_no;
        let particulars = `Sales return from ${saleReturn.customer_name}`;
        if (billDate) {
            particulars += billNo
                ? ` (against bill ${billNo} dated ${billDate})`
                : ` (against bill dated ${billDate})`;
        }
        return {
            date: saleReturn.date,
            particulars,
            voucherNo: saleReturn.return_no,
            debit: 0,
            credit: 0,
            discount: 0,
            salesReturn: saleReturn.total,
        };
    }

    async fetchCustomerTransactions(customerIds, fromDate, toDate) {
        const dateFilter = {
            gte: fromDate,
            lte: toDate,
        };

        const [sales, payments, salesReturns] = await Promise.all([
            prisma.sale.findMany({
                where: {
                    customer_id: { in: customerIds },
                    date: dateFilter,
                },
                include: { customer: true },
                orderBy: { date: 'asc' },
            }),
            prisma.paymentIn.findMany({
                where: {
                    actual_id: { in: customerIds },
                    payment_date: dateFilter,
                    // Standalone watav entries have no actual_id; exclude any misfires
                    NOT: {
                        payment_category: 'VATAV',
                        entry_type: 'STANDALONE',
                    },
                },
                include: { actual_customer: true, receive_customer: true },
                orderBy: { payment_date: 'asc' },
            }),
            prisma.saleReturn.findMany({
                where: {
                    customer_id: { in: customerIds },
                    date: dateFilter,
                },
                include: { sale: true },
                orderBy: { date: 'asc' },
            }),
        ]);

        return [
            ...sales.map((sale) => this.formatCustomerSale(sale)),
            ...payments.map((payment) => this.formatCustomerPayment(payment)),
            ...salesReturns.map((saleReturn) => this.formatCustomerReturn(saleReturn)),
        ];
    }

    async getSalesAndPaymentsService(customerIds, startDate, endDate, customerType) {
        try {
            const customerIdsArray = customerIds.split(',').filter(Boolean);
            const rangeStart = parseDateStart(startDate);
            const rangeEnd = parseDateEnd(endDate);

            const customerWhere = customerIdsArray.length > 0
                ? { id: { in: customerIdsArray } }
                : customerType
                    ? { type: customerType }
                    : {};

            const customers = await prisma.customer.findMany({
                where: customerWhere,
            });

            if (customers.length === 0) {
                return {
                    transactions: [],
                    summary: {
                        openingBalance: 0,
                        closingBalance: 0,
                        totalDebit: 0,
                        totalCredit: 0,
                        totalDiscount: 0,
                        totalSalesReturn: 0,
                        normalPayments: 0,
                        vatavPayments: 0,
                        totalPayments: 0,
                    },
                };
            }

            const allRows = [];
            const summaryTotals = {
                openingBalance: 0,
                closingBalance: 0,
                totalDebit: 0,
                totalCredit: 0,
                totalDiscount: 0,
                totalSalesReturn: 0,
                normalPayments: 0,
                vatavPayments: 0,
                totalPayments: 0,
            };

            for (const customer of customers) {
                const customerPeriodRows = await this.fetchCustomerTransactions(
                    [customer.id],
                    rangeStart,
                    rangeEnd
                );

                for (const row of customerPeriodRows) {
                    const settlement = (row.credit || 0) + (row.discount || 0);
                    if (settlement > 0 && row.paymentCategory) {
                        if (row.paymentCategory === 'VATAV') {
                            summaryTotals.vatavPayments += settlement;
                        } else {
                            summaryTotals.normalPayments += settlement;
                        }
                        summaryTotals.totalPayments += settlement;
                    }
                }

                let prePeriodRows = [];
                if (customer.opening_balance_date) {
                    const obDate = new Date(customer.opening_balance_date);
                    if (obDate < rangeStart) {
                        prePeriodRows = await this.fetchCustomerTransactions(
                            [customer.id],
                            obDate,
                            dayBeforeDateStr(startDate)
                        );
                    }
                }

                const ledger = buildLedgerWithOpeningBalance({
                    partyName: customer.name,
                    openingBalance: customer.opening_balance,
                    openingBalanceDate: customer.opening_balance_date,
                    startDate,
                    endDate,
                    periodRows: customerPeriodRows,
                    prePeriodRows,
                    positiveBalanceSide: 'debit',
                });

                allRows.push(...ledger.rows);
                summaryTotals.openingBalance += ledger.summary.openingBalance;
                summaryTotals.closingBalance += ledger.summary.closingBalance;
                summaryTotals.totalDebit += ledger.summary.totalDebit;
                summaryTotals.totalCredit += ledger.summary.totalCredit;
                summaryTotals.totalDiscount += ledger.summary.totalDiscount || 0;
                summaryTotals.totalSalesReturn += ledger.summary.totalSalesReturn || 0;
            }

            const sortedRows = allRows.sort((a, b) => new Date(a.date) - new Date(b.date));
            let running = 0;
            const transactions = sortedRows.map((row, index) => {
                const discount = row.discount || 0;
                const salesReturn = row.salesReturn || 0;
                running += rowNet(row);
                return {
                    srno: index + 1,
                    date: row.date,
                    particulars: row.particulars,
                    voucherNo: row.voucherNo,
                    debit: row.debit,
                    credit: row.credit,
                    discount,
                    salesReturn,
                    balance: running,
                    isOpeningBalance: row.isOpeningBalance || false,
                    isBroughtForward: row.isBroughtForward || false,
                    paymentCategory: row.paymentCategory || null,
                    entryType: row.entryType || null,
                };
            });

            return {
                transactions,
                summary: {
                    ...summaryTotals,
                    closingBalance: transactions.length > 0
                        ? transactions[transactions.length - 1].balance
                        : summaryTotals.openingBalance,
                },
            };
        } catch (error) {
            console.error('Error fetching sales and payments:', error);
            throw error;
        }
    }
}

module.exports = new CustomerService();
