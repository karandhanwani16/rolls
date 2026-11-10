/**
 * One-time repair for purchase returns created before stock deduction was applied.
 * Recomputes purchase item meters/status from all purchase_return_items.
 *
 * Usage: node scripts/repair-purchase-return-stock.js
 */
const prisma = require('../prisma/client');
const { PurchaseItemStatus } = require('../utils/purchaseItemStatus');
const { EPS, roundMeters } = require('../utils/purchaseReturnStock');

async function main() {
    const returnLines = await prisma.purchaseReturnItem.findMany({
        where: { purchase_item_id: { not: null } },
        select: { purchase_item_id: true, meters: true },
    });

    const returnedByItem = new Map();
    for (const line of returnLines) {
        const id = line.purchase_item_id;
        const meters = parseFloat(line.meters) || 0;
        if (!id || meters <= 0) continue;
        returnedByItem.set(id, (returnedByItem.get(id) || 0) + meters);
    }

    let updated = 0;
    for (const [purchaseItemId, totalReturned] of returnedByItem.entries()) {
        const item = await prisma.purchaseItem.findUnique({ where: { id: purchaseItemId } });
        if (!item || item.status === PurchaseItemStatus.SOLD) continue;

        const baselineMeters =
            item.status === PurchaseItemStatus.RETURNED && item.meters <= EPS
                ? totalReturned
                : item.meters;

        const remaining = baselineMeters - totalReturned;
        if (remaining <= EPS) {
            await prisma.purchaseItem.update({
                where: { id: purchaseItemId },
                data: { status: PurchaseItemStatus.RETURNED, meters: 0 },
            });
            updated += 1;
            continue;
        }

        const nextMeters = roundMeters(remaining);
        if (nextMeters !== item.meters || item.status !== PurchaseItemStatus.UNSOLD) {
            await prisma.purchaseItem.update({
                where: { id: purchaseItemId },
                data: { status: PurchaseItemStatus.UNSOLD, meters: nextMeters },
            });
            updated += 1;
        }
    }

    console.log(`Repaired stock for ${updated} purchase item(s).`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
