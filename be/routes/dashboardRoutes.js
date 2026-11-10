const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { getUserFromToken } = require('../middleware/auth');

router.get('/', getUserFromToken, dashboardController.getDashboardData);

module.exports = router;