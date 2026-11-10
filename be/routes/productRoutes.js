const express = require('express');
const productController = require('../controllers/productController');
const { getUserFromToken } = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

// Validation middleware
const validateProduct = [
    body('name').notEmpty().withMessage('Product name is required'),
    body('description').optional(),
    body('price').optional().isNumeric().withMessage('Price must be a number'),
    body('color').optional()
];

router.get('/', getUserFromToken, productController.getAllProducts);
router.get('/:id', getUserFromToken, productController.getProductById);
router.post('/', getUserFromToken, validateProduct, productController.createProduct);
router.put('/:id', getUserFromToken, validateProduct, productController.updateProduct);
router.delete('/:id', getUserFromToken, productController.deleteProduct);

module.exports = router;