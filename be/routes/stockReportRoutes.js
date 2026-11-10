const express = require('express');
const router = express.Router();
const stockReportController = require('../controllers/stockReportController');

// Get stock data
router.get('/data', stockReportController.getStockData);

// Export stock data
router.get('/export/:format', stockReportController.exportStockData);

module.exports = router;