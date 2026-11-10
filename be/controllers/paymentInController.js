const paymentInService = require('../services/paymentInService');

class PaymentInController {
    async getAllPaymentsIn(req, res) {
        try {
            const paymentsIn = await paymentInService.getAllPaymentsIn();
            return res.json({
                success: true,
                data: paymentsIn
            });
        } catch (error) {
            console.error('Get all payments in error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getPaymentInById(req, res) {
        try {
            const { id } = req.params;
            const paymentIn = await paymentInService.getPaymentInById(id);
            return res.json({
                success: true,
                data: paymentIn
            });
        } catch (error) {
            console.error('Get payment in by id error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async createPaymentIn(req, res) {
        try {
            const paymentInData = req.body;
            const newPaymentIn = await paymentInService.createPaymentIn(paymentInData);
            return res.status(201).json({
                success: true,
                data: newPaymentIn
            });
        } catch (error) {
            console.error('Create payment in error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async updatePaymentIn(req, res) {
        try {
            const { id } = req.params;
            const paymentInData = req.body;
            const updatedPaymentIn = await paymentInService.updatePaymentIn(id, paymentInData);
            return res.json({
                success: true,
                data: updatedPaymentIn
            });
        } catch (error) {
            console.error('Update payment in error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deletePaymentIn(req, res) {
        try {
            const { id } = req.params;
            const result = await paymentInService.deletePaymentIn(id);
            return res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('Delete payment in error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getWatavReport(req, res) {
        try {
            const { startDate, endDate, watavCustomerId, collectionStatus, entryType } = req.query;
            const report = await paymentInService.getWatavReport({
                startDate,
                endDate,
                watavCustomerId: watavCustomerId || undefined,
                collectionStatus: collectionStatus || undefined,
                entryType: entryType || undefined,
            });
            return res.json({
                success: true,
                data: report.transactions,
                byWatav: report.byWatav,
                receipts: report.receipts,
                summary: report.summary,
            });
        } catch (error) {
            console.error('Get watav report error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async collectWatavEntries(req, res) {
        try {
            const result = await paymentInService.collectWatavEntries(req.body);
            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Collect watav entries error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async uncollectWatavEntries(req, res) {
        try {
            const result = await paymentInService.uncollectWatavEntries(req.body);
            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Uncollect watav entries error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getWatavVendorReceipts(req, res) {
        try {
            const { vendorId, startDate, endDate } = req.query;
            const receipts = await paymentInService.getWatavVendorReceipts({
                vendorId: vendorId || undefined,
                startDate,
                endDate,
            });
            return res.json({
                success: true,
                data: receipts,
            });
        } catch (error) {
            console.error('Get watav vendor receipts error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getWatavVendorReceiptById(req, res) {
        try {
            const receipt = await paymentInService.getWatavVendorReceiptById(req.params.id);
            return res.json({
                success: true,
                data: receipt,
            });
        } catch (error) {
            console.error('Get watav vendor receipt error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async createWatavVendorReceipt(req, res) {
        try {
            const receipt = await paymentInService.createWatavVendorReceipt(req.body);
            return res.status(201).json({
                success: true,
                data: receipt,
            });
        } catch (error) {
            console.error('Create watav vendor receipt error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteWatavVendorReceipt(req, res) {
        try {
            const result = await paymentInService.deleteWatavVendorReceipt(req.params.id);
            return res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            console.error('Delete watav vendor receipt error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new PaymentInController();
