require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');
const MerchantInventoryItem = require('./models/MerchantInventoryItem');
const User = require('./models/User');
const CustomerProfile = require('./models/CustomerProfile');
const NegotiationSession = require('./models/NegotiationSession');
const NegotiationMessage = require('./models/NegotiationMessage');

const sampleProducts = [
  {
    product_id: 'SKU-LED-1001',
    name: 'Industrial LED High-Bay Panel (150W)',
    category: 'Electronics',
    list_price: 1200,
    target_price: 1000,
    floor_price: 850,
    negotiable: true,
    discount_ladder: [
      { min_qty: 20, max_discount_pct: 10 },
      { min_qty: 50, max_discount_pct: 20 },
      { min_qty: 100, max_discount_pct: 29 }
    ],
    stock_level: 450,
    unit: 'units',
    description: 'IP65 waterproof commercial high-bay industrial fixture with 5-year warranty.'
  },
  {
    product_id: 'SKU-TEX-2002',
    name: 'Egyptian Cotton Luxury Bedsheet Bulk Set (400 TC)',
    category: 'Textiles',
    list_price: 800,
    target_price: 650,
    floor_price: 550,
    negotiable: true,
    discount_ladder: [
      { min_qty: 30, max_discount_pct: 12 },
      { min_qty: 100, max_discount_pct: 25 },
      { min_qty: 250, max_discount_pct: 31 }
    ],
    stock_level: 600,
    unit: 'sets',
    description: '100% long-staple combed cotton sheet sets designed for hospitality & boutique retail.'
  },
  {
    product_id: 'SKU-KIT-3003',
    name: 'Stainless Steel Insulated Water Flask (750ml)',
    category: 'Kitchenware',
    list_price: 450,
    target_price: 380,
    floor_price: 320,
    negotiable: true,
    discount_ladder: [
      { min_qty: 50, max_discount_pct: 10 },
      { min_qty: 200, max_discount_pct: 20 },
      { min_qty: 500, max_discount_pct: 28 }
    ],
    stock_level: 1200,
    unit: 'bottles',
    description: 'Double-walled vacuum insulated grade 304 stainless steel flasks.'
  },
  {
    product_id: 'SKU-ELE-4004',
    name: 'Rugged Wireless Bluetooth Conference Speaker',
    category: 'Electronics',
    list_price: 2500,
    target_price: 2100,
    floor_price: 1800,
    negotiable: true,
    discount_ladder: [
      { min_qty: 10, max_discount_pct: 8 },
      { min_qty: 25, max_discount_pct: 18 },
      { min_qty: 50, max_discount_pct: 28 }
    ],
    stock_level: 180,
    unit: 'units',
    description: '360-degree omnidirectional mic pickup with DSP noise cancellation.'
  },
  {
    product_id: 'SKU-TEA-5005',
    name: 'Single-Estate Darjeeling Organic Green Tea (1kg Pack)',
    category: 'Food & Beverage',
    list_price: 350,
    target_price: 350,
    floor_price: 350,
    negotiable: false,
    discount_ladder: [],
    stock_level: 80,
    unit: 'packs',
    description: 'Fixed-price premium certified organic first-flush tea leaves. Non-negotiable pricing.'
  },
  {
    product_id: 'SKU-PKG-6006',
    name: 'Heavy-Duty Kraft Paper Shipping Bags (Bundle of 100)',
    category: 'Packaging',
    list_price: 600,
    target_price: 500,
    floor_price: 420,
    negotiable: true,
    discount_ladder: [
      { min_qty: 15, max_discount_pct: 10 },
      { min_qty: 50, max_discount_pct: 20 },
      { min_qty: 100, max_discount_pct: 30 }
    ],
    stock_level: 900,
    unit: 'bundles',
    description: '100% recyclable high-burst strength gusseted kraft mailers.'
  }
];

const baselineCustomerProfiles = [
  {
    buyer_id: 'apex_global',
    company_name: 'Apex Global Procurement',
    persona_key: 'reasonable',
    trust_score: 65,
    loyalty_tier: 'GROWTH_ACCOUNT',
    discount_elasticity_bonus: 1.5,
    lowball_strikes: 0,
    deals_closed_count: 0,
    deals_attempted_count: 0,
    lifetime_spend_inr: 0,
    payment_reliability_score: 100,
    last_deal_summary: 'Account initialized in Parlay Commerce Gateway.',
    last_negotiated_at: null
  },
  {
    buyer_id: 'titan_bulk',
    company_name: 'Titan Bulk Liquidators',
    persona_key: 'lowballer',
    trust_score: 25,
    loyalty_tier: 'CHRONIC_LOWBALLER',
    discount_elasticity_bonus: -3,
    lowball_strikes: 2,
    deals_closed_count: 0,
    deals_attempted_count: 0,
    lifetime_spend_inr: 0,
    payment_reliability_score: 100,
    last_deal_summary: 'Account initialized in Parlay Commerce Gateway.',
    last_negotiated_at: null
  },
  {
    buyer_id: 'nexus_logistics',
    company_name: 'Nexus FastTrack Logistics',
    persona_key: 'impatient_enterprise',
    trust_score: 55,
    loyalty_tier: 'GROWTH_ACCOUNT',
    discount_elasticity_bonus: 1.5,
    lowball_strikes: 0,
    deals_closed_count: 0,
    deals_attempted_count: 0,
    lifetime_spend_inr: 0,
    payment_reliability_score: 100,
    last_deal_summary: 'Account initialized in Parlay Commerce Gateway.',
    last_negotiated_at: null
  },
  {
    buyer_id: 'spectre_arbitrage',
    company_name: 'Spectre Automated Arbitrage',
    persona_key: 'floor_tester',
    trust_score: 20,
    loyalty_tier: 'CHRONIC_LOWBALLER',
    discount_elasticity_bonus: -3,
    lowball_strikes: 3,
    deals_closed_count: 0,
    deals_attempted_count: 0,
    lifetime_spend_inr: 0,
    payment_reliability_score: 100,
    last_deal_summary: 'Account initialized in Parlay Commerce Gateway.',
    last_negotiated_at: null
  }
];

const seedDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set in environment');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for seeding baseline...');

    // 1. Reset Inventory Items (6 items)
    await MerchantInventoryItem.deleteMany({});
    const insertedItems = await MerchantInventoryItem.insertMany(sampleProducts);
    console.log(`Successfully seeded ${insertedItems.length} MerchantInventoryItems.`);

    // 2. Reset Customer Profiles (4 accounts with baseline trust scores & strikes)
    await CustomerProfile.deleteMany({});
    const insertedProfiles = await CustomerProfile.insertMany(baselineCustomerProfiles);
    console.log(`Successfully seeded ${insertedProfiles.length} CustomerProfiles.`);

    // 3. Clear all active negotiations and messages for clean state
    await NegotiationSession.deleteMany({});
    await NegotiationMessage.deleteMany({});
    console.log('Cleared all active negotiation sessions & audit messages.');

    // 4. Ensure Merchant Admin login exists
    const adminEmail = 'merchant@parlay.ai';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await User.create({
        name: 'Merchant Admin',
        email: adminEmail,
        password: 'password123',
        role: 'admin'
      });
      console.log('Created default merchant admin: merchant@parlay.ai / password123');
    } else {
      console.log('Admin user verified: merchant@parlay.ai');
    }

    console.log('Base reset complete! 6 products, 4 customer profiles, merchant admin, 0 sessions.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seedDB();
