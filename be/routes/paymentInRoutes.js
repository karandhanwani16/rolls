const express = require('express');
const paymentInController = require('../controllers/paymentInController');

const router = express.Router();

router.get('/', paymentInController.getAllPaymentsIn);
router.get('/watav-report', paymentInController.getWatavReport);
router.get('/watav-receipts', paymentInController.getWatavVendorReceipts);
router.get('/watav-receipts/:id', paymentInController.getWatavVendorReceiptById);
router.post('/watav-receipts', paymentInController.createWatavVendorReceipt);
router.delete('/watav-receipts/:id', paymentInController.deleteWatavVendorReceipt);
router.post('/collect', paymentInController.collectWatavEntries);
router.post('/uncollect', paymentInController.uncollectWatavEntries);
router.get('/:id', paymentInController.getPaymentInById);
router.post('/', paymentInController.createPaymentIn);
router.put('/:id', paymentInController.updatePaymentIn);
router.delete('/:id', paymentInController.deletePaymentIn);

module.exports = router;
