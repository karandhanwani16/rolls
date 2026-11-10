const prisma = require('../prisma/client');
const transactionService = require('./transactions');
const { normalizeUnit } = require('../utils/quantityUnits');
const {
    applyPurchaseReturnStock,
    revertPurchaseReturnStock,
} = require('../utils/purchaseReturnStock');

const returnedItems = (items = []) =>
    (items || []).filter((item) => parseFloat(item.meters) > 0);

const mapReturnItems = (purchaseReturnId, items) =>
    items.map((item) => ({
        purchase_return_id: purchaseReturnId,
        product_id: item.product_id,
        product_name: item.product_name,
        purchase_item_id: item.purchase_item_id || item.roll_id || null,
        roll_no: item.roll_no,
        meters: item.meters,
        unit: normalizeUnit(item.unit),
        price: item.price,
        total: item.total_price,
    }));

const nextNumber = async (date) => {
    const now = new Date(date);
    const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const nextYear = currentYear + 1;
    const count = await prisma.purchaseReturn.count({
        where: {
            date: {
                gte: new Date(`${currentYear}-04-01`),
                lte: new Date(`${nextYear}-03-31`)
            }
        }
    });
    return String(count + 1).padStart(5, '0');
};

class PurchaseReturnService {
    async getAll() {
        return prisma.purchaseReturn.findMany({
            include: { supplier: true, items: true },
            orderBy: { created_at: 'desc' }
        });
    }

    async getById(id) {
        const record = await prisma.purchaseReturn.findUnique({
            where: { id },
            include: { supplier: true, items: true, purchase: true }
        });
        if (!record) throw new Error('Purchase return not found');
        return record;
    }

    async getNextNumber(date) {
        return nextNumber(date);
    }

    async create(data) {
        const items = returnedItems(data.items);
        const details = data;
        if (items.length === 0) {
            throw new Error('Enter returned meters for at least one roll');
        }
        const transportCharges = parseFloat(details.transport_charges) || 0;
        const itemsTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
        const total = Math.round(itemsTotal + transportCharges);
        const return_no = details.return_no || await this.getNextNumber(details.return_date);

        return prisma.$transaction(async (tx) => {
            const purchaseReturn = await tx.purchaseReturn.create({
                data: {
                    supplier_id: details.supplier_id,
                    supplier_name: details.supplier_name,
                    purchase_id: details.purchase_id || null,
                    date: new Date(details.return_date),
                    total,
                    return_no,
                    description: details.description,
                    transport_charges: transportCharges
                }
            });

            await applyPurchaseReturnStock(tx, items, details.purchase_id || null);

            if (items && items.length > 0) {
                await tx.purchaseReturnItem.createMany({
                    data: mapReturnItems(purchaseReturn.id, items),
                });
            }

            await transactionService.createTransactionRecord(
                'incoming',
                `Purchase return ${purchaseReturn.return_no} to ${purchaseReturn.supplier_name}`,
                null,
                purchaseReturn.supplier_id,
                purchaseReturn.total
            );

            return tx.purchaseReturn.findUnique({
                where: { id: purchaseReturn.id },
                include: { items: true }
            });
        });
    }

    async update(id, data) {
        const items = returnedItems(data.items);
        const details = data;
        if (items.length === 0) {
            throw new Error('Enter returned meters for at least one roll');
        }
        const transportCharges = parseFloat(details.transport_charges) || 0;
        const itemsTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
        const total = Math.round(itemsTotal + transportCharges);

        return prisma.$transaction(async (tx) => {
            const existing = await tx.purchaseReturn.findUnique({
                where: { id },
                include: { items: true }
            });
            if (!existing) throw new Error('Purchase return not found');

            await revertPurchaseReturnStock(tx, existing.items);

            const purchaseReturn = await tx.purchaseReturn.update({
                where: { id },
                data: {
                    supplier: { connect: { id: details.supplier_id } },
                    supplier_name: details.supplier_name,
                    purchase_id: details.purchase_id || null,
                    date: new Date(details.return_date),
                    total,
                    return_no: details.return_no,
                    description: details.description,
                    transport_charges: transportCharges
                }
            });

            await tx.purchaseReturnItem.deleteMany({ where: { purchase_return_id: id } });

            await applyPurchaseReturnStock(tx, items, details.purchase_id || null);

            if (items && items.length > 0) {
                await tx.purchaseReturnItem.createMany({
                    data: mapReturnItems(purchaseReturn.id, items),
                });
            }

            await transactionService.createTransactionRecord(
                'incoming',
                `Purchase return updated ${purchaseReturn.return_no} to ${purchaseReturn.supplier_name}`,
                null,
                purchaseReturn.supplier_id,
                purchaseReturn.total
            );

            return tx.purchaseReturn.findUnique({
                where: { id: purchaseReturn.id },
                include: { items: true }
            });
        });
    }

    async delete(id) {
        const existing = await prisma.purchaseReturn.findUnique({
            where: { id },
            include: { items: true }
        });
        if (!existing) throw new Error('Purchase return not found');

        await prisma.$transaction(async (tx) => {
            await revertPurchaseReturnStock(tx, existing.items);
            await tx.purchaseReturnItem.deleteMany({ where: { purchase_return_id: id } });
            await tx.purchaseReturn.delete({ where: { id } });
        });
        await transactionService.createTransactionRecord(
            'outgoing',
            `Purchase return deleted ${existing.return_no} to ${existing.supplier_name}`,
            null,
            existing.supplier_id,
            existing.total
        );
        return { message: 'Purchase return deleted successfully' };
    }
}

module.exports = new PurchaseReturnService();
