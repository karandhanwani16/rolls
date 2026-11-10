const express = require('express');
const billToBillPaymentController = require('../controllers/billToBillPaymentController');

const router = express.Router();

router.get('/customer/:customerId', billToBillPaymentController.getCustomerBillPayments);
router.post('/', billToBillPaymentController.processBillPayments);
router.get('/reconcile/:customerId', billToBillPaymentController.getReconciliationData);

// New settlement routes
router.get('/settlements/:customerId', billToBillPaymentController.getSettlements);
router.post('/process', billToBillPaymentController.createSettlement);

// Export routes
router.get('/export/pdf/:customerId', billToBillPaymentController.exportToPDF);
// router.get('/export/excel/:customerId', billToBillPaymentController.exportToExcel);

module.exports = router;