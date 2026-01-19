const express = require('express');
const router = express.Router();
const vipController = require('../controllers/vipController');
const checkAuth = require('../middlewares/authMiddleware');

router.get('/packages', vipController.getPackages); // Public? Or auth? Public is better to see pricing
router.post('/purchase', checkAuth, vipController.purchaseVip);
router.get('/me', checkAuth, vipController.getMyVip);

// Admin Routes
const checkRole = require('../middlewares/roleMiddleware');

router.post('/packages', checkAuth, checkRole(['ADMIN']), vipController.createPackage);
router.put('/packages/:id', checkAuth, checkRole(['ADMIN']), vipController.updatePackage);
router.patch('/packages/:id', checkAuth, checkRole(['ADMIN']), vipController.deletePackage); // Soft delete using PATCH
router.get('/admin/stats', checkAuth, checkRole(['ADMIN']), vipController.getAdminStats);
router.get('/admin/users', checkAuth, checkRole(['ADMIN']), vipController.getVipUsers);

module.exports = router;
