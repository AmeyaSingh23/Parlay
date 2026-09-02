const express = require('express');
const router = express.Router();
const {
  getAllInventory,
  getInventoryBySku,
  updateProductPrice
} = require('../controllers/inventoryController');

router.get('/', getAllInventory);
router.get('/:productId', getInventoryBySku);
router.post('/update-price', updateProductPrice);

module.exports = router;
