const prisma = require('../prisma/client');
const { PurchaseItemStatus } = require('../utils/purchaseItemStatus');
const transactionService = require('./transactions');
const { normalizeUnit } = require('../utils/quantityUnits');

const returnedItems = (items = []) =>
    (items || []).filter((item) => parseFloat(item.meters) > 0);

const fullReturnStockIds = async (tx, items = [], saleId) => {
    const ids = [];
    for (const item of items) {
        const id = item.purchase_item_id || item.roll_id;
        const meters = parseFloat(item.meters) || 0;
        if (!id || meters <= 0) continue;

        let originalMeters = 0;
        if (saleId) {
            const saleItem = await tx.saleItem.findFirst({
                where: { sale_id: saleId, purchase_item_id: id }
            });
            originalMeters = saleItem?.meters || 0;
        }
        if (!originalMeters) {
            const saleItem = await tx.saleItem.findFirst({
                where: { purchase_item_id: id }
            });
            originalMeters = saleItem?.meters || 0;
        }
        if (!originalMeters) {
            const purchaseItem = await tx.purchaseItem.findUnique({ where: { id } });
            originalMeters = purchaseItem?.meters || 0;
        }
        if (originalMeters > 0 && meters + 0.0001 >= originalMeters) {
            ids.push(id);
        }
    }
    return ids;
};

const nextNumber = async (model, date) => {
    const now = new Date(date);
    const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const nextYear = currentYear + 1;
    const count = await prisma[model].count({
        where: {
            date: {
                gte: new Date(`${currentYear}-04-01`),
                lte: new Date(`${nextYear}-03-31`)
            }
        }
    });
    return String(count + 1).padStart(5, '0');
};

class SaleReturnService {
    async getAll() {
        return prisma.saleReturn.findMany({
            include: { customer: true, items: true },
            orderBy: { created_at: 'desc' }
        });
    }

    async getById(id) {
        const record = await prisma.saleReturn.findUnique({
            where: { id },
            include: { customer: true, items: true, sale: true }
        });
        if (!record) throw new Error('Sales return not found');
        return record;
    }

    async getNextNumber(date) {
        return nextNumber('saleReturn', date);
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
            const saleReturn = await tx.saleReturn.create({
                data: {
                    customer_id: details.customer_id,
                    customer_name: details.customer_name,
                    sale_id: details.sale_id || null,
                    date: new Date(details.return_date),
                    total,
                    return_no,
                    description: details.description,
                    transport_charges: transportCharges
                }
            });

            const ids = await fullReturnStockIds(tx, items, details.sale_id);
            if (ids.length > 0) {
                await tx.purchaseItem.updateMany({
                    where: { id: { in: ids } },
                    data: { status: PurchaseItemStatus.UNSOLD }
                });
            }

            if (items && items.length > 0) {
                await tx.saleReturnItem.createMany({
                    data: items.map((item) => ({
                        sale_return_id: saleReturn.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        purchase_item_id: item.purchase_item_id || item.roll_id || null,
                        roll_no: item.roll_no,
                        meters: item.meters,
                        unit: normalizeUnit(item.unit),
                        price: item.price,
                        total: item.total_price
                    }))
                });
            }

            await transactionService.createTransactionRecord(
                'outgoing',
                `Sales return ${saleReturn.return_no} from ${saleReturn.customer_name}`,
                saleReturn.customer_id,
                null,
                saleReturn.total
            );

            return tx.saleReturn.findUnique({
                where: { id: saleReturn.id },
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
            const existing = await tx.saleReturn.findUnique({
                where: { id },
                include: { items: true }
            });
            if (!existing) throw new Error('Sales return not found');

            const existingIds = existing.items
                .filter((item) => item.purchase_item_id)
                .map((item) => item.purchase_item_id);
            if (existingIds.length > 0) {
                await tx.purchaseItem.updateMany({
                    where: { id: { in: existingIds } },
                    data: { status: PurchaseItemStatus.SOLD }
                });
            }

            const saleReturn = await tx.saleReturn.update({
                where: { id },
                data: {
                    customer: { connect: { id: details.customer_id } },
                    customer_name: details.customer_name,
                    sale_id: details.sale_id || null,
                    date: new Date(details.return_date),
                    total,
                    return_no: details.return_no,
                    description: details.description,
                    transport_charges: transportCharges
                }
            });

            await tx.saleReturnItem.deleteMany({ where: { sale_return_id: id } });

            const ids = await fullReturnStockIds(tx, items, details.sale_id);
            if (ids.length > 0) {
                await tx.purchaseItem.updateMany({
                    where: { id: { in: ids } },
                    data: { status: PurchaseItemStatus.UNSOLD }
                });
            }

            if (items && items.length > 0) {
                await tx.saleReturnItem.createMany({
                    data: items.map((item) => ({
                        sale_return_id: saleReturn.id,
                        product_id: item.product_id,
                        product_name: item.product_name,
                        purchase_item_id: item.purchase_item_id || item.roll_id || null,
                        roll_no: item.roll_no,
                        meters: item.meters,
                        unit: normalizeUnit(item.unit),
                        price: item.price,
                        total: item.total_price
                    }))
                });
            }

            await transactionService.createTransactionRecord(
                'outgoing',
                `Sales return updated ${saleReturn.return_no} from ${saleReturn.customer_name}`,
                saleReturn.customer_id,
                null,
                saleReturn.total
            );

            return tx.saleReturn.findUnique({
                where: { id: saleReturn.id },
                include: { items: true }
            });
        });
    }

    async delete(id) {
        const existing = await prisma.saleReturn.findUnique({
            where: { id },
            include: { items: true }
        });
        if (!existing) throw new Error('Sales return not found');

        const ids = existing.items
            .filter((item) => item.purchase_item_id)
            .map((item) => item.purchase_item_id);
        if (ids.length > 0) {
            await prisma.purchaseItem.updateMany({
                where: { id: { in: ids } },
                data: { status: PurchaseItemStatus.SOLD }
            });
        }

        await prisma.saleReturnItem.deleteMany({ where: { sale_return_id: id } });
        await transactionService.createTransactionRecord(
            'incoming',
            `Sales return deleted ${existing.return_no} from ${existing.customer_name}`,
            existing.customer_id,
            null,
            existing.total
        );
        await prisma.saleReturn.delete({ where: { id } });
        return { message: 'Sales return deleted successfully' };
    }
}

module.exports = new SaleReturnService();
