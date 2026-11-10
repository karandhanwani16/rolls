const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { allocatePurchaseOutstanding } = require('../utils/purchaseOutstanding');

describe('allocatePurchaseOutstanding', () => {
    it('applies linked returns then FIFO payments after opening balance', () => {
        const result = allocatePurchaseOutstanding({
            purchases: [
                { id: 'p1', supplier_id: 's1', total: 5000, date: '2026-01-10', created_at: '2026-01-10' },
                { id: 'p2', supplier_id: 's1', total: 8000, date: '2026-01-20', created_at: '2026-01-20' },
            ],
            payments: [
                { supplier_id: 's1', amount: 12000, payment_date: '2026-01-25', created_at: '2026-01-25' },
            ],
            purchaseReturns: [
                { supplier_id: 's1', purchase_id: 'p1', total: 1000, date: '2026-01-15', created_at: '2026-01-15' },
            ],
            suppliers: [{ id: 's1', opening_balance: 10000 }],
        });

        assert.equal(result.get('p1').remaining_amount, 2000);
        assert.equal(result.get('p1').payment_status, 'PARTIAL');
        assert.equal(result.get('p2').remaining_amount, 8000);
        assert.equal(result.get('p2').payment_status, 'UNPAID');
    });

    it('marks a fully settled purchase as FULL', () => {
        const result = allocatePurchaseOutstanding({
            purchases: [
                { id: 'p1', supplier_id: 's1', total: 4000, date: '2026-01-10', created_at: '2026-01-10' },
            ],
            payments: [
                { supplier_id: 's1', amount: 4000, payment_date: '2026-01-11', created_at: '2026-01-11' },
            ],
            purchaseReturns: [],
            suppliers: [{ id: 's1', opening_balance: 0 }],
        });

        assert.equal(result.get('p1').remaining_amount, 0);
        assert.equal(result.get('p1').payment_status, 'FULL');
    });

    it('applies full bill payments to the linked purchase before FIFO', () => {
        const result = allocatePurchaseOutstanding({
            purchases: [
                { id: 'p1', supplier_id: 's1', total: 5000, date: '2026-01-10', created_at: '2026-01-10' },
                { id: 'p2', supplier_id: 's1', total: 3000, date: '2026-01-20', created_at: '2026-01-20' },
            ],
            payments: [
                {
                    supplier_id: 's1',
                    purchase_id: 'p2',
                    amount: 3000,
                    payment_date: '2026-01-25',
                    created_at: '2026-01-25',
                },
            ],
            purchaseReturns: [],
            suppliers: [{ id: 's1', opening_balance: 0 }],
        });

        assert.equal(result.get('p2').remaining_amount, 0);
        assert.equal(result.get('p2').payment_status, 'FULL');
        assert.equal(result.get('p1').remaining_amount, 5000);
        assert.equal(result.get('p1').payment_status, 'UNPAID');
    });


    it('does not apply one supplier payment to another supplier', () => {
        const result = allocatePurchaseOutstanding({
            purchases: [
                { id: 'p1', supplier_id: 's1', total: 3000, date: '2026-01-10', created_at: '2026-01-10' },
                { id: 'p2', supplier_id: 's2', total: 3000, date: '2026-01-10', created_at: '2026-01-10' },
            ],
            payments: [
                { supplier_id: 's1', amount: 3000, payment_date: '2026-01-11', created_at: '2026-01-11' },
            ],
            purchaseReturns: [],
            suppliers: [
                { id: 's1', opening_balance: 0 },
                { id: 's2', opening_balance: 0 },
            ],
        });

        assert.equal(result.get('p1').payment_status, 'FULL');
        assert.equal(result.get('p2').payment_status, 'UNPAID');
        assert.equal(result.get('p2').remaining_amount, 3000);
    });
});
