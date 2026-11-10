process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'file:./watav_test.sqlite';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { toPaise, fromPaise, addAmounts, subtractAmounts } = require('../utils/money');
const {
    allocateFifo,
    applyReceipt,
    decoratePayment,
    summarizeVendor,
    vendorOutstanding,
    SETTLEMENT_STATUS,
} = require('../services/watavAllocation');
const { customerCreditAmount, PAYMENT_CATEGORY, ENTRY_TYPE } = require('../services/paymentInService');

function payment(overrides) {
    return {
        id: overrides.id,
        payment_category: PAYMENT_CATEGORY.VATAV,
        entry_type: ENTRY_TYPE.CUSTOMER_PAYMENT,
        receive_id: overrides.receive_id || 'vendor-x',
        actual_id: overrides.actual_id || 'customer-a',
        received_amount: overrides.received_amount,
        discount: overrides.discount || 0,
        charges: overrides.charges || 0,
        payment_date: overrides.payment_date || new Date('2026-01-01'),
        created_at: overrides.created_at || new Date('2026-01-01T00:00:00.000Z'),
        collection_status: overrides.collection_status || SETTLEMENT_STATUS.PENDING,
        watav_allocations: overrides.watav_allocations || [],
        ...overrides,
    };
}

function statuses(payments) {
    return payments.map((p) => decoratePayment(p).settlementStatus);
}

function remaining(payments) {
    return payments.map((p) => decoratePayment(p).remainingAmount);
}

describe('money helpers', () => {
    it('converts to paise without floating-point drift', () => {
        assert.equal(toPaise(50_000), 5_000_000);
        assert.equal(toPaise(0.1 + 0.2), 30);
        assert.equal(fromPaise(2500), 25);
        assert.equal(addAmounts(20_000, 15_000, 15_000), 50_000);
        assert.equal(subtractAmounts(50_000, 25_000), 25_000);
    });
});

describe('Watav customer vs vendor accounting', () => {
    it('1. basic Watav payment: customer credit 50k, vendor pending 50k', () => {
        const watav = payment({
            id: 'p1',
            received_amount: 50_000,
            actual_id: 'customer-a',
            receive_id: 'vendor-x',
        });
        assert.equal(customerCreditAmount(watav), 50_000);
        const vendor = summarizeVendor([watav], [], 'vendor-x');
        assert.equal(vendor.totalReceivable, 50_000);
        assert.equal(vendor.currentPending, 50_000);
        assert.equal(vendor.totalSettled, 0);
    });

    it('2. normal payment behaves as before and creates no Watav receivable', () => {
        const normal = {
            id: 'n1',
            payment_category: PAYMENT_CATEGORY.NORMAL,
            actual_id: 'customer-a',
            receive_id: 'customer-a',
            received_amount: 50_000,
            discount: 0,
            watav_allocations: [],
        };
        assert.equal(customerCreditAmount(normal), 50_000);
        const vendor = summarizeVendor([normal], [], 'vendor-x');
        assert.equal(vendor.totalReceivable, 0);
        assert.equal(vendor.currentPending, 0);
        assert.equal(vendorOutstanding([normal], 'vendor-x').length, 0);
    });

    it('11. customer reports treat Watav as received immediately, never pending from customer', () => {
        const watav = payment({ id: 'p1', received_amount: 50_000, discount: 0 });
        assert.equal(customerCreditAmount(watav), 50_000);

        const settled = applyReceipt([watav], 50_000);
        assert.equal(customerCreditAmount(settled.payments[0]), 50_000);
        assert.equal(customerCreditAmount(watav), customerCreditAmount(settled.payments[0]));

        const saleOutstanding = 100_000;
        const customerBalance = saleOutstanding - customerCreditAmount(watav);
        assert.equal(customerBalance, 50_000);
    });
});

describe('FIFO vendor settlement', () => {
    it('3. one receipt partially settling multiple 50k payments with 75k', () => {
        const payments = [
            payment({ id: 'p1', received_amount: 50_000, payment_date: new Date('2026-01-01'), created_at: new Date('2026-01-01T01:00:00Z') }),
            payment({ id: 'p2', received_amount: 50_000, payment_date: new Date('2026-01-02'), created_at: new Date('2026-01-02T01:00:00Z') }),
            payment({ id: 'p3', received_amount: 50_000, payment_date: new Date('2026-01-03'), created_at: new Date('2026-01-03T01:00:00Z') }),
        ];
        const result = applyReceipt(payments, 75_000);
        assert.deepEqual(statuses(result.payments), [
            SETTLEMENT_STATUS.COMPLETED,
            SETTLEMENT_STATUS.PARTIALLY_SETTLED,
            SETTLEMENT_STATUS.PENDING,
        ]);
        assert.deepEqual(remaining(result.payments), [0, 25_000, 50_000]);
        assert.equal(summarizeVendor(result.payments, [{ vendor_id: 'vendor-x', amount: 75_000, unallocated_amount: 0 }], 'vendor-x').currentPending, 75_000);
        assert.equal(result.unallocatedAmount, 0);
        assert.equal(customerCreditAmount(result.payments[0]), 50_000);
        assert.equal(customerCreditAmount(result.payments[1]), 50_000);
        assert.equal(customerCreditAmount(result.payments[2]), 50_000);
    });

    it('4. subsequent 75k receipt completes remaining payments', () => {
        const payments = [
            payment({ id: 'p1', received_amount: 50_000, payment_date: new Date('2026-01-01'), created_at: new Date('2026-01-01T01:00:00Z') }),
            payment({ id: 'p2', received_amount: 50_000, payment_date: new Date('2026-01-02'), created_at: new Date('2026-01-02T01:00:00Z') }),
            payment({ id: 'p3', received_amount: 50_000, payment_date: new Date('2026-01-03'), created_at: new Date('2026-01-03T01:00:00Z') }),
        ];
        const first = applyReceipt(payments, 75_000);
        const second = applyReceipt(first.payments, 75_000);
        assert.deepEqual(statuses(second.payments), [
            SETTLEMENT_STATUS.COMPLETED,
            SETTLEMENT_STATUS.COMPLETED,
            SETTLEMENT_STATUS.COMPLETED,
        ]);
        assert.deepEqual(remaining(second.payments), [0, 0, 0]);
        assert.equal(summarizeVendor(second.payments, [], 'vendor-x').currentPending, 0);
    });

    it('5. multiple partial receipts on one 50k payment: 20+15+15', () => {
        let payments = [payment({ id: 'p1', received_amount: 50_000 })];
        payments = applyReceipt(payments, 20_000).payments;
        assert.equal(payments[0].settlementStatus, SETTLEMENT_STATUS.PARTIALLY_SETTLED);
        assert.equal(payments[0].remainingAmount, 30_000);
        payments = applyReceipt(payments, 15_000).payments;
        assert.equal(payments[0].remainingAmount, 15_000);
        payments = applyReceipt(payments, 15_000).payments;
        assert.equal(payments[0].settlementStatus, SETTLEMENT_STATUS.COMPLETED);
        assert.equal(payments[0].remainingAmount, 0);
        assert.equal(payments[0].watav_allocations.length, 3);
        assert.equal(customerCreditAmount(payments[0]), 50_000);
    });

    it('6. receipt spanning 20/30/40 with 65k leaves 25k on last', () => {
        const payments = [
            payment({ id: 'a', received_amount: 20_000, payment_date: new Date('2026-01-01'), created_at: new Date('2026-01-01T01:00:00Z') }),
            payment({ id: 'b', received_amount: 30_000, payment_date: new Date('2026-01-02'), created_at: new Date('2026-01-02T01:00:00Z') }),
            payment({ id: 'c', received_amount: 40_000, payment_date: new Date('2026-01-03'), created_at: new Date('2026-01-03T01:00:00Z') }),
        ];
        const result = applyReceipt(payments, 65_000);
        assert.deepEqual(statuses(result.payments), [
            SETTLEMENT_STATUS.COMPLETED,
            SETTLEMENT_STATUS.COMPLETED,
            SETTLEMENT_STATUS.PARTIALLY_SETTLED,
        ]);
        assert.equal(result.payments[2].remainingAmount, 25_000);
    });

    it('7. unlinked vendor receipt does not change customer balance', () => {
        const customerPayment = payment({
            id: 'p1',
            actual_id: 'customer-a',
            received_amount: 50_000,
        });
        const before = customerCreditAmount(customerPayment);
        const plan = allocateFifo([], 30_000);
        assert.equal(plan.allocations.length, 0);
        assert.equal(plan.unallocatedAmount, 30_000);
        assert.equal(customerCreditAmount(customerPayment), before);

        const standalone = payment({
            id: 's1',
            actual_id: null,
            entry_type: ENTRY_TYPE.STANDALONE,
            received_amount: 30_000,
        });
        assert.equal(customerCreditAmount(standalone), 0);
        const vendor = summarizeVendor([standalone], [], 'vendor-x');
        assert.equal(vendor.currentPending, 30_000);
    });

    it('8. excess receipt: pending 50k, receipt 70k → 50 allocated, 20 unallocated', () => {
        const payments = [payment({ id: 'p1', received_amount: 50_000 })];
        const result = applyReceipt(payments, 70_000);
        assert.equal(result.allocatedAmount, 50_000);
        assert.equal(result.unallocatedAmount, 20_000);
        assert.equal(result.payments[0].settlementStatus, SETTLEMENT_STATUS.COMPLETED);
        const summary = summarizeVendor(
            result.payments,
            [{ vendor_id: 'vendor-x', amount: 70_000, unallocated_amount: 20_000 }],
            'vendor-x'
        );
        assert.equal(summary.unallocatedAmount, 20_000);
        assert.equal(summary.currentPending, 0);
        assert.equal(customerCreditAmount(result.payments[0]), 50_000);
    });

    it('9. vendor A receipt never settles vendor B payments', () => {
        const payments = [
            payment({ id: 'a1', receive_id: 'vendor-a', received_amount: 50_000, payment_date: new Date('2026-01-01') }),
            payment({ id: 'b1', receive_id: 'vendor-b', received_amount: 50_000, payment_date: new Date('2025-01-01') }),
        ];
        const outstandingA = vendorOutstanding(payments, 'vendor-a');
        const plan = allocateFifo(outstandingA, 50_000);
        assert.deepEqual(plan.allocations.map((a) => a.paymentId), ['a1']);
        assert.equal(plan.allocations.length, 1);
        const afterA = applyReceipt(outstandingA, 50_000);
        const b = decoratePayment(payments[1]);
        assert.equal(b.remainingAmount, 50_000);
        assert.equal(b.settlementStatus, SETTLEMENT_STATUS.PENDING);
        assert.equal(afterA.payments[0].id, 'a1');
    });

    it('10. oldest outstanding is settled first when dates differ', () => {
        const payments = [
            payment({ id: 'new', received_amount: 40_000, payment_date: new Date('2026-03-01'), created_at: new Date('2026-03-01T00:00:00Z') }),
            payment({ id: 'old', received_amount: 40_000, payment_date: new Date('2026-01-01'), created_at: new Date('2026-01-01T00:00:00Z') }),
        ];
        const plan = allocateFifo(payments, 40_000);
        assert.equal(plan.allocations[0].paymentId, 'old');
        assert.equal(plan.allocations[0].amount, 40_000);
        assert.equal(plan.allocations.length, 1);
    });

    it('10b. same date uses created_at then id as tie-breaker', () => {
        const date = new Date('2026-01-01');
        const payments = [
            payment({ id: 'p-b', received_amount: 10_000, payment_date: date, created_at: new Date('2026-01-01T12:00:00Z') }),
            payment({ id: 'p-a', received_amount: 10_000, payment_date: date, created_at: new Date('2026-01-01T08:00:00Z') }),
        ];
        const plan = allocateFifo(payments, 10_000);
        assert.equal(plan.allocations[0].paymentId, 'p-a');
    });
});

describe('vendor report totals', () => {
    it('12. totals for receivable, settled, pending, partial, unallocated', () => {
        const payments = [
            payment({ id: 'p1', received_amount: 50_000, payment_date: new Date('2026-01-01'), created_at: new Date('2026-01-01T01:00:00Z') }),
            payment({ id: 'p2', received_amount: 50_000, payment_date: new Date('2026-01-02'), created_at: new Date('2026-01-02T01:00:00Z') }),
            payment({ id: 'p3', received_amount: 50_000, payment_date: new Date('2026-01-03'), created_at: new Date('2026-01-03T01:00:00Z') }),
        ];
        const after = applyReceipt(payments, 75_000);
        const receipts = [{ vendor_id: 'vendor-x', amount: 75_000, unallocated_amount: 0 }];
        const summary = summarizeVendor(after.payments, receipts, 'vendor-x');
        assert.equal(summary.totalReceivable, 150_000);
        assert.equal(summary.totalSettled, 75_000);
        assert.equal(summary.currentPending, 75_000);
        assert.equal(summary.partiallySettledCount, 1);
        assert.equal(summary.unallocatedAmount, 0);
        assert.equal(summary.totalReceived, 75_000);
    });

    it('receipts with no pending linked payments stay unallocated', () => {
        const summary = summarizeVendor(
            [],
            [{ vendor_id: 'vendor-x', amount: 30_000, unallocated_amount: 30_000 }],
            'vendor-x'
        );
        assert.equal(summary.unallocatedAmount, 30_000);
        assert.equal(summary.currentPending, 0);
        assert.equal(summary.totalReceivable, 0);
    });
});

describe('standalone and normal invariants', () => {
    it('standalone watav does not credit a customer', () => {
        const row = payment({
            id: 's1',
            actual_id: null,
            entry_type: ENTRY_TYPE.STANDALONE,
            received_amount: 30_000,
        });
        assert.equal(customerCreditAmount(row), 0);
    });

    it('vendor settlement never creates another customer credit', () => {
        const watav = payment({ id: 'p1', received_amount: 50_000 });
        const after = applyReceipt([watav], 50_000);
        const customerCredits = after.payments.map(customerCreditAmount);
        assert.deepEqual(customerCredits, [50_000]);
        assert.equal(after.payments[0].settlementStatus, SETTLEMENT_STATUS.COMPLETED);
    });

    it('legacy COLLECTED without allocations is treated as fully settled', () => {
        const legacy = payment({
            id: 'legacy',
            received_amount: 40_000,
            collection_status: 'COLLECTED',
            watav_allocations: [],
        });
        const decorated = decoratePayment(legacy);
        assert.equal(decorated.settlementStatus, SETTLEMENT_STATUS.COMPLETED);
        assert.equal(decorated.remainingAmount, 0);
        assert.equal(decorated.totalSettledAmount, 40_000);
    });
});
