const transactionsService = require('../services/transactions');

const transactionsController = {
    getAll: async(req, res) => {
        try {
            const transactions = await transactionsService.getAll();
            res.json(transactions);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getById: async(req, res) => {
        try {
            const transaction = await transactionsService.getById(req.params.id);
            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            res.json(transaction);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    create: async(req, res) => {
        try {
            const transaction = await transactionsService.create(req.body);
            res.status(201).json(transaction);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    update: async(req, res) => {
        try {
            const transaction = await transactionsService.update(req.params.id, req.body);
            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }
            res.json(transaction);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    delete: async(req, res) => {
        try {
            await transactionsService.delete(req.params.id);
            res.json({ message: 'Transaction deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = transactionsController;