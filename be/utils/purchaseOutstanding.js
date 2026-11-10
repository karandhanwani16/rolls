const { getDueDate, getElapsedDays, getOverdueDays } = require('./creditDays');

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function eventTime(date, createdAt) {
    const primary = date ? new Date(date).getTime() : 0;
    const secondary = createdAt ? new Date(createdAt).getTime() : 0;
    return primary + secondary / 1e12;
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
 * FIFO-allocate payments-out and unlinked purchase returns against each
 * supplier's bills. Opening balance is settled first so purchase outstanding
 * is not understated. Linked returns reduce that purchase before allocation.
 * Payments with purchase_id are applied to that bill first; leftover joins FIFO.
 *
 * Returns Map<purchaseId, { remaining_amount, cleared_amount, payment_status, applications }>
 */
function allocatePurchaseOutstanding({ purchases, payments, purchaseReturns, suppliers }) {
    const remainingById = new Map();
    const purchasesBySupplier = new Map();
    const paymentsBySupplier = new Map();
    const returnsBySupplier = new Map();
    const supplierById = new Map((suppliers || []).map((supplier) => [supplier.id, supplier]));

    for (const purchase of purchases || []) {
        if (!purchasesBySupplier.has(purchase.supplier_id)) {
            purchasesBySupplier.set(purchase.supplier_id, []);
        }
        purchasesBySupplier.get(purchase.supplier_id).push(purchase);
        remainingById.set(purchase.id, emptyAllocation(purchase.total));
    }

    for (const payment of payments || []) {
        if (!paymentsBySupplier.has(payment.supplier_id)) {
            paymentsBySupplier.set(payment.supplier_id, []);
        }
        paymentsBySupplier.get(payment.supplier_id).push(payment);
    }

    for (const purchaseReturn of purchaseReturns || []) {
        if (!returnsBySupplier.has(purchaseReturn.supplier_id)) {
            returnsBySupplier.set(purchaseReturn.supplier_id, []);
        }
        returnsBySupplier.get(purchaseReturn.supplier_id).push(purchaseReturn);
    }

    const supplierIds = new Set([
        ...purchasesBySupplier.keys(),
        ...paymentsBySupplier.keys(),
        ...returnsBySupplier.keys(),
        ...supplierById.keys(),
    ]);

    for (const supplierId of supplierIds) {
        const supplierPurchases = (purchasesBySupplier.get(supplierId) || [])
            .slice()
            .sort((a, b) => eventTime(a.date, a.created_at) - eventTime(b.date, b.created_at));

        const linkedReturnLeftover = [];
        for (const purchaseReturn of returnsBySupplier.get(supplierId) || []) {
            const amount = round2(purchaseReturn.total);
            if (!amount) continue;

            const creditMeta = {
                type: 'RETURN',
                id: purchaseReturn.id,
                reference: purchaseReturn.return_no || null,
                description: purchaseReturn.description || 'Purchase return',
                date: purchaseReturn.date,
                created_at: purchaseReturn.created_at,
                source: 'LINKED_RETURN',
            };

            if (purchaseReturn.purchase_id && remainingById.has(purchaseReturn.purchase_id)) {
                const current = remainingById.get(purchaseReturn.purchase_id);
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
        for (const payment of paymentsBySupplier.get(supplierId) || []) {
            const amount = round2(payment.amount);
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

            if (payment.purchase_id && remainingById.has(payment.purchase_id)) {
                const current = remainingById.get(payment.purchase_id);
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

        let openingBalance = round2(supplierById.get(supplierId)?.opening_balance);
        while (openingBalance > 0 && credits.length > 0) {
            const credit = credits[0];
            const used = round2(Math.min(openingBalance, credit.amount));
            credit.amount = round2(credit.amount - used);
            openingBalance = round2(openingBalance - used);
            if (credit.amount <= 0) credits.shift();
        }

        for (const purchase of supplierPurchases) {
            const current = remainingById.get(purchase.id);
            if (!current || current.remaining_amount <= 0) continue;

            while (current.remaining_amount > 0 && credits.length > 0) {
                const credit = credits[0];
                const applied = applyCreditToBill(current, credit, credit.amount);
                credit.amount = round2(credit.amount - applied);
                if (credit.amount <= 0) credits.shift();
            }
        }

        for (const purchase of supplierPurchases) {
            const current = remainingById.get(purchase.id);
            if (!current) continue;
            const total = round2(purchase.total);
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

function attachPurchaseOutstanding(purchase, allocation) {
    const remainingAmount = allocation
        ? allocation.remaining_amount
        : round2(purchase.total);
    const paymentStatus = allocation?.payment_status || 'UNPAID';
    const clearedAmount = allocation?.cleared_amount || 0;

    return {
        ...purchase,
        cleared_amount: clearedAmount,
        remaining_amount: remainingAmount,
        payment_status: paymentStatus,
        due_date: getDueDate(purchase.date, purchase.credit_days || 0),
        elapsed_days: getElapsedDays(purchase.date),
        overdue_days: getOverdueDays(
            purchase.date,
            purchase.credit_days || 0,
            remainingAmount
        ),
    };
}

module.exports = {
    allocatePurchaseOutstanding,
    attachPurchaseOutstanding,
};
