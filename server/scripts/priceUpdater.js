require('dotenv').config({ path: __dirname + '/../.env' });
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const mongoose = require('mongoose');
const MerchantInventoryItem = require('../models/MerchantInventoryItem');

/**
 * Dynamic price updater script simulating inventory demand shifts (PRD Section 10).
 * Usage:
 *   node scripts/priceUpdater.js [product_id] [new_floor] [new_target] [stock_level]
 * Example:
 *   node scripts/priceUpdater.js SKU-LED-1001 920 1080 30
 */
async function updatePrice() {
  const args = process.argv.slice(2);
  const targetSku = args[0] || 'SKU-LED-1001';
  const newFloor = args[1] ? Number(args[1]) : null;
  const newTarget = args[2] ? Number(args[2]) : null;
  const newStock = args[3] ? Number(args[3]) : null;

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB. Mutating pricing for SKU: ${targetSku}...`);

  const product = await MerchantInventoryItem.findOne({ product_id: targetSku });
  if (!product) {
    console.error(`Product SKU ${targetSku} not found!`);
    process.exit(1);
  }

  const oldFloor = product.floor_price;
  const oldTarget = product.target_price;

  if (newFloor !== null) {
    product.floor_price = newFloor;
  } else {
    // Default automated shift: increase floor by 10% to simulate sudden supply crunch
    product.floor_price = Math.round(product.floor_price * 1.10);
  }

  if (newTarget !== null) {
    product.target_price = newTarget;
  } else {
    product.target_price = Math.round(product.target_price * 1.08);
  }

  if (newStock !== null) {
    product.stock_level = newStock;
  }

  product.floor_price_updated_at = new Date();
  await product.save();

  console.log('========================================================');
  console.log(`✅ Dynamic Price Mutation Applied for: ${product.name}`);
  console.log(`   SKU: ${product.product_id}`);
  console.log(`   Floor Price:  ₹${oldFloor}  -->  ₹${product.floor_price} (Updated Live)`);
  console.log(`   Target Price: ₹${oldTarget}  -->  ₹${product.target_price}`);
  console.log(`   Stock Level:  ${product.stock_level} ${product.unit}`);
  console.log(`   Timestamp:    ${product.floor_price_updated_at.toISOString()}`);
  console.log('========================================================');
  console.log('Subsequent negotiations on this SKU will immediately validate against the new floor.');

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  updatePrice().catch(err => {
    console.error('Price updater failed:', err);
    process.exit(1);
  });
}

module.exports = { updatePrice };
