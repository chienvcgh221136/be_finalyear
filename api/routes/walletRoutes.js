const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const checkAuth = require('../middlewares/authMiddleware');

router.get('/me', checkAuth, walletController.getMe);
router.post('/topup', checkAuth, walletController.topup);
router.get('/transactions', checkAuth, walletController.getTransactions);
router.post('/sepay-webhook', walletController.sepayWebhook);

module.exports = router;
