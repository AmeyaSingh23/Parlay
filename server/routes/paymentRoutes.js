const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyPayment, agentPay, linkCallback, linkStatus } = require('../controllers/razorpayController');

// All payment routes are secured by session_id validation and Razorpay HMAC cryptographic verification
router.post('/create-order', createRazorpayOrder);
router.post('/verify', verifyPayment);
router.post('/agent-pay', agentPay);
router.get('/link-callback', linkCallback);
router.get('/link-status/:session_id', linkStatus);

module.exports = router;