/**
 * Reusable Watav FIFO settlement / allocation.
 * This is the single source of truth for remaining amounts and receipt splits.
 * Persistence lives in watavSettlementService; reports/UI must call these helpers.
 */

const {
    toPaise,
    fromPaise,
    addAmounts,
    subtractAmounts,
    compareAmounts,
    isPositiveAmount,
} = require('../utils/money');

const SETTLEMENT_STATUS = {
    PENDING: 'PENDING',
    PARTIALLY_SETTLED: 'PARTIALLY_SETTLED',
    COMPLETED: 'COMPLETED',
};

/** Legacy binary status from before FIFO receipts */
const LEGACY_COLLECTED = 'COLLECTED';

function normalizeSettlementStatus(status) {
    if (!status) return SETTLEMENT_STATUS.PENDING;
    const upper = String(status).toUpperCase();
    if (upper === LEGACY_COLLECTED) return SETTLEMENT_STATUS.COMPLETED;
    if (upper === SETTLEMENT_STATUS.PARTIALLY_SETTLED) return SETTLEMENT_STATUS.PARTIALLY_SETTLED;
    if (upper === SETTLEMENT_STATUS.COMPLETED) return SETTLEMENT_STATUS.COMPLETED;
    return SETTLEMENT_STATUS.PENDING;
}

function isFullySettledStatus(status) {
    const normalized = normalizeSettlementStatus(status);
    return normalized === SETTLEMENT_STATUS.COMPLETED;
}

function originalAmount(payment) {
    return fromPaise(toPaise(payment?.received_amount || 0));
}

function sumAllocationAmounts(allocations = []) {
    return fromPaise(
        (allocations || []).reduce((sum, row) => sum + toPaise(row.allocated_amount ?? row.amount ?? 0), 0)
    );
}

function totalSettledAmount(payment, allocations) {
    const allocs = allocations || payment?.watav_allocations || [];
    const allocated = sumAllocationAmounts(allocs);
    if (
        isFullySettledStatus(payment?.collection_status) &&
        (!allocs || allocs.length === 0)
    ) {
        return originalAmount(payment);
    }
    return allocated;
}

function remainingAmount(payment, allocations) {
    const remaining = subtractAmounts(
        originalAmount(payment),
        totalSettledAmount(payment, allocations)
    );
    return compareAmounts(remaining, 0) < 0 ? 0 : remaining;
}

function settlementStatusFromAmounts(original, settled) {
    const originalPaise = toPaise(original);
    const settledPaise = toPaise(settled);
    if (originalPaise <= 0) return SETTLEMENT_STATUS.COMPLETED;
    if (settledPaise <= 0) return SETTLEMENT_STATUS.PENDING;
    if (settledPaise >= originalPaise) return SETTLEMENT_STATUS.COMPLETED;
    return SETTLEMENT_STATUS.PARTIALLY_SETTLED;
}

function deriveSettlementStatus(payment, allocations) {
    return settlementStatusFromAmounts(
        originalAmount(payment),
        totalSettledAmount(payment, allocations)
    );
}

function paymentDateValue(payment) {
    const date = payment?.payment_date || payment?.created_at;
    const time = date ? new Date(date).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
}

function createdAtValue(payment) {
    const time = payment?.created_at ? new Date(payment.created_at).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
}

function compareOutstanding(a, b) {
    const dateDiff = paymentDateValue(a) - paymentDateValue(b);
    if (dateDiff !== 0) return dateDiff;
    const createdDiff = createdAtValue(a) - createdAtValue(b);
    if (createdDiff !== 0) return createdDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
}

function decoratePayment(payment) {
    const allocations = payment?.watav_allocations || [];
    const original = originalAmount(payment);
    const settled = totalSettledAmount(payment, allocations);
    const remaining = remainingAmount(payment, allocations);
    const status = deriveSettlementStatus(payment, allocations);
    return {
        ...payment,
        originalAmount: original,
        totalSettledAmount: settled,
        remainingAmount: remaining,
        settlementStatus: status,
        collection_status: status,
        watav_allocations: allocations,
    };
}

function isOutstandingDecorated(decorated) {
    return isPositiveAmount(decorated.remainingAmount);
}

/**
 * Deterministic FIFO split of a vendor receipt against outstanding Watav payments.
 *
 * @param {Array<object>} outstandingPayments decorated or raw payments (must include remainingAmount or enough to compute it)
 * @param {number} receiptAmount
 * @returns {{ allocations: Array<{ paymentId: string, amount: number }>, unallocatedAmount: number, allocatedAmount: number }}
 */
function allocateFifo(outstandingPayments, receiptAmount) {
    const receiptPaise = toPaise(receiptAmount);
    if (receiptPaise <= 0) {
        throw new Error('Receipt amount must be greater than 0');
    }

    const ordered = [...(outstandingPayments || [])]
        .map((payment) => {
            const remaining = payment.remainingAmount != null
                ? payment.remainingAmount
                : remainingAmount(payment, payment.watav_allocations);
            return { payment, remainingPaise: toPaise(remaining) };
        })
        .filter((row) => row.remainingPaise > 0)
        .sort((a, b) => compareOutstanding(a.payment, b.payment));

    let leftoverPaise = receiptPaise;
    const allocations = [];

    for (const row of ordered) {
        if (leftoverPaise <= 0) break;
        const takePaise = Math.min(row.remainingPaise, leftoverPaise);
        if (takePaise <= 0) continue;
        allocations.push({
            paymentId: row.payment.id,
            amount: fromPaise(takePaise),
        });
        leftoverPaise -= takePaise;
    }

    return {
        allocations,
        allocatedAmount: fromPaise(receiptPaise - leftoverPaise),
        unallocatedAmount: fromPaise(leftoverPaise),
    };
}

/**
 * Apply a FIFO receipt to an in-memory payment list (tests + preview).
 * Does not mutate the original array.
 */
function applyReceipt(payments, receiptAmount, receiptMeta = {}) {
    const decorated = (payments || []).map((p) => decoratePayment(p));
    const plan = allocateFifo(decorated, receiptAmount);
    const byId = new Map(decorated.map((p) => [p.id, p]));

    const nextPayments = decorated.map((payment) => {
        const hits = plan.allocations.filter((a) => a.paymentId === payment.id);
        if (hits.length === 0) return payment;
        const added = hits.reduce((sum, hit) => addAmounts(sum, hit.amount), 0);
        const nextAllocations = [
            ...(payment.watav_allocations || []),
            ...hits.map((hit) => ({
                allocated_amount: hit.amount,
                receipt_id: receiptMeta.id || null,
            })),
        ];
        const next = {
            ...payment,
            watav_allocations: nextAllocations,
            collection_status: settlementStatusFromAmounts(
                payment.originalAmount,
                addAmounts(payment.totalSettledAmount, added)
            ),
        };
        return decoratePayment(next);
    });

    return {
        payments: nextPayments,
        allocations: plan.allocations.map((row) => ({
            ...row,
            payment: byId.get(row.paymentId) || null,
        })),
        allocatedAmount: plan.allocatedAmount,
        unallocatedAmount: plan.unallocatedAmount,
    };
}

function vendorOutstanding(payments, vendorId) {
    return (payments || [])
        .filter((p) => p.payment_category === 'VATAV' && p.receive_id === vendorId)
        .map((p) => decoratePayment(p))
        .filter(isOutstandingDecorated)
        .sort(compareOutstanding);
}

function summarizeVendor(payments, receipts = [], vendorId = null) {
    const vendorPayments = (payments || [])
        .filter((p) => p.payment_category === 'VATAV')
        .filter((p) => (vendorId ? p.receive_id === vendorId : true))
        .map((p) => decoratePayment(p));

    const vendorReceipts = (receipts || []).filter((r) =>
        vendorId ? r.vendor_id === vendorId : true
    );

    const receivable = vendorPayments.reduce(
        (sum, p) => addAmounts(sum, p.originalAmount),
        0
    );
    const settledFromPayments = vendorPayments.reduce(
        (sum, p) => addAmounts(sum, p.totalSettledAmount),
        0
    );
    const pending = vendorPayments.reduce(
        (sum, p) => addAmounts(sum, p.remainingAmount),
        0
    );
    const unallocated = vendorReceipts.reduce(
        (sum, r) => addAmounts(sum, r.unallocated_amount || 0),
        0
    );
    const received = vendorReceipts.reduce(
        (sum, r) => addAmounts(sum, r.amount || 0),
        0
    );
    const partiallySettled = vendorPayments.filter(
        (p) => p.settlementStatus === SETTLEMENT_STATUS.PARTIALLY_SETTLED
    );

    return {
        totalReceivable: receivable,
        totalSettled: settledFromPayments,
        totalReceived: received,
        currentPending: pending,
        partiallySettledCount: partiallySettled.length,
        partiallySettledPayments: partiallySettled,
        unallocatedAmount: unallocated,
        payments: vendorPayments,
        receipts: vendorReceipts,
    };
}

function outstandingWhereFilter(collectionStatus) {
    if (!collectionStatus) return {};
    const upper = String(collectionStatus).toUpperCase();
    if (upper === 'PENDING' || upper === 'OUTSTANDING') {
        return {
            collection_status: {
                in: [SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.PARTIALLY_SETTLED],
            },
        };
    }
    if (upper === SETTLEMENT_STATUS.COMPLETED || upper === LEGACY_COLLECTED) {
        return {
            collection_status: {
                in: [SETTLEMENT_STATUS.COMPLETED, LEGACY_COLLECTED],
            },
        };
    }
    if (upper === SETTLEMENT_STATUS.PARTIALLY_SETTLED) {
        return { collection_status: SETTLEMENT_STATUS.PARTIALLY_SETTLED };
    }
    return { collection_status: upper };
}

module.exports = {
    SETTLEMENT_STATUS,
    LEGACY_COLLECTED,
    normalizeSettlementStatus,
    isFullySettledStatus,
    originalAmount,
    totalSettledAmount,
    remainingAmount,
    settlementStatusFromAmounts,
    deriveSettlementStatus,
    decoratePayment,
    isOutstandingDecorated,
    compareOutstanding,
    allocateFifo,
    applyReceipt,
    vendorOutstanding,
    summarizeVendor,
    outstandingWhereFilter,
    addAmounts,
    subtractAmounts,
    compareAmounts,
    isPositiveAmount,
};
