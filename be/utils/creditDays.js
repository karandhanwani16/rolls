/**
 * Credit period is inclusive of the sale date.
 * Sale 1 Jan + 30 credit days → last free day is 30 Jan (due end of that day).
 * Viewed on 2 Feb with unpaid balance → overdue_days = 3.
 *
 * credit_days = 0 → due on sale date; overdue starts the next calendar day.
 *
 * elapsed_days = calendar days since the bill date (sale/purchase created).
 * Sale 1 Jan viewed on 3 Jan → 2; viewed on 15 Feb → 45.
 */
function startOfUtcDay(date) {
    const d = new Date(date);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function addDaysUtc(date, days) {
    const d = new Date(startOfUtcDay(date));
    d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
    return d;
}

function calendarDaysBetween(fromDate, toDate) {
    const from = startOfUtcDay(fromDate);
    const to = startOfUtcDay(toDate);
    return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

function getDueDate(saleDate, creditDays) {
    const days = Number(creditDays) || 0;
    // Inclusive credit window: sale day counts as day 1 when credit_days > 0
    return addDaysUtc(saleDate, Math.max(days - 1, 0));
}

function getElapsedDays(saleDate, asOfDate = new Date()) {
    if (!saleDate) return 0;
    return Math.max(0, calendarDaysBetween(saleDate, asOfDate));
}

function getOverdueDays(saleDate, creditDays, remainingAmount, asOfDate = new Date()) {
    if (!remainingAmount || remainingAmount <= 0) return 0;
    const dueDate = getDueDate(saleDate, creditDays);
    return Math.max(0, calendarDaysBetween(dueDate, asOfDate));
}

module.exports = {
    getDueDate,
    getElapsedDays,
    getOverdueDays,
    calendarDaysBetween,
};
