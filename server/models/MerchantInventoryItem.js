const mongoose = require('mongoose');

const discountTierSchema = new mongoose.Schema({
  min_qty: { type: Number, required: true },
  max_discount_pct: { type: Number, required: true }
}, { _id: false });

const merchantInventoryItemSchema = new mongoose.Schema({
  product_id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  list_price: { type: Number, required: true },
  target_price: { type: Number, required: true },
  floor_price: { type: Number, required: true },
  negotiable: { type: Boolean, default: true },
  discount_ladder: [discountTierSchema],
  stock_level: { type: Number, default: 100 },
  floor_price_updated_at: { type: Date, default: Date.now },
  description: { type: String, default: '' },
  unit: { type: String, default: 'units' }
}, { timestamps: true });

module.exports = mongoose.model('MerchantInventoryItem', merchantInventoryItemSchema);
