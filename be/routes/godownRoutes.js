const express = require('express');
const godownController = require('../controllers/godownController');
const { getUserFromToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', getUserFromToken, godownController.getAllGodowns);
router.post('/', getUserFromToken, godownController.createGodown);
router.put('/:id', getUserFromToken, godownController.updateGodown);
router.delete('/:id', getUserFromToken, godownController.deleteGodown);

module.exports = router;