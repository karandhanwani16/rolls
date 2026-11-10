const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { roundMeters, EPS } = require('../utils/purchaseReturnStock');

describe('purchaseReturnStock helpers', () => {
    it('roundMeters fixes float noise', () => {
        assert.equal(roundMeters(10.1 + 20.2), 30.3);
    });

    it('EPS allows full-return comparison', () => {
        const available = 100;
        const returned = 99.9999;
        assert.ok(returned + EPS >= available);
    });
});
