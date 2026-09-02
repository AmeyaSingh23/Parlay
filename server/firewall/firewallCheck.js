const MerchantInventoryItem = require('../models/MerchantInventoryItem');

/**
 * Firewall validation layer (Pure deterministic code - NO LLM).
 * Independently re-fetches the live floor_price directly from database
 * and validates whether a proposed price is permitted.
 *
 * @param {number} proposedPrice - The per-unit price proposed
 * @param {string} productId - The SKU / product_id to validate against
 * @param {number} [customHitlMarginPct] - Optional override for HITL threshold percentage
 * @returns {Promise<{
 *   result: 'pass' | 'blocked',
 *   needs_hitl: boolean,
 *   live_floor: number,
 *   target_price: number,
 *   list_price: number,
 *   reason: string | null
 * }>}
 */
async function firewallCheck(proposedPrice, productId, customHitlMarginPct) {
  if (proposedPrice === null || proposedPrice === undefined || isNaN(proposedPrice)) {
    return {
      result: 'blocked',
      needs_hitl: false,
      live_floor: null,
      target_price: null,
      list_price: null,
      reason: 'Invalid proposed price provided to Firewall.'
    };
  }

  // Always fetch fresh from database to prevent stale cache attacks or drifts
  const product = await MerchantInventoryItem.findOne({ product_id: productId }).lean();

  if (!product) {
    return {
      result: 'blocked',
      needs_hitl: false,
      live_floor: null,
      target_price: null,
      list_price: null,
      reason: `Product ${productId} not found in inventory.`
    };
  }

  const liveFloor = Number(product.floor_price);
  const targetPrice = Number(product.target_price);
  const listPrice = Number(product.list_price);
  const isNegotiable = Boolean(product.negotiable);
  const proposed = Number(proposedPrice);

  const hitlMarginPct = customHitlMarginPct !== undefined
    ? Number(customHitlMarginPct)
    : Number(process.env.HITL_MARGIN_PCT || 0.05);

  // Hard floor threshold: price strictly below floor is BLOCKED immediately
  if (proposed < liveFloor) {
    return {
      result: 'blocked',
      needs_hitl: false,
      live_floor: liveFloor,
      target_price: targetPrice,
      list_price: listPrice,
      reason: `FIREWALL_VIOLATION: Proposed price ₹${proposed} is below live floor price ₹${liveFloor}. Money movement forbidden.`
    };
  }

  // HITL boundary check:
  // ONLY triggers when:
  // 1. Item is negotiable
  // 2. Proposed price is a genuine discount below target price
  // 3. Proposed price is within 5% of the live floor (liveFloor <= proposed <= liveFloor * 1.05)
  const hitlUpperLimit = liveFloor + (liveFloor * hitlMarginPct);
  const isNearFloor = isNegotiable && (proposed < targetPrice) && (proposed >= liveFloor && proposed <= hitlUpperLimit);

  return {
    result: 'pass',
    needs_hitl: isNearFloor,
    live_floor: liveFloor,
    target_price: targetPrice,
    list_price: listPrice,
    hitl_upper_limit: hitlUpperLimit,
    reason: isNearFloor
      ? `Price ₹${proposed} is near minimum floor boundary (₹${liveFloor} - ₹${hitlUpperLimit.toFixed(2)}). Routed for Human-in-the-Loop merchant approval.`
      : `Price ₹${proposed} passed all firewall rules (>= live floor ₹${liveFloor}).`
  };
}

module.exports = { firewallCheck };
