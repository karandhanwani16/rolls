const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { compareNatural, sortRollsByShade } = require('../utils/sortRolls');
const invoiceTemplate = require('../services/invoiceTemplate');

describe('compareNatural', () => {
    it('orders numeric strings by value, not lexicographically', () => {
        assert.ok(compareNatural('2', '10') < 0);
        assert.ok(compareNatural('10', '2') > 0);
    });

    it('handles mixed alphanumeric shades', () => {
        assert.ok(compareNatural('A1', 'A10') < 0);
        assert.ok(compareNatural('S-2', 'S-12') < 0);
    });

    it('puts blank / missing values last', () => {
        assert.ok(compareNatural('', '1') > 0);
        assert.ok(compareNatural(null, 'A1') > 0);
        assert.ok(compareNatural('  ', '2') > 0);
        assert.equal(compareNatural('', null), 0);
    });
});

describe('sortRollsByShade', () => {
    it('sorts by shade with roll_no as a stable tiebreaker', () => {
        const items = [
            { shade: '10', roll_no: 'R2' },
            { shade: '2', roll_no: 'R9' },
            { shade: '10', roll_no: 'R1' },
            { shade: '2', roll_no: 'R3' },
        ];
        assert.deepEqual(
            sortRollsByShade(items).map((row) => `${row.shade}:${row.roll_no}`),
            ['2:R3', '2:R9', '10:R1', '10:R2']
        );
    });

    it('keeps original order when shade and roll_no match', () => {
        const items = [
            { shade: '5', roll_no: 'R1', meters: 10 },
            { shade: '5', roll_no: 'R1', meters: 20 },
        ];
        const sorted = sortRollsByShade(items);
        assert.equal(sorted[0].meters, 10);
        assert.equal(sorted[1].meters, 20);
    });

    it('places missing shades after numbered ones, then by roll_no', () => {
        const items = [
            { shade: '', roll_no: 'R9' },
            { shade: '1', roll_no: 'R2' },
            { shade: null, roll_no: 'R8' },
        ];
        assert.deepEqual(
            sortRollsByShade(items).map((row) => row.roll_no),
            ['R2', 'R8', 'R9']
        );
    });
});

function sampleInvoice(items) {
    return {
        customer: 'Test Buyer',
        date: '08/09/2026',
        sales_no: '00001',
        unit: 'm',
        items,
        total: 100,
        transport_charges: 0,
        discount: 0,
        maker: 'Maker',
        credit_days: 0,
    };
}

function shadesFromHtml(html) {
    return [...html.matchAll(/<td>([^<]*)<\/td>\s*<td class="qty-cell/g)].map(
        (match) => (match[1] === '&nbsp;' ? '' : match[1])
    );
}

describe('invoiceTemplate roll order', () => {
    const items = [
        { name: 'Cotton', width: '54', unit: 'm', price: 10, roll_no: 'C2', shade: '10', mts: 20, amount: 200 },
        { name: 'Cotton', width: '54', unit: 'm', price: 10, roll_no: 'C1', shade: '2', mts: 15, amount: 150 },
        { name: 'Cotton', width: '54', unit: 'm', price: 10, roll_no: 'C3', shade: 'A1', mts: 12, amount: 120 },
    ];

    it('lists bill rolls by shade then roll no', () => {
        const html = invoiceTemplate(sampleInvoice(items), 'bill');
        assert.deepEqual(shadesFromHtml(html), ['2', '10', 'A1']);
        assert.match(html, /C1[\s\S]*C2[\s\S]*C3/);
    });

    it('lists challan rolls in the same shade order as the bill', () => {
        const html = invoiceTemplate(sampleInvoice(items), 'challan');
        assert.deepEqual(shadesFromHtml(html), ['2', '10', 'A1']);
        assert.match(html, /C1[\s\S]*C2[\s\S]*C3/);
    });

    it('keeps product groups in original order while sorting rolls inside each group', () => {
        const mixed = [
            { name: 'Silk', width: '44', unit: 'm', price: 20, roll_no: 'S2', shade: '8', mts: 10, amount: 200 },
            { name: 'Silk', width: '44', unit: 'm', price: 20, roll_no: 'S1', shade: '1', mts: 10, amount: 200 },
            { name: 'Cotton', width: '54', unit: 'm', price: 10, roll_no: 'C1', shade: '3', mts: 10, amount: 100 },
            { name: 'Cotton', width: '54', unit: 'm', price: 10, roll_no: 'C2', shade: '2', mts: 10, amount: 100 },
        ];
        const html = invoiceTemplate(sampleInvoice(mixed), 'bill');
        assert.deepEqual(shadesFromHtml(html), ['1', '8', '2', '3']);
        assert.match(html, /Silk[\s\S]*Cotton/);
    });
});
