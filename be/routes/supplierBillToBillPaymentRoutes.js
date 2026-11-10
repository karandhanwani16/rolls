const express = require('express');
const supplierBillToBillPaymentController = require('../controllers/supplierBillToBillPaymentController');

const router = express.Router();

router.get(
    '/supplier/:supplierId',
    supplierBillToBillPaymentController.getSupplierBillPayments
);
router.get(
    '/reconcile/:supplierId',
    supplierBillToBillPaymentController.getReconciliationData
);
router.get(
    '/settlements/:supplierId',
    supplierBillToBillPaymentController.getSettlements
);
router.post('/process', supplierBillToBillPaymentController.createSettlement);

module.exports = router;
