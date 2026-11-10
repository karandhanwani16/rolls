const { PurchaseItemStatus } = require('../utils/purchaseItemStatus');
const prisma = require('../prisma/client');
const transactionService = require('./transactions');
const { normalizeUnit } = require('../utils/quantityUnits');
const {
    allocatePurchaseOutstanding,
    attachPurchaseOutstanding,
} = require('../utils/purchaseOutstanding');

async function syncProductWidthsFromItems(tx, items) {
    const widthByProduct = new Map();
    for (const item of items || []) {
        if (!item.product_id) continue;
        const width = item.width != null ? String(item.width).trim() : '';
        if (!width) continue;
        if (!widthByProduct.has(item.product_id)) {
            widthByProduct.set(item.product_id, width);
        }
    }

    for (const [productId, width] of widthByProduct.entries()) {
        await tx.product.update({
            where: { id: productId },
            data: { width, updated_at: new Date() },
        });
    }
}

class PurchaseService {
    async enrichPurchasesWithPaymentStatus(purchases) {
        if (!purchases || purchases.length === 0) {
            return purchases || [];
        }

        const supplierIds = [...new Set(purchases.map((purchase) => purchase.supplier_id))];
        const [allPurchases, payments, purchaseReturns, suppliers] = await Promise.all([
            prisma.purchase.findMany({
                where: { supplier_id: { in: supplierIds } },
                orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.paymentOut.findMany({
                where: { supplier_id: { in: supplierIds } },
                orderBy: [{ payment_date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.purchaseReturn.findMany({
                where: { supplier_id: { in: supplierIds } },
            }),
            prisma.supplier.findMany({
                where: { id: { in: supplierIds } },
            }),
        ]);

        const remainingById = allocatePurchaseOutstanding({
            purchases: allPurchases,
            payments,
            purchaseReturns,
            suppliers,
        });

        return purchases.map((purchase) =>
            attachPurchaseOutstanding(purchase, remainingById.get(purchase.id))
        );
    }

    async getAllPurchases(supplierId) {
        const purchases = await prisma.purchase.findMany({
            where: supplierId ? { supplier_id: supplierId } : undefined,
            include: {
                supplier: true,
                items: true
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        return this.enrichPurchasesWithPaymentStatus(purchases);
    }

    async getPurchaseById(id) {
        const purchase = await prisma.purchase.findUnique({
            where: { id },
            include: {
                supplier: true,
                items: true
            }
        });

        if (!purchase) {
            throw new Error('Purchase not found');
        }

        const [enriched] = await this.enrichPurchasesWithPaymentStatus([purchase]);
        return enriched;
    }

    async createPurchase(purchaseData) {
        const { items, ...purchaseDetails } = purchaseData;

        return await prisma.$transaction(async(prisma) => {
            // Create the purchase record
            const transportCharges = parseFloat(purchaseDetails.transport_charges) || 0;
            const discount = parseFloat(purchaseDetails.discount) || 0;
            const billUnit = normalizeUnit(purchaseDetails.unit);
            const itemsTotal = (items || []).reduce((sum, item) => sum + (item.total_price || 0), 0);
            const total = Math.round(itemsTotal + transportCharges - discount);

            const purchase = await prisma.purchase.create({
                data: {
                    supplier_id: purchaseDetails.supplier_id,
                    supplier_name: purchaseDetails.supplier_name || '',
                    date: new Date(purchaseDetails.purchase_date), // Convert string date to Date object
                    total,
                    purchase_no: purchaseDetails.purchase_no,
                    description: purchaseDetails.description,
                    godown: purchaseDetails.godown_no,
                    transport: purchaseDetails.transport,
                    transport_charges: transportCharges,
                    discount,
                    credit_days: parseInt(purchaseDetails.credit_days, 10) || 0,
                    unit: billUnit,
                    received_by: purchaseDetails.received_by,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });

            // Create all purchase items
            if (items && items.length > 0) {
                const purchaseItemsData = items.map(item => ({
                    purchase_id: purchase.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    roll_no: item.roll_no,
                    shade: item.shade || null,
                    width: item.width ? String(item.width).trim() || null : null,
                    meters: item.meters,
                    unit: billUnit,
                    price: item.price,
                    total: item.total_price,
                    status: PurchaseItemStatus.UNSOLD,
                    created_at: new Date(),
                    updated_at: new Date()
                }));

                await prisma.purchaseItem.createMany({
                    data: purchaseItemsData
                });

                await syncProductWidthsFromItems(prisma, items);
            }

            // Create transaction record
            await transactionService.createTransactionRecord(
                'outgoing',
                `Purchase ${purchase.purchase_no} from ${purchase.supplier_name}`,
                null,
                purchase.supplier_id,
                purchase.total
            );

            // Return the full purchase with items
            return await prisma.purchase.findUnique({
                where: { id: purchase.id },
                include: { items: true }
            });
        });
    }

    async updatePurchase(id, purchaseData) {
        const { items, ...purchaseDetails } = purchaseData;

        return await prisma.$transaction(async(prisma) => {
            // Update the purchase record
            const transportCharges = parseFloat(purchaseDetails.transport_charges) || 0;
            const discount = parseFloat(purchaseDetails.discount) || 0;
            const billUnit = normalizeUnit(purchaseDetails.unit);
            const itemsTotal = (items || []).reduce((sum, item) => sum + (item.total_price || 0), 0);
            const total = Math.round(itemsTotal + transportCharges - discount);

            const purchase = await prisma.purchase.update({
                where: { id },
                data: {
                    supplier_id: purchaseDetails.supplier_id,
                    supplier_name: purchaseDetails.supplier_name,
                    date: new Date(purchaseDetails.purchase_date),
                    total,
                    purchase_no: purchaseDetails.purchase_no,
                    description: purchaseDetails.description,
                    godown: purchaseDetails.godown,
                    transport: purchaseDetails.transport,
                    transport_charges: transportCharges,
                    discount,
                    credit_days: parseInt(purchaseDetails.credit_days, 10) || 0,
                    unit: billUnit,
                    received_by: purchaseDetails.received_by,
                    updated_at: new Date()
                }
            });

            // Delete existing items to replace with new ones
            await prisma.purchaseItem.deleteMany({
                where: { purchase_id: id }
            });

            // Add new items
            if (items && items.length > 0) {
                const purchaseItemsData = items.map(item => ({
                    purchase_id: purchase.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    roll_no: item.roll_no,
                    shade: item.shade || null,
                    width: item.width ? String(item.width).trim() || null : null,
                    meters: item.meters,
                    unit: billUnit,
                    price: item.price,
                    total: item.total_price,
                    status: PurchaseItemStatus.UNSOLD,
                    created_at: new Date(),
                    updated_at: new Date()
                }));

                await prisma.purchaseItem.createMany({
                    data: purchaseItemsData
                });

                await syncProductWidthsFromItems(prisma, items);
            }

            // Create transaction record for the update
            await transactionService.createTransactionRecord(
                'outgoing',
                `Purchase updated ${purchase.purchase_no} from ${purchase.supplier_name}`,
                null,
                purchase.supplier_id,
                purchase.total
            );

            // Return the updated purchase with items
            return await prisma.purchase.findUnique({
                where: { id: purchase.id },
                include: { items: true }
            });
        });
    }

    async deletePurchase(id) {
        const purchase = await prisma.purchase.findUnique({
            where: { id },
            include: {
                supplier: true
            }
        });

        if (!purchase) {
            throw new Error('Purchase not found');
        }

        // Create transaction record for the deletion
        await transactionService.createTransactionRecord(
            'incoming',
            `Purchase deleted ${purchase.purchase_no} from ${purchase.supplier_name}`,
            null,
            purchase.supplier_id,
            purchase.total
        );

        // Items will cascade delete due to the relation setup
        await prisma.purchase.delete({
            where: { id }
        });

        return { message: 'Purchase deleted successfully' };
    }

    async getRollsByProductId(productId) {
        // get the rolls which are having status UNSOLD from purchase_items table
        const rolls = await prisma.purchaseItem.findMany({
            where: {
                product_id: productId,
                status: PurchaseItemStatus.UNSOLD
            }
        });

        return rolls;
    }

    async getSoldRollsByProductId(productId) {
        const rolls = await prisma.purchaseItem.findMany({
            where: {
                product_id: productId,
                status: PurchaseItemStatus.SOLD
            }
        });

        return rolls;
    }

    async getPurchaseReport({ supplierIds, startDate, endDate }) {
        const where = {
            date: {
                gte: startDate,
                lte: endDate
            }
        };

        if (supplierIds && supplierIds.length > 0) {
            where.supplier_id = { in: supplierIds };
        }

        const purchases = await prisma.purchase.findMany({
            where,
            select: {
                id: true,
                purchase_no: true,
                supplier_id: true,
                godown: true,
                date: true,
                total: true,
                transport: true,
                transport_charges: true,
                credit_days: true,
                received_by: true,
                created_at: true,
                supplier: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            }
        });

        const enrichedPurchases = await this.enrichPurchasesWithPaymentStatus(purchases);

        const purchasesWithGodown = await Promise.all(enrichedPurchases.map(async purchase => ({
            ...purchase,
            godown: await this.getPurchaseGodownName(purchase.godown)
        })));

        return purchasesWithGodown;
    }
    async getPurchaseGodownName(godown) {
        if (!godown) return null;
        const godownDetails = await prisma.godown.findUnique({
            where: { id: godown }
        });
        return godownDetails?.name || null;
    }
}

module.exports = new PurchaseService();