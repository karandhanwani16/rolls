const express = require('express');
const router = express.Router();
const pendingBillsReportController = require('../controllers/pendingBillsReportController');

router.get('/customers', pendingBillsReportController.getCustomerPendingBills);
router.get('/suppliers', pendingBillsReportController.getSupplierPendingBills);

module.exports = router;
