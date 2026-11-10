const supplierBillToBillPaymentService = require('../services/supplierBillToBillPaymentService');

class SupplierBillToBillPaymentController {
    async getSupplierBillPayments(req, res) {
        try {
            const { supplierId } = req.params;
            const billPayments =
                await supplierBillToBillPaymentService.getSupplierBillPayments(supplierId);
            return res.json({
                success: true,
                data: billPayments,
            });
        } catch (error) {
            console.error('Get supplier bill payments error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async getReconciliationData(req, res) {
        try {
            const { supplierId } = req.params;
            const reconciliationData =
                await supplierBillToBillPaymentService.getReconciliationData(supplierId);
            return res.json({
                success: true,
                data: reconciliationData,
            });
        } catch (error) {
            console.error('Get supplier reconciliation data error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async getSettlements(req, res) {
        try {
            const { supplierId } = req.params;
            const settlements =
                await supplierBillToBillPaymentService.getSettlements(supplierId);
            return res.json({
                success: true,
                data: settlements,
            });
        } catch (error) {
            console.error('Get supplier settlements error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }

    async createSettlement(req, res) {
        try {
            const result = await supplierBillToBillPaymentService.createSettlement(req.body);
            return res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Create supplier settlement error:', error);
            return res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
}

module.exports = new SupplierBillToBillPaymentController();
