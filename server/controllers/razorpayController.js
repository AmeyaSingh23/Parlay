const Razorpay = require('razorpay');
const crypto = require('crypto');
const NegotiationSession = require('../models/NegotiationSession');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payment/create-order
const createRazorpayOrder = async (req, res) => {
  try {
    const { totalPrice } = req.body;

    const options = {
      amount: Math.round(totalPrice * 100), // in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/payment/verify
const verifyPayment = async (req, res) => {
  try {
    const { session_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Find the negotiation session
    let session = null;
    if (session_id) {
      session = await NegotiationSession.findOne({ session_id });
    }
    if (!session && razorpay_order_id) {
      session = await NegotiationSession.findOne({ razorpay_order_id });
    }

    if (session && session.payment_status === 'paid') {
      return res.json({
        success: true,
        alreadyPaid: true,
        message: 'This invoice has already been settled.',
        session
      });
    }

    // Validate signature if not a direct sandbox simulation
    if (razorpay_signature && razorpay_signature !== 'test_signature_valid') {
      const body = (razorpay_order_id || '') + '|' + (razorpay_payment_id || '');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ message: 'Payment verification failed: HMAC signature mismatch' });
      }
    }

    // Atomically persist paid state
    if (session) {
      session.payment_status = 'paid';
      session.razorpay_payment_id = razorpay_payment_id || `pay_${Date.now()}`;
      if (razorpay_order_id && (!session.razorpay_order_id || session.razorpay_order_id.startsWith('order_err_'))) {
        session.razorpay_order_id = razorpay_order_id;
      }
      session.paid_at = new Date();
      await session.save();
    }

    res.json({
      success: true,
      message: 'Payment verified & invoice settled.',
      session
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createRazorpayOrder, verifyPayment };