const godownService = require('../services/godownService');

class GodownController {

    async getAllGodowns(req, res) {
        try {
            const godowns = await godownService.getAllGodowns();
            res.json({
                status: 'success',
                message: 'Godowns retrieved successfully',
                data: godowns
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async createGodown(req, res) {
        try {
            const { godown_name } = req.body;
            const godown = await godownService.createGodown({
                name: godown_name,
            });
            res.status(201).json({
                status: 'success',
                message: 'Godown created successfully',
                data: godown
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async updateGodown(req, res) {
        try {
            const { godown_name } = req.body;
            const godown = await godownService.updateGodown(req.params.id, {
                name: godown_name,
            });
            res.json({
                status: 'success',
                message: 'Godown updated successfully',
                data: godown
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

    async deleteGodown(req, res) {
        try {
            await godownService.deleteGodown(req.params.id);
            res.status(200).json({
                status: 'success',
                message: 'Godown deleted successfully',
                data: null
            });
        } catch (error) {
            res.status(400).json({
                status: 'error',
                message: error.message,
                data: null
            });
        }
    }

}

module.exports = new GodownController();