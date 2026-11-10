
const express = require('express');
const paymentOutController = require('../controllers/paymentOutController');

const router = express.Router();

router.get('/', paymentOutController.getAllPaymentsOut);
router.get('/:id', paymentOutController.getPaymentOutById);
router.post('/', paymentOutController.createPaymentOut);
router.put('/:id', paymentOutController.updatePaymentOut);
router.delete('/:id', paymentOutController.deletePaymentOut);

module.exports = router;
