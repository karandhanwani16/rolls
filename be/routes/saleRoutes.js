const express = require('express');
const saleController = require('../controllers/saleController');

const router = express.Router();

router.get('/', saleController.getAllSales);
router.get('/next-number', saleController.getNextSalesNumber);
router.get('/invoice/:id', saleController.generateInvoicePDF);
router.get('/invoice-html/:id', saleController.generateInvoiceHTML);
router.get('/:id', saleController.getSaleById);
router.post('/', saleController.createSale);
router.put('/:id', saleController.updateSale);
router.delete('/:id', saleController.deleteSale);

module.exports = router;