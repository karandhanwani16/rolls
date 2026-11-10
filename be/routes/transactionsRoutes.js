const express = require('express');
const router = express.Router();
const transactionsController = require('../controllers/transactionsController');

// Get all transactions
router.get('/', transactionsController.getAll);

// Get a single transaction
router.get('/:id', transactionsController.getById);

// Create a new transaction
router.post('/', transactionsController.create);

// Update a transaction
router.put('/:id', transactionsController.update);

// Delete a transaction
router.delete('/:id', transactionsController.delete);

module.exports = router;