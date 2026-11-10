const express = require('express');
const customerController = require('../controllers/customerController');
const { getUserFromToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', getUserFromToken, customerController.getAllCustomers);
router.post('/', getUserFromToken, customerController.createCustomer);
router.put('/:id', getUserFromToken, customerController.updateCustomer);
router.delete('/:id', getUserFromToken, customerController.deleteCustomer);
router.get('/sales-and-payments', getUserFromToken, customerController.getSalesAndPayments);
module.exports = router;