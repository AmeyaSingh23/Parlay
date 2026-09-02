const mongoose = require('mongoose');

const negotiationMessageSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true },
  sender: {
    type: String,
    enum: ['buyer', 'merchant', 'firewall', 'system', 'human'],
    required: true
  },
  message: { type: String, required: true },
  proposed_price: { type: Number, default: null },
  policy_reason: { type: String, default: '' },
  firewall_result: {
    type: String,
    enum: ['pass', 'blocked', 'n/a'],
    default: 'n/a'
  },
  firewall_details: {
    live_floor: { type: Number, default: null },
    reason: { type: String, default: null }
  },
  round: { type: Number, default: 1 },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('NegotiationMessage', negotiationMessageSchema);
