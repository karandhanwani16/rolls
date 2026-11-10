const express = require('express');
const authController = require('../controllers/authController');
const { getUserFromToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.get('/profile', getUserFromToken, authController.getProfile);
router.post('/change-password', getUserFromToken, authController.changePassword);

module.exports = router;