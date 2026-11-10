/**
 * Integer-paise helpers for INR amounts stored as Prisma Float.
 * All financial math in Watav settlement goes through here — never raw JS floats.
 */

function toPaise(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100);
}

function fromPaise(paise) {
    const p = Number(paise);
    if (!Number.isFinite(p)) return 0;
    return p / 100;
}

function addAmounts(...amounts) {
    return fromPaise(amounts.reduce((sum, amount) => sum + toPaise(amount), 0));
}

function subtractAmounts(left, right) {
    return fromPaise(toPaise(left) - toPaise(right));
}

function minAmount(left, right) {
    return fromPaise(Math.min(toPaise(left), toPaise(right)));
}

function compareAmounts(left, right) {
    return toPaise(left) - toPaise(right);
}

function isPositiveAmount(amount) {
    return toPaise(amount) > 0;
}

function isZeroAmount(amount) {
    return toPaise(amount) === 0;
}

function maxAmount(left, right) {
    return fromPaise(Math.max(toPaise(left), toPaise(right)));
}

module.exports = {
    toPaise,
    fromPaise,
    addAmounts,
    subtractAmounts,
    minAmount,
    maxAmount,
    compareAmounts,
    isPositiveAmount,
    isZeroAmount,
};
