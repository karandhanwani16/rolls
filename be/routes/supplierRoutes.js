const express = require('express');
const supplierController = require('../controllers/supplierController');
const { getUserFromToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', getUserFromToken, supplierController.getAllSuppliers);
router.post('/', getUserFromToken, supplierController.createSupplier);
router.put('/:id', getUserFromToken, supplierController.updateSupplier);
router.delete('/:id', getUserFromToken, supplierController.deleteSupplier);
router.get('/purchases-and-payments', getUserFromToken, supplierController.getPurchasesAndPayments);

module.exports = router;