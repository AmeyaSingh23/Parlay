const mongoose = require('mongoose');

const negotiationSessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, unique: true, index: true },
  product_id: { type: String, required: true, ref: 'MerchantInventoryItem' },
  product_name: { type: String, default: '' },
  buyer_persona: {
    type: String,
    enum: ['reasonable', 'aggressive_lowballer', 'generous', 'floor_tester'],
    required: true
  },
  quantity: { type: Number, required: true, default: 1 },
  status: {
    type: String,
    enum: ['ongoing', 'deal_closed', 'no_deal', 'blocked_by_firewall', 'pending_hitl'],
    default: 'ongoing',
    index: true
  },
  final_price: { type: Number, default: null },
  floor_price_snapshot: { type: Number, default: null },
  target_price_snapshot: { type: Number, default: null },
  list_price_snapshot: { type: Number, default: null },
  razorpay_order_id: { type: String, default: null },
  rounds_count: { type: Number, default: 0 },
  hitl_action: { type: String, enum: ['approved', 'rejected', null], default: null },
  hitl_reason: { type: String, default: null },
  pending_proposed_price: { type: Number, default: null },
  closed_at: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('NegotiationSession', negotiationSessionSchema);
