const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { allocateSaleOutstanding } = require('../utils/saleOutstanding');

describe('allocateSaleOutstanding', () => {
    it('applies linked returns then FIFO payments after opening balance', () => {
        const result = allocateSaleOutstanding({
            sales: [
                { id: 's1', customer_id: 'c1', total: 5000, date: '2026-01-10', created_at: '2026-01-10' },
                { id: 's2', customer_id: 'c1', total: 8000, date: '2026-01-20', created_at: '2026-01-20' },
            ],
            payments: [
                {
                    actual_id: 'c1',
                    received_amount: 12000,
                    discount: 0,
                    payment_date: '2026-01-25',
                    created_at: '2026-01-25',
                },
            ],
            saleReturns: [
                { customer_id: 'c1', sale_id: 's1', total: 1000, date: '2026-01-15', created_at: '2026-01-15' },
            ],
            customers: [{ id: 'c1', opening_balance: 10000 }],
        });

        assert.equal(result.get('s1').remaining_amount, 2000);
        assert.equal(result.get('s1').payment_status, 'PARTIAL');
        assert.equal(result.get('s2').remaining_amount, 8000);
        assert.equal(result.get('s2').payment_status, 'UNPAID');
    });

    it('marks a partially settled sale with cleared and remaining amounts', () => {
        const result = allocateSaleOutstanding({
            sales: [
                { id: 's1', customer_id: 'c1', total: 36300, date: '2026-01-10', created_at: '2026-01-10' },
            ],
            payments: [
                {
                    actual_id: 'c1',
                    received_amount: 350,
                    discount: 0,
                    payment_date: '2026-01-11',
                    created_at: '2026-01-11',
                },
            ],
            saleReturns: [],
            customers: [{ id: 'c1', opening_balance: 0 }],
        });

        assert.equal(result.get('s1').cleared_amount, 350);
        assert.equal(result.get('s1').remaining_amount, 35950);
        assert.equal(result.get('s1').payment_status, 'PARTIAL');
    });

    it('applies full bill payments to the linked sale before FIFO', () => {
        const result = allocateSaleOutstanding({
            sales: [
                { id: 's1', customer_id: 'c1', total: 5000, date: '2026-01-10', created_at: '2026-01-10' },
                { id: 's2', customer_id: 'c1', total: 3000, date: '2026-01-20', created_at: '2026-01-20' },
            ],
            payments: [
                {
                    actual_id: 'c1',
                    sale_id: 's2',
                    received_amount: 3000,
                    discount: 0,
                    payment_date: '2026-01-25',
                    created_at: '2026-01-25',
                },
            ],
            saleReturns: [],
            customers: [{ id: 'c1', opening_balance: 0 }],
        });

        assert.equal(result.get('s2').remaining_amount, 0);
        assert.equal(result.get('s2').payment_status, 'FULL');
        assert.equal(result.get('s1').remaining_amount, 5000);
        assert.equal(result.get('s1').payment_status, 'UNPAID');
    });
});
