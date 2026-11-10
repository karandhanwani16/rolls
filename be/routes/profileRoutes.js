
const express = require('express');
const profileController = require('../controllers/profileController');
const { getUserFromToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', getUserFromToken, profileController.getProfile);

module.exports = router;
