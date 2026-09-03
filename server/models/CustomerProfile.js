const mongoose = require('mongoose');

const customerProfileSchema = new mongoose.Schema({
  buyer_id: { type: String, required: true, unique: true, index: true }, // e.g. 'apex_global', 'titan_bulk', 'nexus_logistics', 'spectre_arbitrage'
  company_name: { type: String, required: true }, // e.g. 'Apex Global Procurement'
  persona_key: { type: String, required: true }, // e.g. 'reasonable', 'lowballer'
  lifetime_spend_inr: { type: Number, default: 0 },
  deals_closed_count: { type: Number, default: 0 },
  deals_attempted_count: { type: Number, default: 0 },
  lowball_strikes: { type: Number, default: 0 },
  trust_score: { type: Number, default: 50, min: 0, max: 100 }, // Dynamic 0-100 score
  loyalty_tier: {
    type: String,
    enum: ['VIP_PARTNER', 'GROWTH_ACCOUNT', 'WATCHLIST', 'CHRONIC_LOWBALLER', 'NEW_PROSPECT'],
    default: 'NEW_PROSPECT'
  },
  discount_elasticity_bonus: { type: Number, default: 0 }, // e.g. +4% for VIP, -3% for lowballer
  payment_reliability_score: { type: Number, default: 100 }, // Percentage (0-100)
  last_deal_summary: { type: String, default: 'No completed transactions recorded yet.' },
  last_negotiated_at: { type: Date, default: null }
}, { timestamps: true });

// Dynamic Scoring & Reputation Drift Method
customerProfileSchema.methods.recalculateTierAndScore = function() {
  if (this.deals_attempted_count === 0 && this.deals_closed_count === 0 && this.lowball_strikes === 0) {
    this.loyalty_tier = 'NEW_PROSPECT';
    this.trust_score = 50;
    this.discount_elasticity_bonus = 0;
    return;
  }

  // Base trust score computation:
  // Starts at 50
  // +12 per deal closed
  // + (lifetime_spend / 25000) capped at +25
  // -15 per lowball strike
  let computedScore = 50 + (this.deals_closed_count * 12) + Math.min(25, Math.floor(this.lifetime_spend_inr / 25000)) - (this.lowball_strikes * 15);
  
  // Bound score strictly between 5 and 100
  this.trust_score = Math.max(5, Math.min(100, Math.round(computedScore)));

  // Dynamic Tier Allocation:
  if (this.trust_score >= 80 || (this.deals_closed_count >= 2 && this.lowball_strikes === 0 && this.lifetime_spend_inr >= 50000)) {
    this.loyalty_tier = 'VIP_PARTNER';
    this.discount_elasticity_bonus = 4; // Unlocks +4% extra concession elasticity
  } else if (this.trust_score >= 50) {
    this.loyalty_tier = 'GROWTH_ACCOUNT';
    this.discount_elasticity_bonus = 1.5; // Unlocks +1.5% flexibility
  } else if (this.trust_score >= 30) {
    this.loyalty_tier = 'WATCHLIST';
    this.discount_elasticity_bonus = -1; // Tighter bounds
  } else {
    this.loyalty_tier = 'CHRONIC_LOWBALLER';
    this.discount_elasticity_bonus = -3; // Anchored strictly near list price
  }
};

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);
