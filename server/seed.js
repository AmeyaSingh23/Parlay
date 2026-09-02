require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const mongoose = require('mongoose');
const MerchantInventoryItem = require('./models/MerchantInventoryItem');
const User = require('./models/User');

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

const seedDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not set in environment');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected for seeding...');

    await MerchantInventoryItem.deleteMany({});
    console.log('Cleared existing inventory items.');

    const inserted = await MerchantInventoryItem.insertMany(sampleProducts);
    console.log(`Successfully seeded ${inserted.length} MerchantInventoryItems.`);

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
      console.log('Admin user already exists.');
    }

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seedDB();
