const { PurchaseItemStatus } = require('./purchaseItemStatus');

const EPS = 0.0001;

const roundMeters = (value) => parseFloat(Number(value).toFixed(3));

async function resolvePurchaseItemId(tx, item, purchaseId) {
    const direct = item.purchase_item_id || item.roll_id;
    if (direct) return direct;
    if (!purchaseId || !item.roll_no) return null;
    const match = await tx.purchaseItem.findFirst({
        where: {
            purchase_id: purchaseId,
            roll_no: String(item.roll_no).trim(),
        },
    });
    return match?.id || null;
}

/**
 * Undo stock impact of purchase return line items (update/delete).
 */
async function revertPurchaseReturnStock(tx, returnItems = []) {
    for (const row of returnItems) {
        const id = row.purchase_item_id;
        if (!id) continue;
        const returned = parseFloat(row.meters) || 0;
        if (returned <= 0) continue;

        const purchaseItem = await tx.purchaseItem.findUnique({ where: { id } });
        if (!purchaseItem) continue;
        if (purchaseItem.status === PurchaseItemStatus.SOLD) continue;

        const restoredMeters = roundMeters(purchaseItem.meters + returned);
        await tx.purchaseItem.update({
            where: { id },
            data: {
                meters: restoredMeters,
                status: PurchaseItemStatus.UNSOLD,
            },
        });
    }
}

/**
 * Deduct returned quantity from purchase stock (create/update).
 */
async function applyPurchaseReturnStock(tx, items = [], purchaseId = null) {
    for (const item of items) {
        const returned = parseFloat(item.meters) || 0;
        if (returned <= 0) continue;

        const id = await resolvePurchaseItemId(tx, item, purchaseId);
        if (!id) continue;

        const purchaseItem = await tx.purchaseItem.findUnique({ where: { id } });
        if (!purchaseItem) {
            throw new Error(`Stock roll not found for return line ${item.roll_no || id}`);
        }
        if (purchaseItem.status === PurchaseItemStatus.SOLD) {
            throw new Error(
                `Roll ${item.roll_no || purchaseItem.roll_no || id} is sold and cannot be purchase-returned`
            );
        }
        if (
            purchaseItem.status === PurchaseItemStatus.RETURNED &&
            purchaseItem.meters <= EPS
        ) {
            throw new Error(
                `Roll ${item.roll_no || purchaseItem.roll_no || id} was already returned to supplier`
            );
        }

        const available = purchaseItem.meters;
        if (returned > available + EPS) {
            throw new Error(
                `Return quantity exceeds available stock for roll ${item.roll_no || purchaseItem.roll_no || id}`
            );
        }

        const remaining = available - returned;
        if (remaining <= EPS) {
            await tx.purchaseItem.update({
                where: { id },
                data: {
                    status: PurchaseItemStatus.RETURNED,
                    meters: 0,
                },
            });
        } else {
            await tx.purchaseItem.update({
                where: { id },
                data: {
                    meters: roundMeters(remaining),
                    status: PurchaseItemStatus.UNSOLD,
                },
            });
        }

        item.purchase_item_id = id;
        item.roll_id = id;
    }
}

module.exports = {
    EPS,
    roundMeters,
    resolvePurchaseItemId,
    revertPurchaseReturnStock,
    applyPurchaseReturnStock,
};
