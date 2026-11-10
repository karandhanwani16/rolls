const billToBillPaymentService = require('../services/billToBillPaymentService');
const prisma = require('../prisma/client');
// const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

class BillToBillPaymentController {
    async getCustomerBillPayments(req, res) {
        try {
            const { customerId } = req.params;
            const billPayments = await billToBillPaymentService.getCustomerBillPayments(customerId);
            return res.json({
                success: true,
                data: billPayments
            });
        } catch (error) {
            console.error('Get customer bill payments error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async processBillPayments(req, res) {
        try {
            const billPaymentData = req.body;
            const result = await billToBillPaymentService.processBillPayments(billPaymentData);
            return res.status(201).json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Process bill payments error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getReconciliationData(req, res) {
        try {
            const { customerId } = req.params;
            const reconciliationData = await billToBillPaymentService.getReconciliationData(customerId);
            return res.json({
                success: true,
                data: reconciliationData
            });
        } catch (error) {
            console.error('Get reconciliation data error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getSettlements(req, res) {
        try {
            const { customerId } = req.params;
            const settlements = await prisma.billSettlement.findMany({
                where: {
                    bill_payment: {
                        customer_id: customerId
                    }
                },
                include: {
                    bill_payment: true
                },
                orderBy: {
                    settlement_date: 'desc'
                }
            });
            return res.json({
                success: true,
                data: settlements
            });
        } catch (error) {
            console.error('Get settlements error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async createSettlement(req, res) {
        try {
            const { customerId, total_amount, overflow_amount, description, sales } = req.body;

            // First create the bill payment
            const billPayment = await prisma.billToBillPayment.create({
                data: {
                    customer_id: customerId,
                    bill_clear_date: new Date(),
                    bill_latest_clear_date: new Date(),
                    bill_overflow_amount: overflow_amount,
                    details: {
                        create: sales.map(sale => ({
                            sale_id: sale.id,
                            cleared_amount: sale.cleared_amount,
                            status: sale.status
                        }))
                    }
                }
            });

            // Then create the settlement record
            const settlement = await prisma.billSettlement.create({
                data: {
                    bill_payment: {
                        connect: {
                            id: billPayment.id
                        }
                    },
                    settlement_date: new Date(),
                    total_amount: total_amount,
                    overflow_amount: overflow_amount,
                    description
                }
            });

            return res.status(201).json({
                success: true,
                data: {
                    billPayment,
                    settlement
                }
            });
        } catch (error) {
            console.error('Create settlement error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async exportToPDF(req, res) {
        try {
            const { customerId } = req.params;
            const doc = new PDFDocument();

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=bill-settlements-${customerId}.pdf`);

            // Pipe the PDF to the response
            doc.pipe(res);

            // Get settlements data
            const settlements = await prisma.billSettlement.findMany({
                where: {
                    bill_payment: {
                        customer_id: customerId
                    }
                },
                include: {
                    bill_payment: true
                },
                orderBy: {
                    settlement_date: 'desc'
                }
            });

            // Add content to PDF
            doc.fontSize(20).text('Bill Settlements Report', { align: 'center' });
            doc.moveDown();

            settlements.forEach(settlement => {
                doc.fontSize(12)
                    .text(`Settlement Date: ${new Date(settlement.settlement_date).toLocaleDateString()}`)
                    .text(`Total Amount: ${settlement.total_amount}`)
                    .text(`Overflow Amount: ${settlement.overflow_amount}`)
                    .text(`Description: ${settlement.description || 'N/A'}`)
                    .moveDown();
            });

            // Finalize the PDF
            doc.end();
        } catch (error) {
            console.error('Export to PDF error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    // async exportToExcel(req, res) {
    //     try {
    //         const { customerId } = req.params;
    //         const workbook = new ExcelJS.Workbook();
    //         const worksheet = workbook.addWorksheet('Bill Settlements');

    //         // Get settlements data
    //         const settlements = await prisma.billSettlement.findMany({
    //             where: {
    //                 bill_payment: {
    //                     customer_id: customerId
    //                 }
    //             },
    //             include: {
    //                 bill_payment: true
    //             },
    //             orderBy: {
    //                 settlement_date: 'desc'
    //             }
    //         });

    //         // Add headers
    //         worksheet.columns = [
    //             { header: 'Settlement Date', key: 'date', width: 15 },
    //             { header: 'Total Amount', key: 'total', width: 15 },
    //             { header: 'Overflow Amount', key: 'overflow', width: 15 },
    //             { header: 'Description', key: 'description', width: 30 }
    //         ];

    //         // Add data
    //         settlements.forEach(settlement => {
    //             worksheet.addRow({
    //                 date: new Date(settlement.settlement_date).toLocaleDateString(),
    //                 total: settlement.total_amount,
    //                 overflow: settlement.overflow_amount,
    //                 description: settlement.description || 'N/A'
    //             });
    //         });

    //         // Set response headers
    //         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    //         res.setHeader('Content-Disposition', `attachment; filename=bill-settlements-${customerId}.xlsx`);

    //         // Write to response
    //         await workbook.xlsx.write(res);
    //         res.end();
    //     } catch (error) {
    //         console.error('Export to Excel error:', error);
    //         return res.status(400).json({
    //             success: false,
    //             error: error.message
    //         });
    //     }
    // }
}

module.exports = new BillToBillPaymentController();