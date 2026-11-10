const purchaseService = require('../services/purchaseService');

class PurchaseController {
    async getAllPurchases(req, res) {
        try {
            const purchases = await purchaseService.getAllPurchases(req.query.supplier_id);
            return res.json({
                success: true,
                data: purchases
            });
        } catch (error) {
            console.error('Get all purchases error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getPurchaseById(req, res) {
        try {
            const { id } = req.params;
            const purchase = await purchaseService.getPurchaseById(id);
            return res.json({
                success: true,
                data: purchase
            });
        } catch (error) {
            console.error('Get purchase by id error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async createPurchase(req, res) {
        try {
            const purchaseData = req.body;
            const newPurchase = await purchaseService.createPurchase(purchaseData);
            return res.status(201).json({
                success: true,
                data: newPurchase
            });
        } catch (error) {
            console.error('Create purchase error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getRollsByProductId(req, res) {
        try {
            const { productId } = req.params;
            const rolls = await purchaseService.getRollsByProductId(productId);
            return res.json({
                success: true,
                data: rolls
            });
        } catch (error) {
            console.error('Get rolls by product id error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getSoldRollsByProductId(req, res) {
        try {
            const { productId } = req.params;
            const rolls = await purchaseService.getSoldRollsByProductId(productId);
            return res.json({
                success: true,
                data: rolls
            });
        } catch (error) {
            console.error('Get sold rolls by product id error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async updatePurchase(req, res) {
        try {
            const { id } = req.params;
            const purchaseData = req.body;
            const updatedPurchase = await purchaseService.updatePurchase(id, purchaseData);
            return res.json({
                success: true,
                data: updatedPurchase
            });
        } catch (error) {
            console.error('Update purchase error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deletePurchase(req, res) {
        try {
            const { id } = req.params;
            const result = await purchaseService.deletePurchase(id);
            return res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('Delete purchase error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getPurchaseReport(req, res) {
        try {
            const { supplierIds, startDate, endDate } = req.query;
            const supplierIdsArray = supplierIds ? supplierIds.split(',') : [];

            const purchases = await purchaseService.getPurchaseReport({
                supplierIds: supplierIdsArray,
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            });

            return res.json({
                success: true,
                data: purchases
            });
        } catch (error) {
            console.error('Get purchase report error:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new PurchaseController();