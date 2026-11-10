const prisma = require('../prisma/client');
const {
    parseDateStart,
    parseDateEnd,
    dayBeforeDateStr,
    toDateStr,
    buildLedgerWithOpeningBalance,
    rowNet,
} = require('../utils/ledgerHelpers');

class SupplierService {
    async getAllSuppliers() {
        try {
            const suppliers = await prisma.supplier.findMany();
            return suppliers;
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            throw error;
        }
    }

    async createSupplier(data) {
        try {
            const supplier = await prisma.supplier.create({ data });
            return supplier;
        } catch (error) {
            console.error('Error creating supplier:', error);
            throw error;
        }
    }

    async updateSupplier(id, data) {
        try {
            const supplier = await prisma.supplier.update({
                where: { id },
                data
            });
            return supplier;
        } catch (error) {
            console.error('Error updating supplier:', error);
            throw error;
        }
    }

    async deleteSupplier(id) {
        try {
            await prisma.supplier.delete({ where: { id } });
        } catch (error) {
            console.error('Error deleting supplier:', error);
            throw error;
        }
    }

    formatSupplierPurchase(purchase) {
        return {
            date: purchase.date,
            particulars: `Purchase from ${purchase.supplier_name}`,
            voucherNo: purchase.purchase_no,
            debit: 0,
            credit: purchase.total,
            discount: 0,
            purchaseReturn: 0,
        };
    }

    formatSupplierPayment(payment) {
        // PaymentOut has no discount field; column kept for customer-report parity
        return {
            date: payment.payment_date,
            particulars: `Payment to ${payment.supplier?.name || 'Unknown'}`,
            voucherNo: '-',
            debit: payment.amount,
            credit: 0,
            discount: 0,
            purchaseReturn: 0,
        };
    }

    formatSupplierReturn(purchaseReturn) {
        const billDate = purchaseReturn.purchase?.date
            ? toDateStr(new Date(purchaseReturn.purchase.date))
            : null;
        const billNo = purchaseReturn.purchase?.purchase_no;
        let particulars = `Purchase return to ${purchaseReturn.supplier_name}`;
        if (billDate) {
            particulars += billNo
                ? ` (against bill ${billNo} dated ${billDate})`
                : ` (against bill dated ${billDate})`;
        }
        return {
            date: purchaseReturn.date,
            particulars,
            voucherNo: purchaseReturn.return_no,
            debit: 0,
            credit: 0,
            discount: 0,
            purchaseReturn: purchaseReturn.total,
        };
    }

    async fetchSupplierTransactions(supplierIds, fromDate, toDate) {
        const dateFilter = {
            gte: fromDate,
            lte: toDate,
        };

        const [purchases, payments, purchaseReturns] = await Promise.all([
            prisma.purchase.findMany({
                where: {
                    supplier_id: { in: supplierIds },
                    date: dateFilter,
                },
                include: { supplier: true },
                orderBy: { date: 'asc' },
            }),
            prisma.paymentOut.findMany({
                where: {
                    supplier_id: { in: supplierIds },
                    payment_date: dateFilter,
                },
                include: { supplier: true },
                orderBy: { payment_date: 'asc' },
            }),
            prisma.purchaseReturn.findMany({
                where: {
                    supplier_id: { in: supplierIds },
                    date: dateFilter,
                },
                include: { purchase: true },
                orderBy: { date: 'asc' },
            }),
        ]);

        return [
            ...purchases.map((purchase) => this.formatSupplierPurchase(purchase)),
            ...payments.map((payment) => this.formatSupplierPayment(payment)),
            ...purchaseReturns.map((purchaseReturn) => this.formatSupplierReturn(purchaseReturn)),
        ];
    }

    async getPurchasesAndPaymentsService(supplierIds, startDate, endDate) {
        try {
            const supplierIdsArray = supplierIds.split(',').filter(Boolean);
            const rangeStart = parseDateStart(startDate);
            const rangeEnd = parseDateEnd(endDate);

            const suppliers = supplierIdsArray.length > 0
                ? await prisma.supplier.findMany({ where: { id: { in: supplierIdsArray } } })
                : await prisma.supplier.findMany();

            if (suppliers.length === 0) {
                return {
                    transactions: [],
                    summary: {
                        openingBalance: 0,
                        closingBalance: 0,
                        totalDebit: 0,
                        totalCredit: 0,
                        totalDiscount: 0,
                        totalPurchaseReturn: 0,
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
                totalPurchaseReturn: 0,
            };

            for (const supplier of suppliers) {
                const supplierPeriodRows = await this.fetchSupplierTransactions(
                    [supplier.id],
                    rangeStart,
                    rangeEnd
                );

                let prePeriodRows = [];
                if (supplier.opening_balance_date) {
                    const obDate = new Date(supplier.opening_balance_date);
                    if (obDate < rangeStart) {
                        prePeriodRows = await this.fetchSupplierTransactions(
                            [supplier.id],
                            obDate,
                            dayBeforeDateStr(startDate)
                        );
                    }
                }

                const ledger = buildLedgerWithOpeningBalance({
                    partyName: supplier.name,
                    openingBalance: supplier.opening_balance,
                    openingBalanceDate: supplier.opening_balance_date,
                    startDate,
                    endDate,
                    periodRows: supplierPeriodRows,
                    prePeriodRows,
                    positiveBalanceSide: 'credit',
                });

                allRows.push(...ledger.rows);
                summaryTotals.openingBalance += ledger.summary.openingBalance;
                summaryTotals.closingBalance += ledger.summary.closingBalance;
                summaryTotals.totalDebit += ledger.summary.totalDebit;
                summaryTotals.totalCredit += ledger.summary.totalCredit;
                summaryTotals.totalDiscount += ledger.summary.totalDiscount || 0;
                summaryTotals.totalPurchaseReturn += ledger.summary.totalPurchaseReturn || 0;
            }

            const sortedRows = allRows.sort((a, b) => new Date(a.date) - new Date(b.date));
            let running = 0;
            const transactions = sortedRows.map((row, index) => {
                const discount = row.discount || 0;
                const purchaseReturn = row.purchaseReturn || 0;
                running += rowNet(row);
                return {
                    srno: index + 1,
                    date: row.date,
                    particulars: row.particulars,
                    voucherNo: row.voucherNo,
                    debit: row.debit,
                    credit: row.credit,
                    discount,
                    purchaseReturn,
                    balance: running,
                    isOpeningBalance: row.isOpeningBalance || false,
                    isBroughtForward: row.isBroughtForward || false,
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
            console.error('Error fetching purchases and payments:', error);
            throw error;
        }
    }
}

module.exports = new SupplierService();
