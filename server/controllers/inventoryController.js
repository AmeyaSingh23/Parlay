const MerchantInventoryItem = require('../models/MerchantInventoryItem');

// GET /api/inventory
const getAllInventory = async (req, res) => {
  try {
    const items = await MerchantInventoryItem.find().sort({ createdAt: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/inventory/:productId
const getInventoryBySku = async (req, res) => {
  try {
    const item = await MerchantInventoryItem.findOne({ product_id: req.params.productId });
    if (!item) {
      return res.status(404).json({ message: 'Product SKU not found' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/inventory/update-price
// Used for the live price mutation demo (Section 10)
const updateProductPrice = async (req, res) => {
  try {
    const { product_id, floor_price, target_price, list_price, stock_level } = req.body;

    const product = await MerchantInventoryItem.findOne({ product_id });
    if (!product) {
      return res.status(404).json({ message: `Product ${product_id} not found` });
    }

    if (floor_price !== undefined) product.floor_price = Number(floor_price);
    if (target_price !== undefined) product.target_price = Number(target_price);
    if (list_price !== undefined) product.list_price = Number(list_price);
    if (stock_level !== undefined) product.stock_level = Number(stock_level);
    product.floor_price_updated_at = new Date();

    const updated = await product.save();

    // Broadcast inventory update via Socket.io if available
    if (req.app.get('io')) {
      req.app.get('io').emit('inventory:updated', updated);
    }

    res.json({
      success: true,
      message: `Product ${product_id} pricing updated. New Floor: ₹${updated.floor_price}, Target: ₹${updated.target_price}`,
      product: updated
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAllInventory, getInventoryBySku, updateProductPrice };
