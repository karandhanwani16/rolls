const express = require('express');
const saleReturnController = require('../controllers/saleReturnController');

const router = express.Router();

router.get('/', saleReturnController.getAll);
router.get('/next-number', saleReturnController.getNextNumber);
router.get('/:id', saleReturnController.getById);
router.post('/', saleReturnController.create);
router.put('/:id', saleReturnController.update);
router.delete('/:id', saleReturnController.delete);

module.exports = router;
