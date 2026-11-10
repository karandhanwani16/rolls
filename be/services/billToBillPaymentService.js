const prisma = require('../prisma/client');
const {
    allocateSaleOutstanding,
    attachSaleOutstanding,
} = require('../utils/saleOutstanding');

const customerPaymentFilter = {
    NOT: {
        payment_category: 'VATAV',
        entry_type: 'STANDALONE',
    },
};

class BillToBillPaymentService {
    async getCustomerBillPayments(customerId) {
        try {
            const billPayments = await prisma.billToBillPayment.findMany({
                where: { customer_id: customerId },
                include: {
                    details: {
                        include: {
                            sale: true
                        }
                    }
                },
                orderBy: {
                    bill_clear_date: 'desc'
                }
            });
            return billPayments;
        } catch (error) {
            console.error('Error fetching bill payments:', error);
            throw new Error(`Failed to fetch bill payments: ${error.message}`);
        }
    }

    async getReconciliationData(customerId) {
        try {
            // Get the latest bill payment record to determine cutoff date
            const latestBillPayment = await prisma.billToBillPayment.findFirst({
                where: { customer_id: customerId },
                orderBy: { bill_latest_clear_date: 'desc' }
            });

            const [customer, customerSales, customerReturns, allCustomerPayments] = await Promise.all([
                prisma.customer.findUnique({ where: { id: customerId } }),
                prisma.sale.findMany({
                    where: { customer_id: customerId },
                    orderBy: { date: 'asc' },
                }),
                prisma.saleReturn.findMany({
                    where: { customer_id: customerId },
                }),
                prisma.paymentIn.findMany({
                    where: {
                        actual_id: customerId,
                        ...customerPaymentFilter,
                    },
                    orderBy: { created_at: 'asc' },
                    include: {
                        sale: {
                            select: { id: true, sales_no: true },
                        },
                    },
                }),
            ]);

            // Settlement/reconciliation pool excludes full-bill payments linked to a sale.
            let paymentsIn = allCustomerPayments.filter((payment) => !payment.sale_id);

            let billOverflowAmount = 0;
            let startDate = new Date(0); // Default to beginning of time

            if (latestBillPayment) {
                billOverflowAmount = latestBillPayment.bill_overflow_amount;
                startDate = latestBillPayment.bill_latest_clear_date;

                // Filter to only include payments after the latest clear date
                paymentsIn = paymentsIn.filter(payment =>
                    new Date(payment.created_at) > new Date(startDate)
                );
            }

            const remainingById = allocateSaleOutstanding({
                sales: customerSales,
                payments: allCustomerPayments,
                saleReturns: customerReturns,
                customers: customer ? [customer] : [],
            });

            const billPaidSaleIds = new Set(
                allCustomerPayments
                    .filter((payment) => payment.sale_id)
                    .map((payment) => payment.sale_id)
            );

            const salesWithStatus = customerSales.map((sale) => {
                const enriched = attachSaleOutstanding(sale, remainingById.get(sale.id));
                const isBillPaid = billPaidSaleIds.has(sale.id);
                return {
                    id: sale.id,
                    sales_no: sale.sales_no,
                    date: sale.date,
                    total: sale.total,
                    credit_days: sale.credit_days || 0,
                    cleared_amount: enriched.cleared_amount,
                    remaining_amount: enriched.remaining_amount,
                    due_date: enriched.due_date,
                    overdue_days: enriched.overdue_days,
                    status: enriched.payment_status,
                    is_bill_paid: isBillPaid,
                    payment_source: isBillPaid ? 'BILL_PAYMENT' : 'SETTLEMENT',
                };
            });

            // Pool uses the same amount credited to the customer ledger:
            // NORMAL → actual/received; VATAV customer payment → gross received_amount
            const { customerCreditAmount } = require('./paymentInService');
            const totalPaymentAmount = paymentsIn.reduce(
                (total, payment) => total + customerCreditAmount(payment),
                0
            ) + billOverflowAmount;

            // Pending = outstanding on open bills (customer still owes).
            // Available = unsettled/unallocated payment pool (not yet settled via bill-to-bill).
            const pendingAmount = salesWithStatus.reduce(
                (total, sale) => total + (Number(sale.remaining_amount) || 0),
                0
            );

            return {
                customer_id: customerId,
                bill_overflow_amount: billOverflowAmount,
                last_clear_date: latestBillPayment?.bill_latest_clear_date || null,
                pending_amount: pendingAmount,
                available_amount: totalPaymentAmount,
                total_payment_amount: totalPaymentAmount,
                payments_in: paymentsIn,
                sales: salesWithStatus
            };
        } catch (error) {
            console.error('Error fetching reconciliation data:', error);
            throw new Error(`Failed to fetch reconciliation data: ${error.message}`);
        }
    }

    async processBillPayments(data) {
        const { customerId, sales } = data;

        try {
            return await prisma.$transaction(async(tx) => {
                // Get the current date
                const currentDate = new Date();

                // Calculate total payment amount from sales that will be cleared
                const totalClearedAmount = sales.reduce(
                    (total, sale) => total + parseFloat(sale.cleared_amount),
                    0
                );

                // Create new bill payment record
                const billPayment = await tx.billToBillPayment.create({
                    data: {
                        customer_id: customerId,
                        bill_clear_date: currentDate,
                        bill_latest_clear_date: currentDate,
                        bill_overflow_amount: data.overflow_amount || 0,
                        details: {
                            create: sales.filter(sale => parseFloat(sale.cleared_amount) > 0).map(sale => ({
                                sale_id: sale.id,
                                cleared_amount: parseFloat(sale.cleared_amount),
                                status: sale.status
                            }))
                        }
                    },
                    include: {
                        details: true
                    }
                });

                return billPayment;
            });
        } catch (error) {
            console.error('Error processing bill payments:', error);
            throw new Error(`Failed to process bill payments: ${error.message}`);
        }
    }
}

module.exports = new BillToBillPaymentService();
