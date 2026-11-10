const prisma = require('../prisma/client');
const {
    SETTLEMENT_STATUS,
    allocateFifo,
    decoratePayment,
    remainingAmount,
    deriveSettlementStatus,
    isPositiveAmount,
    compareOutstanding,
} = require('./watavAllocation');

const ALLOCATION_INCLUDE = {
    allocations: {
        include: {
            payment: {
                include: {
                    actual_customer: true,
                    receive_customer: true,
                },
            },
        },
        orderBy: { created_at: 'asc' },
    },
    vendor: true,
};

const PAYMENT_INCLUDE = {
    receive_customer: true,
    actual_customer: true,
    sale: {
        select: { id: true, sales_no: true, total: true, date: true },
    },
    watav_allocations: {
        include: {
            receipt: true,
        },
        orderBy: { created_at: 'asc' },
    },
};

function decorateReceipt(receipt) {
    const allocations = (receipt.allocations || []).map((row) => {
        const payment = row.payment ? decoratePayment(row.payment) : null;
        return {
            id: row.id,
            receipt_id: row.receipt_id,
            payment_in_id: row.payment_in_id,
            allocated_amount: row.allocated_amount,
            created_at: row.created_at,
            payment,
            actualCustomerName: payment?.actual_customer?.name || null,
            watavCustomerName: payment?.receive_customer?.name || receipt.vendor?.name || null,
            paymentDate: payment?.payment_date || payment?.created_at || null,
            originalAmount: payment?.originalAmount || 0,
            remainingAfter: payment
                ? remainingAmount(payment, payment.watav_allocations)
                : 0,
        };
    });

    return {
        ...receipt,
        allocations,
        allocatedAmount: (receipt.amount || 0) - (receipt.unallocated_amount || 0),
        unallocatedAmount: receipt.unallocated_amount || 0,
    };
}

async function recalcPaymentStatus(tx, paymentId, completedDate = null) {
    const payment = await tx.paymentIn.findUnique({
        where: { id: paymentId },
        include: { watav_allocations: true },
    });
    if (!payment || payment.payment_category !== 'VATAV') return null;

    const decorated = decoratePayment(payment);
    const data = {
        collection_status: decorated.settlementStatus,
        collection_date:
            decorated.settlementStatus === SETTLEMENT_STATUS.COMPLETED
                ? completedDate || payment.collection_date || new Date()
                : null,
    };

    return tx.paymentIn.update({
        where: { id: paymentId },
        data,
    });
}

class WatavSettlementService {
    async getReceipts({ vendorId, startDate, endDate } = {}) {
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate + 'T00:00:00.000Z');
        if (endDate) dateFilter.lte = new Date(endDate + 'T23:59:59.999Z');

        const receipts = await prisma.watavVendorReceipt.findMany({
            where: {
                ...(vendorId ? { vendor_id: vendorId } : {}),
                ...(Object.keys(dateFilter).length > 0 ? { receipt_date: dateFilter } : {}),
            },
            include: ALLOCATION_INCLUDE,
            orderBy: [{ receipt_date: 'desc' }, { created_at: 'desc' }],
        });

        return receipts.map(decorateReceipt);
    }

    async getReceiptById(id) {
        const receipt = await prisma.watavVendorReceipt.findUnique({
            where: { id },
            include: ALLOCATION_INCLUDE,
        });
        if (!receipt) {
            throw new Error(`Watav vendor receipt with ID ${id} not found`);
        }
        return decorateReceipt(receipt);
    }

    /**
     * Record money received from a Watav vendor and FIFO-allocate against
     * that vendor's oldest outstanding Watav payments. Never creates a customer payment.
     */
    async createVendorReceipt(data) {
        const vendorId = data.vendor_id || data.receive_id;
        if (!vendorId) {
            throw new Error('Watav vendor is required');
        }

        const amount = Number(data.amount ?? data.received_amount);
        if (!isPositiveAmount(amount)) {
            throw new Error('Receipt amount must be greater than 0');
        }

        const vendor = await prisma.customer.findUnique({ where: { id: vendorId } });
        if (!vendor) {
            throw new Error('Watav vendor not found');
        }

        const receiptDate = data.receipt_date || data.collection_date
            ? new Date(data.receipt_date || data.collection_date)
            : new Date();

        return prisma.$transaction(async (tx) => {
            const payments = await tx.paymentIn.findMany({
                where: {
                    payment_category: 'VATAV',
                    receive_id: vendorId,
                },
                include: PAYMENT_INCLUDE,
            });

            const outstanding = payments
                .map(decoratePayment)
                .filter((p) => isPositiveAmount(p.remainingAmount))
                .sort(compareOutstanding);

            const plan = allocateFifo(outstanding, amount);

            const receipt = await tx.watavVendorReceipt.create({
                data: {
                    vendor_id: vendorId,
                    receipt_date: receiptDate,
                    amount,
                    unallocated_amount: plan.unallocatedAmount,
                    type: data.type || 'other',
                    reference: data.reference || null,
                    description: data.description || '',
                    allocations: {
                        create: plan.allocations.map((row) => ({
                            payment_in_id: row.paymentId,
                            allocated_amount: row.amount,
                        })),
                    },
                },
                include: ALLOCATION_INCLUDE,
            });

            for (const row of plan.allocations) {
                await recalcPaymentStatus(tx, row.paymentId, receiptDate);
            }

            const saved = await tx.watavVendorReceipt.findUnique({
                where: { id: receipt.id },
                include: ALLOCATION_INCLUDE,
            });

            return decorateReceipt(saved);
        });
    }

    async deleteVendorReceipt(id) {
        const existing = await prisma.watavVendorReceipt.findUnique({
            where: { id },
            include: { allocations: true },
        });
        if (!existing) {
            throw new Error(`Watav vendor receipt with ID ${id} not found`);
        }

        const paymentIds = [...new Set(existing.allocations.map((a) => a.payment_in_id))];

        await prisma.$transaction(async (tx) => {
            await tx.watavVendorReceipt.delete({ where: { id } });
            for (const paymentId of paymentIds) {
                await recalcPaymentStatus(tx, paymentId);
            }
        });

        return { success: true, message: 'Watav vendor receipt deleted successfully' };
    }

    async getPaymentSettlement(paymentId) {
        const payment = await prisma.paymentIn.findUnique({
            where: { id: paymentId },
            include: PAYMENT_INCLUDE,
        });
        if (!payment) {
            throw new Error(`Payment in with ID ${paymentId} not found`);
        }
        return decoratePayment(payment);
    }
}

module.exports = new WatavSettlementService();
module.exports.PAYMENT_INCLUDE = PAYMENT_INCLUDE;
module.exports.decorateReceipt = decorateReceipt;
module.exports.recalcPaymentStatus = recalcPaymentStatus;
