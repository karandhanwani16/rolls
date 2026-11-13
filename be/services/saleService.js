const prisma = require('../prisma/client');
const { format } = require('date-fns');
const { PurchaseItemStatus } = require('../utils/purchaseItemStatus');
const invoiceTemplate = require('./invoiceTemplate');

function loadPuppeteer() {
    try {
        return require('puppeteer');
    } catch (error) {
        throw new Error(
            'PDF generation requires puppeteer/Chrome, which is not bundled in this USB build'
        );
    }
}
const transactionService = require('./transactions');
const { normalizeUnit } = require('../utils/quantityUnits');
const {
    allocateSaleOutstanding,
    attachSaleOutstanding,
} = require('../utils/saleOutstanding');

const customerPaymentFilter = {
    NOT: {
        payment_category: 'VATAV',
        entry_type: 'STANDALONE',
    },
};

class SaleService {
    async enrichSalesWithPaymentStatus(sales) {
        if (!sales || sales.length === 0) {
            return sales || [];
        }

        const customerIds = [...new Set(sales.map((sale) => sale.customer_id))];
        const [allSales, payments, saleReturns, customers] = await Promise.all([
            prisma.sale.findMany({
                where: { customer_id: { in: customerIds } },
                orderBy: [{ date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.paymentIn.findMany({
                where: {
                    actual_id: { in: customerIds },
                    ...customerPaymentFilter,
                },
                orderBy: [{ payment_date: 'asc' }, { created_at: 'asc' }],
            }),
            prisma.saleReturn.findMany({
                where: { customer_id: { in: customerIds } },
            }),
            prisma.customer.findMany({
                where: { id: { in: customerIds } },
            }),
        ]);

        const remainingById = allocateSaleOutstanding({
            sales: allSales,
            payments,
            saleReturns,
            customers,
        });

        return sales.map((sale) =>
            attachSaleOutstanding(sale, remainingById.get(sale.id))
        );
    }

    async getAllSales(customerId) {
        const sales = await prisma.sale.findMany({
            where: customerId ? { customer_id: customerId } : undefined,
            include: {
                customer: true,
                items: true,
            },
            orderBy: {
                created_at: 'desc'
            }
        });
        return this.enrichSalesWithPaymentStatus(sales);
    }

    async getSaleById(id) {
        const sale = await prisma.sale.findUnique({
            where: { id },
            include: {
                customer: true,
                items: true,
                godown: true,
            }
        });

        if (!sale) {
            throw new Error('Sale not found');
        }

        const [enriched] = await this.enrichSalesWithPaymentStatus([sale]);
        return enriched;
    }

    async getNextSalesNumber(date) {
        // Get the current financial year
        const now = new Date(date);

        const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

        const nextYear = currentYear + 1;

        const financialYearStart = `${currentYear}-04-01`;
        const financialYearEnd = `${nextYear}-03-31`;

        // Count sales in current financial year
        const salesCount = await prisma.sale.count({
            where: {
                date: {
                    gte: new Date(financialYearStart),
                    lte: new Date(financialYearEnd)
                }
            }
        });

        console.log("salesCount", salesCount);

        // Format as 00001, 00002, etc.
        return String(salesCount + 1).padStart(5, '0');
    }

    async createSale(saleData) {
        const { items, ...saleDetails } = saleData;

        return await prisma.$transaction(async(prisma) => {
            // Generate sales number if not provided
            if (!saleDetails.sales_no) {
                saleDetails.sales_no = await this.generateSalesNumber();
            }

            const transportCharges = parseFloat(saleDetails.transport_charges) || 0;
            const discount = parseFloat(saleDetails.discount) || 0;
            const billUnit = normalizeUnit(saleDetails.unit);
            const itemsTotal = (items || []).reduce((sum, item) => sum + (item.total_price || 0), 0);
            const total = Math.round(itemsTotal + transportCharges - discount);

            // Create the sale record
            const sale = await prisma.sale.create({
                data: {
                    customer_id: saleDetails.customer_id,
                    customer_name: saleDetails.customer_name,
                    date: new Date(saleDetails.sales_date),
                    total,
                    sales_no: saleDetails.sales_no,
                    description: saleDetails.description,
                    godown_id: saleDetails.godown_no,
                    maker: saleDetails.maker,
                    challan_no: saleDetails.challan_no,
                    sales_by: saleDetails.sales_by,
                    transport_charges: transportCharges,
                    discount,
                    credit_days: parseInt(saleDetails.credit_days, 10) || 0,
                    unit: billUnit,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });

            // Create all sale items and update purchase items status
            if (items && items.length > 0) {
                // Filter items that have purchase_item_id (stock rolls) and update their status to SOLD
                const stockRollIds = items
                    .filter(item => item.roll_id && item.purchase_item_id)
                    .map(item => item.roll_id);

                if (stockRollIds.length > 0) {
                    await prisma.purchaseItem.updateMany({
                        where: {
                            id: { in: stockRollIds }
                        },
                        data: {
                            status: PurchaseItemStatus.SOLD
                        }
                    });
                }

                // Then create sale items (both stock and custom rolls)
                const saleItemsData = items.map(item => ({
                    sale_id: sale.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    purchase_item_id: item.roll_id || null, // Can be null for custom rolls
                    roll_no: item.roll_no,
                    shade: item.shade || null,
                    width: item.width ? String(item.width).trim() || null : null,
                    meters: item.meters,
                    unit: billUnit,
                    price: item.price,
                    total: item.total_price,
                    created_at: new Date(),
                    updated_at: new Date()
                }));

                await prisma.saleItem.createMany({
                    data: saleItemsData
                });
            }

            // Create transaction record
            await transactionService.createTransactionRecord(
                'incoming',
                `Sale ${sale.sales_no} to ${sale.customer_name}`,
                sale.customer_id,
                null,
                sale.total
            );

            // Return the full sale with items
            return await prisma.sale.findUnique({
                where: { id: sale.id },
                include: { items: true }
            });
        });
    }

    async updateSale(id, saleData) {
        const { items, ...saleDetails } = saleData;

        const transportCharges = parseFloat(saleDetails.transport_charges) || 0;
        const discount = parseFloat(saleDetails.discount) || 0;
        const billUnit = normalizeUnit(saleDetails.unit);
        const actualTotal = (items || []).reduce((sum, item) => {
            return sum + (item.total_price || 0)
        }, 0) + transportCharges - discount
        const roundedTotal = Math.round(actualTotal);


        return await prisma.$transaction(async(prisma) => {
            // Get existing sale items to revert their purchase items status
            const existingSale = await prisma.sale.findUnique({
                where: { id },
                include: { items: true }
            });

            if (existingSale && existingSale.items.length > 0) {
                // Revert only stock rolls (items with purchase_item_id) to UNSOLD
                const existingStockRollIds = existingSale.items
                    .filter(item => item.purchase_item_id)
                    .map(item => item.purchase_item_id);

                if (existingStockRollIds.length > 0) {
                    await prisma.purchaseItem.updateMany({
                        where: {
                            id: { in: existingStockRollIds }
                        },
                        data: {
                            status: PurchaseItemStatus.UNSOLD
                        }
                    });
                }
            }

            // Update the sale record
            const customerId = saleDetails.customer_id || existingSale?.customer_id;
            if (!customerId) {
                throw new Error('Customer is required to update the sale');
            }

            const customerExists = await prisma.customer.findUnique({
                where: { id: customerId },
                select: { id: true, name: true },
            });
            if (!customerExists) {
                throw new Error(
                    'Selected customer was not found. Please re-select the customer and try again.'
                );
            }

            const sale = await prisma.sale.update({
                where: { id },
                data: {
                    customer_id: customerId,
                    godown_id: saleDetails.godown_no || null,
                    customer_name: saleDetails.customer_name || customerExists.name,
                    date: new Date(saleDetails.sales_date),
                    total: roundedTotal,
                    sales_no: saleDetails.sales_no,
                    description: saleDetails.description,
                    maker: saleDetails.maker,
                    challan_no: saleDetails.challan_no,
                    sales_by: saleDetails.sales_by,
                    transport_charges: transportCharges,
                    discount,
                    credit_days: parseInt(saleDetails.credit_days, 10) || 0,
                    unit: billUnit,
                    updated_at: new Date()
                }
            });


            // Delete existing sale items
            await prisma.saleItem.deleteMany({
                where: { sale_id: id }
            });

            // Create new sale items and update purchase items status
            if (items && items.length > 0) {
                // Update only stock rolls (items with purchase_item_id) to SOLD
                const newStockRollIds = items
                    .filter(item => item.purchase_item_id)
                    .map(item => item.purchase_item_id);

                if (newStockRollIds.length > 0) {
                    await prisma.purchaseItem.updateMany({
                        where: {
                            id: { in: newStockRollIds }
                        },
                        data: {
                            status: PurchaseItemStatus.SOLD
                        }
                    });
                }

                // Create new sale items (both stock and custom rolls)
                const saleItemsData = items.map(item => ({
                    sale_id: sale.id,
                    product_id: item.product_id,
                    product_name: item.product_name,
                    purchase_item_id: item.purchase_item_id || null, // Can be null for custom rolls
                    roll_no: item.roll_no,
                    shade: item.shade || null,
                    width: item.width ? String(item.width).trim() || null : null,
                    meters: item.meters,
                    unit: billUnit,
                    price: item.price,
                    total: item.total_price,
                    created_at: new Date(),
                    updated_at: new Date()
                }));

                await prisma.saleItem.createMany({
                    data: saleItemsData
                });
            }

            // Create transaction record for the update
            await transactionService.createTransactionRecord(
                'incoming',
                `Sale updated ${sale.sales_no} to ${sale.customer_name}`,
                sale.customer_id,
                null,
                sale.total
            );

            // Return the updated sale with items
            return await prisma.sale.findUnique({
                where: { id: sale.id },
                include: { items: true }
            });
        });
    }

    async deleteSale(id) {
        const existingSale = await prisma.sale.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!existingSale) {
            throw new Error('Sale not found');
        }

        // Revert only stock rolls (items with purchase_item_id) to UNSOLD
        const stockRollIds = existingSale.items
            .filter(item => item.purchase_item_id)
            .map(item => item.purchase_item_id);

        if (stockRollIds.length > 0) {
            await prisma.purchaseItem.updateMany({
                where: {
                    id: { in: stockRollIds }
                },
                data: {
                    status: PurchaseItemStatus.UNSOLD
                }
            });
        }

        // Delete all sale items
        await prisma.saleItem.deleteMany({
            where: { sale_id: id }
        });

        // Create transaction record for the deletion
        await transactionService.createTransactionRecord(
            'outgoing',
            `Sale deleted ${existingSale.sales_no} for ${existingSale.customer_name}`,
            existingSale.customer_id,
            null,
            existingSale.total
        );

        // Delete the sale
        await prisma.sale.delete({
            where: { id }
        });

        return { message: 'Sale deleted successfully' };
    }

    async generateInvoicePDF(saleId, documentType = 'bill', options = {}) {
        try {
            const html = await this.generateInvoiceHTML(saleId, documentType, options);

            const puppeteer = loadPuppeteer();
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();

            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
                margin: {
                    top: '0',
                    right: '0',
                    bottom: '0',
                    left: '0'
                }
            });

            await browser.close();
            return pdfBuffer;
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw new Error('Failed to generate invoice PDF');
        }
    }

    async generateInvoiceHTML(saleId, documentType = 'bill', options = {}) {
        try {
            const sale = await this.getSaleById(saleId);
            const showInterestNote = Boolean(options.showInterestNote);
            const saleCreditDays = parseInt(sale.credit_days, 10) || 0;
            const customerCreditDays = parseInt(sale.customer?.credit_days, 10) || 0;
            const creditDays = saleCreditDays || customerCreditDays || 0;

            const invoiceData = {
                customer: sale.customer_name,
                firm_name: sale.customer?.description || '',
                date: format(new Date(sale.date), 'dd/MM/yyyy'),
                unit: sale.unit || sale.items?.[0]?.unit || 'm',
                items: sale.items.map(item => ({
                    name: item.product_name,
                    qty: item.meters,
                    price: item.price,
                    width: item.width || '',
                    roll_no: item.roll_no,
                    shade: item.shade || '',
                    mts: item.meters,
                    unit: sale.unit || item.unit || 'm',
                    amount: item.total,
                })),
                total: sale.total,
                transport_charges: sale.transport_charges || 0,
                discount: sale.discount || 0,
                sales_no: sale.sales_no,
                challan_no: sale.challan_no,
                godown: sale.godown?.name || '',
                maker: sale.maker,
                credit_days: creditDays,
                showInterestNote,
            };
            return invoiceTemplate(invoiceData, documentType);
        } catch (error) {
            console.error('Error generating invoice HTML:', error);
            throw new Error('Failed to generate invoice HTML');
        }
    }
}

module.exports = new SaleService();