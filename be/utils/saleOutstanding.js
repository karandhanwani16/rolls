const { getDueDate, getElapsedDays, getOverdueDays } = require('./creditDays');
const { customerCreditAmount } = require('../services/paymentInService');

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function eventTime(date, createdAt) {
    const primary = date ? new Date(date).getTime() : 0;
    const secondary = createdAt ? new Date(createdAt).getTime() : 0;
    return primary + secondary / 1e12;
}

function isCustomerLedgerPayment(payment) {
    if (!payment?.actual_id) return false;
    if (payment.payment_category === 'VATAV' && payment.entry_type === 'STANDALONE') {
        return false;
    }
    return true;
}

function emptyAllocation(total) {
    return {
        remaining_amount: round2(total),
        cleared_amount: 0,
        payment_status: 'UNPAID',
        applications: [],
    };
}

function pushApplication(current, application) {
    if (!application || !(application.amount > 0)) return;
    current.applications.push({
        ...application,
        amount: round2(application.amount),
    });
}

function applyCreditToBill(current, credit, amount) {
    const applied = round2(Math.min(current.remaining_amount, amount));
    if (applied <= 0) return 0;
    current.remaining_amount = round2(current.remaining_amount - applied);
    pushApplication(current, {
        type: credit.type,
        id: credit.id || null,
        reference: credit.reference || null,
        description: credit.description || null,
        date: credit.date || null,
        amount: applied,
        source: credit.source || 'SETTLEMENT',
    });
    return applied;
}

/**
 * FIFO-allocate customer payments-in and unlinked sale returns against each
 * customer's sales. Opening balance is settled first so sale outstanding is not
 * understated. Linked returns reduce that sale before allocation. Payments with
 * sale_id are applied to that bill first; any leftover joins the FIFO pool.
 *
 * Returns Map<saleId, { remaining_amount, cleared_amount, payment_status, applications }>
 */
function allocateSaleOutstanding({ sales, payments, saleReturns, customers }) {
    const remainingById = new Map();
    const salesByCustomer = new Map();
    const paymentsByCustomer = new Map();
    const returnsByCustomer = new Map();
    const customerById = new Map((customers || []).map((customer) => [customer.id, customer]));

    for (const sale of sales || []) {
        if (!salesByCustomer.has(sale.customer_id)) {
            salesByCustomer.set(sale.customer_id, []);
        }
        salesByCustomer.get(sale.customer_id).push(sale);
        remainingById.set(sale.id, emptyAllocation(sale.total));
    }

    for (const payment of payments || []) {
        if (!isCustomerLedgerPayment(payment)) continue;
        if (!paymentsByCustomer.has(payment.actual_id)) {
            paymentsByCustomer.set(payment.actual_id, []);
        }
        paymentsByCustomer.get(payment.actual_id).push(payment);
    }

    for (const saleReturn of saleReturns || []) {
        if (!returnsByCustomer.has(saleReturn.customer_id)) {
            returnsByCustomer.set(saleReturn.customer_id, []);
        }
        returnsByCustomer.get(saleReturn.customer_id).push(saleReturn);
    }

    const customerIds = new Set([
        ...salesByCustomer.keys(),
        ...paymentsByCustomer.keys(),
        ...returnsByCustomer.keys(),
        ...customerById.keys(),
    ]);

    for (const customerId of customerIds) {
        const customerSales = (salesByCustomer.get(customerId) || [])
            .slice()
            .sort((a, b) => eventTime(a.date, a.created_at) - eventTime(b.date, b.created_at));

        const linkedReturnLeftover = [];
        for (const saleReturn of returnsByCustomer.get(customerId) || []) {
            const amount = round2(saleReturn.total);
            if (!amount) continue;

            const creditMeta = {
                type: 'RETURN',
                id: saleReturn.id,
                reference: saleReturn.return_no || null,
                description: saleReturn.description || 'Sales return',
                date: saleReturn.date,
                created_at: saleReturn.created_at,
                source: 'LINKED_RETURN',
            };

            if (saleReturn.sale_id && remainingById.has(saleReturn.sale_id)) {
                const current = remainingById.get(saleReturn.sale_id);
                const applied = applyCreditToBill(current, creditMeta, amount);
                const leftover = round2(amount - applied);
                if (leftover > 0) {
                    linkedReturnLeftover.push({
                        ...creditMeta,
                        amount: leftover,
                        source: 'RETURN_OVERFLOW',
                    });
                }
            } else {
                linkedReturnLeftover.push({
                    ...creditMeta,
                    amount,
                    source: 'UNLINKED_RETURN',
                });
            }
        }

        const fifoCredits = [];
        for (const payment of paymentsByCustomer.get(customerId) || []) {
            const amount = round2(customerCreditAmount(payment));
            if (!amount) continue;

            const creditMeta = {
                type: 'PAYMENT',
                id: payment.id,
                reference: payment.type || null,
                description: payment.description || null,
                date: payment.payment_date || payment.created_at,
                created_at: payment.created_at,
                source: 'BILL_PAYMENT',
            };

            if (payment.sale_id && remainingById.has(payment.sale_id)) {
                const current = remainingById.get(payment.sale_id);
                const applied = applyCreditToBill(current, creditMeta, amount);
                const leftover = round2(amount - applied);
                if (leftover > 0) {
                    fifoCredits.push({
                        ...creditMeta,
                        amount: leftover,
                        source: 'PAYMENT_OVERFLOW',
                    });
                }
            } else {
                fifoCredits.push({
                    ...creditMeta,
                    amount,
                    source: 'SETTLEMENT',
                });
            }
        }

        const credits = [...fifoCredits, ...linkedReturnLeftover]
            .filter((credit) => credit.amount > 0)
            .sort((a, b) => eventTime(a.date, a.created_at) - eventTime(b.date, b.created_at))
            .map((credit) => ({ ...credit }));

        let openingBalance = round2(customerById.get(customerId)?.opening_balance);
        while (openingBalance > 0 && credits.length > 0) {
            const credit = credits[0];
            const used = round2(Math.min(openingBalance, credit.amount));
            credit.amount = round2(credit.amount - used);
            openingBalance = round2(openingBalance - used);
            if (credit.amount <= 0) credits.shift();
        }

        for (const sale of customerSales) {
            const current = remainingById.get(sale.id);
            if (!current || current.remaining_amount <= 0) continue;

            while (current.remaining_amount > 0 && credits.length > 0) {
                const credit = credits[0];
                const applied = applyCreditToBill(current, credit, credit.amount);
                credit.amount = round2(credit.amount - applied);
                if (credit.amount <= 0) credits.shift();
            }
        }

        for (const sale of customerSales) {
            const current = remainingById.get(sale.id);
            if (!current) continue;
            const total = round2(sale.total);
            current.cleared_amount = round2(Math.max(0, total - current.remaining_amount));
            if (current.remaining_amount <= 0) {
                current.payment_status = 'FULL';
                current.remaining_amount = 0;
            } else if (current.remaining_amount < total) {
                current.payment_status = 'PARTIAL';
            } else {
                current.payment_status = 'UNPAID';
            }
        }
    }

    return remainingById;
}

function attachSaleOutstanding(sale, allocation) {
    const remainingAmount = allocation
        ? allocation.remaining_amount
        : round2(sale.total);
    const paymentStatus = allocation?.payment_status || 'UNPAID';
    const clearedAmount = allocation?.cleared_amount || 0;

    return {
        ...sale,
        cleared_amount: clearedAmount,
        remaining_amount: remainingAmount,
        payment_status: paymentStatus,
        due_date: getDueDate(sale.date, sale.credit_days || 0),
        elapsed_days: getElapsedDays(sale.date),
        overdue_days: getOverdueDays(
            sale.date,
            sale.credit_days || 0,
            remainingAmount
        ),
    };
}

module.exports = {
    allocateSaleOutstanding,
    attachSaleOutstanding,
    isCustomerLedgerPayment,
};
