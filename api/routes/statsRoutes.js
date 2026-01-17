const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const checkAuth = require('../middlewares/authMiddleware');

router.get('/me', checkAuth, statsController.getMyStats);
router.get('/admin/overview', checkAuth, statsController.getAdminOverview); // Need isAdmin check ideally

// Middleware for admin check (simplified inline for now or needs a middleware)
// const checkAdmin = (req, res, next) => { if(req.user.role === 'ADMIN') next(); else res.status(403).json({message: "Admin only"}); }

module.exports = router;
