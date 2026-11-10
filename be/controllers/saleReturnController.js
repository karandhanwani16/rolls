const saleReturnService = require('../services/saleReturnService');

class SaleReturnController {
    async getAll(req, res) {
        try {
            const data = await saleReturnService.getAll();
            return res.json({ success: true, data });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async getById(req, res) {
        try {
            const data = await saleReturnService.getById(req.params.id);
            return res.json({ success: true, data });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async getNextNumber(req, res) {
        try {
            const data = await saleReturnService.getNextNumber(req.query.date);
            return res.json({ success: true, data });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async create(req, res) {
        try {
            const data = await saleReturnService.create(req.body);
            return res.status(201).json({ success: true, data });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async update(req, res) {
        try {
            const data = await saleReturnService.update(req.params.id, req.body);
            return res.json({ success: true, data });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async delete(req, res) {
        try {
            const result = await saleReturnService.delete(req.params.id);
            return res.json({ success: true, message: result.message });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = new SaleReturnController();
