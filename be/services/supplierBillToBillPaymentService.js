const prisma = require('../prisma/client');
const {
    allocatePurchaseOutstanding,
    attachPurchaseOutstanding,
} = require('../utils/purchaseOutstanding');

class SupplierBillToBillPaymentService {
    async getSupplierBillPayments(supplierId) {
        try {
            return await prisma.supplierBillToBillPayment.findMany({
                where: { supplier_id: supplierId },
                include: {
                    details: {
                        include: {
                            purchase: true,
                        },
                    },
                },
                orderBy: {
                    bill_clear_date: 'desc',
                },
            });
        } catch (error) {
            console.error('Error fetching supplier bill payments:', error);
            throw new Error(`Failed to fetch supplier bill payments: ${error.message}`);
        }
    }

    async getReconciliationData(supplierId) {
        try {
            const latestBillPayment = await prisma.supplierBillToBillPayment.findFirst({
                where: { supplier_id: supplierId },
                orderBy: { bill_latest_clear_date: 'desc' },
            });

            const [supplier, supplierPurchases, supplierReturns, allSupplierPayments] =
                await Promise.all([
                    prisma.supplier.findUnique({ where: { id: supplierId } }),
                    prisma.purchase.findMany({
                        where: { supplier_id: supplierId },
                        orderBy: { date: 'asc' },
                    }),
                    prisma.purchaseReturn.findMany({
                        where: { supplier_id: supplierId },
                    }),
                    prisma.paymentOut.findMany({
                        where: { supplier_id: supplierId },
                        orderBy: { created_at: 'asc' },
                        include: {
                            purchase: {
                                select: { id: true, purchase_no: true },
                            },
                        },
                    }),
                ]);

            // Settlement/reconciliation pool excludes full-bill payments linked to a purchase.
            let paymentsOut = allSupplierPayments.filter((payment) => !payment.purchase_id);

            let billOverflowAmount = 0;
            let startDate = new Date(0);

            if (latestBillPayment) {
                billOverflowAmount = latestBillPayment.bill_overflow_amount;
                startDate = latestBillPayment.bill_latest_clear_date;
                paymentsOut = paymentsOut.filter(
                    (payment) => new Date(payment.created_at) > new Date(startDate)
                );
            }

            const remainingById = allocatePurchaseOutstanding({
                purchases: supplierPurchases,
                payments: allSupplierPayments,
                purchaseReturns: supplierReturns,
                suppliers: supplier ? [supplier] : [],
            });

            const billPaidPurchaseIds = new Set(
                allSupplierPayments
                    .filter((payment) => payment.purchase_id)
                    .map((payment) => payment.purchase_id)
            );

            const purchasesWithStatus = supplierPurchases.map((purchase) => {
                const enriched = attachPurchaseOutstanding(
                    purchase,
                    remainingById.get(purchase.id)
                );
                const isBillPaid = billPaidPurchaseIds.has(purchase.id);
                return {
                    id: purchase.id,
                    purchase_no: purchase.purchase_no,
                    date: purchase.date,
                    total: purchase.total,
                    credit_days: purchase.credit_days || 0,
                    cleared_amount: enriched.cleared_amount,
                    remaining_amount: enriched.remaining_amount,
                    due_date: enriched.due_date,
                    overdue_days: enriched.overdue_days,
                    status: enriched.payment_status,
                    is_bill_paid: isBillPaid,
                    payment_source: isBillPaid ? 'BILL_PAYMENT' : 'SETTLEMENT',
                };
            });

            const totalPaymentAmount =
                paymentsOut.reduce((total, payment) => total + (Number(payment.amount) || 0), 0) +
                billOverflowAmount;

            // Pending = outstanding on open bills (supplier still owed).
            // Available = unsettled/unallocated payment pool (not yet settled via bill-to-bill).
            const pendingAmount = purchasesWithStatus.reduce(
                (total, purchase) => total + (Number(purchase.remaining_amount) || 0),
                0
            );

            return {
                supplier_id: supplierId,
                bill_overflow_amount: billOverflowAmount,
                last_clear_date: latestBillPayment?.bill_latest_clear_date || null,
                pending_amount: pendingAmount,
                available_amount: totalPaymentAmount,
                total_payment_amount: totalPaymentAmount,
                payments_out: paymentsOut,
                purchases: purchasesWithStatus,
            };
        } catch (error) {
            console.error('Error fetching supplier reconciliation data:', error);
            throw new Error(`Failed to fetch supplier reconciliation data: ${error.message}`);
        }
    }

    async createSettlement(data) {
        const { supplierId, total_amount, overflow_amount, description, purchases } = data;

        try {
            return await prisma.$transaction(async (tx) => {
                const currentDate = new Date();
                const billPayment = await tx.supplierBillToBillPayment.create({
                    data: {
                        supplier_id: supplierId,
                        bill_clear_date: currentDate,
                        bill_latest_clear_date: currentDate,
                        bill_overflow_amount: overflow_amount || 0,
                        details: {
                            create: (purchases || [])
                                .filter((purchase) => parseFloat(purchase.cleared_amount) > 0)
                                .map((purchase) => ({
                                    purchase_id: purchase.id,
                                    cleared_amount: parseFloat(purchase.cleared_amount),
                                    status: purchase.status,
                                })),
                        },
                    },
                    include: {
                        details: true,
                    },
                });

                const settlement = await tx.supplierBillSettlement.create({
                    data: {
                        bill_payment_id: billPayment.id,
                        settlement_date: currentDate,
                        total_amount: total_amount || 0,
                        overflow_amount: overflow_amount || 0,
                        description,
                    },
                });

                return { billPayment, settlement };
            });
        } catch (error) {
            console.error('Error creating supplier bill settlement:', error);
            throw new Error(`Failed to create supplier bill settlement: ${error.message}`);
        }
    }

    async getSettlements(supplierId) {
        try {
            return await prisma.supplierBillSettlement.findMany({
                where: {
                    bill_payment: {
                        supplier_id: supplierId,
                    },
                },
                include: {
                    bill_payment: true,
                },
                orderBy: {
                    settlement_date: 'desc',
                },
            });
        } catch (error) {
            console.error('Error fetching supplier settlements:', error);
            throw new Error(`Failed to fetch supplier settlements: ${error.message}`);
        }
    }
}

module.exports = new SupplierBillToBillPaymentService();
