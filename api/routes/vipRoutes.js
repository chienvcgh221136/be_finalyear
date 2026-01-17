const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
const checkAuth = require('../middlewares/authMiddleware');

router.get('/packages', vipController.getPackages); // Public? Or auth? Public is better to see pricing
router.post('/purchase', checkAuth, vipController.purchaseVip);
router.get('/me', checkAuth, vipController.getMyVip);

module.exports = router;
