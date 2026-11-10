const express = require('express');
const purchaseController = require('../controllers/purchaseController');

const router = express.Router();

router.get('/report', purchaseController.getPurchaseReport);
router.get('/', purchaseController.getAllPurchases);
router.get('/rolls/:productId', purchaseController.getRollsByProductId);
router.get('/sold-rolls/:productId', purchaseController.getSoldRollsByProductId);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/', purchaseController.createPurchase);
router.put('/:id', purchaseController.updatePurchase);
router.delete('/:id', purchaseController.deletePurchase);

module.exports = router;