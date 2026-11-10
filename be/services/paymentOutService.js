const prisma = require('../prisma/client');
const transactionService = require('./transactions');
const { allocatePurchaseOutstanding } = require('../utils/purchaseOutstanding');
const { compareAmounts } = require('./watavAllocation');

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

async function validatePurchaseBillLink({
    purchaseId,
    supplierId,
    amount,
    excludePaymentId = null,
}) {
    if (!purchaseId) return;

    if (!supplierId) {
        throw new Error('Supplier is required for a full bill payment');
    }

    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) {
        throw new Error('Purchase bill not found');
    }
    if (purchase.supplier_id !== supplierId) {
        throw new Error('Selected bill does not belong to this supplier');
    }

    const existingLink = await prisma.paymentOut.findFirst({
        where: {
            purchase_id: purchaseId,
            ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
        },
    });
    if (existingLink) {
        throw new Error('This bill already has a full bill payment');
    }

    const [purchases, payments, purchaseReturns, supplier] = await Promise.all([
        prisma.purchase.findMany({ where: { supplier_id: supplierId } }),
        prisma.paymentOut.findMany({
            where: {
                supplier_id: supplierId,
                ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
            },
        }),
        prisma.purchaseReturn.findMany({ where: { supplier_id: supplierId } }),
        prisma.supplier.findUnique({ where: { id: supplierId } }),
    ]);

    const remainingById = allocatePurchaseOutstanding({
        purchases,
        payments,
        purchaseReturns,
        suppliers: supplier ? [supplier] : [],
    });
    const remaining =
        remainingById.get(purchaseId)?.remaining_amount ?? (Number(purchase.total) || 0);
    if (remaining <= 0) {
        throw new Error('Selected bill is already fully paid');
    }
    if (compareAmounts(amount, remaining) < 0) {
        throw new Error(
            `Full bill payment must cover the remaining amount of ${remaining.toFixed(2)}`
        );
    }
}

function normalizePaymentOutPayload(paymentOutData) {
    const amount = round2(paymentOutData.amount);
    if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
    }
    if (!paymentOutData.supplier_id) {
        throw new Error('Supplier is required');
    }
    if (!paymentOutData.type) {
        throw new Error('Payment type is required');
    }

    return {
        supplier_id: paymentOutData.supplier_id,
        amount,
        description: paymentOutData.description || null,
        type: paymentOutData.type,
        cheque_date: paymentOutData.cheque_date
            ? new Date(paymentOutData.cheque_date)
            : null,
        payment_date: paymentOutData.payment_date
            ? new Date(paymentOutData.payment_date)
            : null,
        purchase_id: paymentOutData.purchase_id || null,
    };
}

const PAYMENT_OUT_INCLUDE = {
    supplier: true,
    purchase: {
        select: { id: true, purchase_no: true, total: true, date: true },
    },
};

class PaymentOutService {
    async getAllPaymentsOut() {
        try {
            const paymentsOut = await prisma.paymentOut.findMany({
                include: PAYMENT_OUT_INCLUDE,
                orderBy: { created_at: 'desc' },
            });
            return paymentsOut;
        } catch (error) {
            throw new Error(`Failed to fetch payments out: ${error.message}`);
        }
    }

    async getPaymentOutById(id) {
        try {
            const paymentOut = await prisma.paymentOut.findUnique({
                where: { id },
                include: PAYMENT_OUT_INCLUDE,
            });

            if (!paymentOut) {
                throw new Error(`Payment out with ID ${id} not found`);
            }

            return paymentOut;
        } catch (error) {
            throw new Error(`Failed to fetch payment out: ${error.message}`);
        }
    }

    async createPaymentOut(paymentOutData) {
        try {
            const normalized = normalizePaymentOutPayload(paymentOutData);
            await validatePurchaseBillLink({
                purchaseId: normalized.purchase_id,
                supplierId: normalized.supplier_id,
                amount: normalized.amount,
            });

            const newPaymentOut = await prisma.paymentOut.create({
                data: normalized,
                include: PAYMENT_OUT_INCLUDE,
            });

            const billLabel = newPaymentOut.purchase?.purchase_no
                ? ` for bill ${newPaymentOut.purchase.purchase_no}`
                : '';
            await transactionService.createTransactionRecord(
                'outgoing',
                `Payment made to ${newPaymentOut.supplier?.name || 'Supplier'}${billLabel}`,
                null,
                newPaymentOut.supplier_id,
                newPaymentOut.amount
            );

            return newPaymentOut;
        } catch (error) {
            throw new Error(`Failed to create payment out: ${error.message}`);
        }
    }

    async updatePaymentOut(id, paymentOutData) {
        try {
            const normalized = normalizePaymentOutPayload(paymentOutData);
            await validatePurchaseBillLink({
                purchaseId: normalized.purchase_id,
                supplierId: normalized.supplier_id,
                amount: normalized.amount,
                excludePaymentId: id,
            });

            const updatedPaymentOut = await prisma.paymentOut.update({
                where: { id },
                data: normalized,
                include: PAYMENT_OUT_INCLUDE,
            });

            const billLabel = updatedPaymentOut.purchase?.purchase_no
                ? ` for bill ${updatedPaymentOut.purchase.purchase_no}`
                : '';
            await transactionService.createTransactionRecord(
                'outgoing',
                `Payment updated for ${updatedPaymentOut.supplier?.name || 'Supplier'}${billLabel}`,
                null,
                updatedPaymentOut.supplier_id,
                updatedPaymentOut.amount
            );

            return updatedPaymentOut;
        } catch (error) {
            throw new Error(`Failed to update payment out: ${error.message}`);
        }
    }

    async deletePaymentOut(id) {
        try {
            const paymentOut = await prisma.paymentOut.findUnique({
                where: { id },
                include: {
                    supplier: true,
                },
            });

            if (!paymentOut) {
                throw new Error(`Payment out with ID ${id} not found`);
            }

            // Create transaction record for the deletion
            await transactionService.createTransactionRecord(
                'incoming',
                `Payment deleted for ${paymentOut.supplier?.name || 'Supplier'}`,
                null,
                paymentOut.supplier_id,
                paymentOut.amount
            );

            await prisma.paymentOut.delete({
                where: { id }
            });
            return { success: true, message: 'Payment out deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete payment out: ${error.message}`);
        }
    }
}

module.exports = new PaymentOutService();
