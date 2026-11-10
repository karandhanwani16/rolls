const express = require('express');
const purchaseReturnController = require('../controllers/purchaseReturnController');

const router = express.Router();

router.get('/', purchaseReturnController.getAll);
router.get('/next-number', purchaseReturnController.getNextNumber);
router.get('/:id', purchaseReturnController.getById);
router.post('/', purchaseReturnController.create);
router.put('/:id', purchaseReturnController.update);
router.delete('/:id', purchaseReturnController.delete);

module.exports = router;
