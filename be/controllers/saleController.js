const saleService = require('../services/saleService');

class SaleController {
    async getAllSales(req, res) {
        try {
            const sales = await saleService.getAllSales(req.query.customer_id);
            return res.json({
                success: true,
                data: sales
            });
        } catch (error) {
            console.error('Get all sales error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getSaleById(req, res) {
        try {
            const { id } = req.params;
            const sale = await saleService.getSaleById(id);
            return res.json({
                success: true,
                data: sale
            });
        } catch (error) {
            console.error('Get sale by id error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async createSale(req, res) {
        try {
            const saleData = req.body;
            const newSale = await saleService.createSale(saleData);
            return res.status(201).json({
                success: true,
                data: newSale
            });
        } catch (error) {
            console.error('Create sale error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateSale(req, res) {
        try {
            const { id } = req.params;
            const saleData = req.body;
            const updatedSale = await saleService.updateSale(id, saleData);
            return res.json({
                success: true,
                data: updatedSale
            });
        } catch (error) {
            console.error('Update sale error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteSale(req, res) {
        try {
            const { id } = req.params;
            const result = await saleService.deleteSale(id);
            return res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('Delete sale error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getNextSalesNumber(req, res) {
        try {
            const { date } = req.query;
            const nextSalesNumber = await saleService.getNextSalesNumber(date);
            return res.json({ success: true, data: nextSalesNumber });
        } catch (error) {
            console.error('Get next sales number error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async generateInvoicePDF(req, res) {
        try {
            const documentType = req.query.type === 'challan' ? 'challan' : 'bill';
            const showInterestNote =
                req.query.showInterestNote === 'true' ||
                req.query.showInterestNote === '1';
            const pdfBuffer = await saleService.generateInvoicePDF(
                req.params.id,
                documentType,
                { showInterestNote }
            );
            console.log("pdfBuffer", pdfBuffer);
            res.contentType('application/pdf');
            res.send(pdfBuffer);

            // res.json({
            //     success: true,
            //     data: pdfBase64
            // });
        } catch (error) {
            console.error('Error generating invoice PDF:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate invoice PDF'
            });
        }
    }

    async generateInvoiceHTML(req, res) {
        try {
            const documentType = req.query.type === 'challan' ? 'challan' : 'bill';
            const showInterestNote =
                req.query.showInterestNote === 'true' ||
                req.query.showInterestNote === '1';
            const html = await saleService.generateInvoiceHTML(
                req.params.id,
                documentType,
                { showInterestNote }
            );
            return res.json({
                success: true,
                data: html
            });
        } catch (error) {
            console.error('Error generating invoice HTML:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new SaleController();