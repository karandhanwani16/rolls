const prisma = require('../prisma/client');
const { generatePDF } = require('../utils/pdfGenerator');
const { generateCSV } = require('../utils/csvGenerator');
const { generateExcel } = require('../utils/excelGenerator');

const getStockData = async(req, res) => {
    try {
        const { productIds } = req.query;
        const productIdsArray = productIds ? productIds.split(',') : [];

        const stockData = await prisma.purchaseItem.findMany({
            where: {
                status: 'UNSOLD',
                ...(productIdsArray.length > 0 && {
                    product_id: { in: productIdsArray }
                })
            },
            include: {
                purchase: {
                    select: {
                        godown: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Get all godowns to map IDs to names
        const godowns = await prisma.godown.findMany();
        const godownMap = godowns.reduce((map, godown) => {
            map[godown.id] = godown.name;
            return map;
        }, {});


        // Format the data with serial numbers and include godown name
        const formattedData = stockData.map((item, index) => ({
            srNo: index + 1,
            product_name: item.product_name,
            roll_no: item.roll_no,
            shade: item.shade || '',
            meters: item.meters,
            unit: item.unit || 'm',
            price: item.price,
            godown: item.purchase?.godown ? godownMap[item.purchase.godown] || 'Unknown' : 'N/A'
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching stock data:', error);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
};

const exportStockData = async(req, res) => {
    try {
        const { productIds } = req.query;
        const { format } = req.params;
        const productIdsArray = productIds ? productIds.split(',') : [];

        const stockData = await prisma.stock.findMany({
            where: {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                },
                ...(productIdsArray.length > 0 && {
                    productId: { in: productIdsArray }
                })
            },
            select: {
                id: true,
                productName: true,
                rollNo: true,
                meters: true,
                price: true,
                date: true
            },
            orderBy: {
                date: 'desc'
            }
        });

        // Format the data with serial numbers
        const formattedData = stockData.map((item, index) => ({
            srNo: index + 1,
            productName: item.productName,
            rollNo: item.rollNo,
            meters: item.meters,
            price: item.price
        }));

        if (format === 'pdf') {
            const pdfBuffer = await generatePDF(formattedData);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=stock-report.pdf');
            res.send(pdfBuffer);
        } else if (format === 'csv') {
            const csvData = generateCSV(formattedData);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=stock-report.csv');
            res.send(csvData);
        } else if (format === 'xlsx') {
            const excelBuffer = generateExcel(formattedData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=stock-report.xlsx');
            res.send(excelBuffer);
        } else {
            res.status(400).json({ error: 'Invalid export format' });
        }
    } catch (error) {
        console.error('Error exporting stock data:', error);
        res.status(500).json({ error: 'Failed to export stock data' });
    }
};

module.exports = {
    getStockData,
    exportStockData
};