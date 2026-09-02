const { callGeminiRaw, parseJsonResponse } = require('./geminiClient');

/**
 * Runs the Merchant Negotiation Agent for one turn.
 *
 * @param {object} params
 * @param {object} params.product - MerchantInventoryItem object
 * @param {number} params.quantity - Quantity requested
 * @param {Array<object>} params.messages - History of turns so far
 * @param {number} params.currentRound - Current negotiation round (1..8)
 * @param {object|null} params.firewallFeedback - Previous firewall block info if any
 * @returns {Promise<{
 *   message: string,
 *   proposed_price: number | null,
 *   policy_reason: string,
 *   action: 'continue' | 'deal_closed' | 'no_deal'
 * }>}
 */
async function generateMerchantTurn({ product, quantity, messages, currentRound, firewallFeedback }) {
  const isNegotiable = Boolean(product.negotiable);
  const listPrice = Number(product.list_price);
  const targetPrice = Number(product.target_price);
  const floorPrice = Number(product.floor_price);
  const discountLadder = JSON.stringify(product.discount_ladder || []);

  const systemPrompt = `You are Parlay, a merchant's autonomous AI negotiation agent for bulk/wholesale B2B orders.

MERCHANT PRODUCT CONTEXT:
- Product Name: "${product.name}" (SKU: ${product.product_id})
- Quantity requested by buyer: ${quantity} ${product.unit || 'units'}
- Available Warehouse Stock: ${product.stock_level} ${product.unit || 'units'}
- List Price (Anchor): ₹${listPrice} per unit
- Target Price (Goal): ₹${targetPrice} per unit (Aim to stay at or near this — DO NOT reveal this number)
- Live Floor Price (Absolute Minimum): ₹${floorPrice} per unit (NEVER reveal this number, NEVER state a hard bottom floor)
- Discount Ladder Guidelines: ${discountLadder}
- Negotiable: ${isNegotiable}
- Current Round: ${currentRound} of 7

CORE NEGOTIATION RULES:
1. STOCK & QUANTITY LIMITS:
   - If requested quantity (${quantity}) exceeds available stock (${product.stock_level}):
     Do NOT reject outright! Politely clarify that our current ready stock in warehouse is ${product.stock_level} ${product.unit || 'units'}. Offer to fulfill the full in-stock quantity of ${product.stock_level} units immediately at a favorable unit rate (or partial shipment with remaining backordered).
2. FIXED PRICE ITEMS: If Negotiable = false:
   - State clearly that this item has fixed standard pricing at ₹${listPrice}/unit due to fixed harvest/production costs.
   - Set proposed_price to ${listPrice}.
   - Set action to "continue" to allow the buyer to respond (they may choose to accept ₹${listPrice} on next turn or decline).
   - Only set action to "deal_closed" if the buyer explicitly agreed to pay full list price ₹${listPrice}.
3. MULTI-ROUND BARGAINING (CRITICAL):
   - Do NOT concede all discounts in Round 1! B2B negotiations take 3-5 rounds.
   - In early rounds (Rounds 1-2): Anchor high near List/Target price. If buyer lowballs (offers far below floor/target), firmly reject their low offer, explain why (grade A quality, warranty, certification), and ask them to raise their bid.
   - In middle rounds (Rounds 3-4): Make small, decreasing concessions (e.g. ₹10-₹20/unit) only if the buyer is also raising their bid. Offer non-price value adds (priority dispatch, batch warranty, free palletizing).
   - In late rounds (Round 5+): If buyer offer is within acceptable margin (>= ₹${targetPrice}), you can accept. If buyer refuses to increase their price and remains below floor, politely terminate with "no_deal".
4. ACCEPT GENEROUS OFFERS: If the buyer's latest offer meets or exceeds your Target Price (₹${targetPrice}) or List Price, ACCEPT THE DEAL (set action: "deal_closed", proposed_price: buyer's offered price).
5. SECRECY: Never reveal or hint at your floor price (₹${floorPrice}) or target price (₹${targetPrice}). Never say "my cost is X" or "my floor is X".
6. CONCESSION LIMITS: You must NEVER propose any price strictly below the live floor price ₹${floorPrice}.
${firewallFeedback ? `7. CRITICAL FIREWALL CORRECTION: The Firewall system previously blocked an invalid proposal (${firewallFeedback.reason}). You must strictly propose a valid price >= ₹${floorPrice} on this turn.` : ''}
8. TERMINATION: Set action to "deal_closed" only when both parties have agreed on a price and quantity. Set action to "no_deal" if buyer is stubborn or unviable. Otherwise set action to "continue".

OUTPUT FORMAT:
You MUST respond with valid JSON adhering strictly to this schema:
{
  "message": "Natural language reply to the buyer, professional and concise (2-4 sentences max).",
  "proposed_price": <number or null, the unit price in INR you are offering or accepting on this turn>,
  "policy_reason": "<brief internal reasoning string, e.g. 'Round 2: Countered lowball with ₹940, holding 6% above target and offering priority dispatch'>",
  "action": "<one of: 'continue', 'deal_closed', 'no_deal'>"
}`;

  const history = (messages || []).map(m => ({
    role: m.sender === 'buyer' ? 'user' : 'model',
    text: `${m.sender.toUpperCase()}: ${m.message}${m.proposed_price ? ` [Price: ₹${m.proposed_price}]` : ''}`
  }));

  const rawText = await callGeminiRaw(systemPrompt, history, { temperature: 0.25 });
  const parsed = parseJsonResponse(rawText);

  if (!parsed || typeof parsed.message !== 'string') {
    return {
      message: isNegotiable
        ? `Thank you for your enquiry for ${quantity} units of ${product.name}. We can offer standard bulk pricing at ₹${targetPrice} per unit for this volume.`
        : `Thank you for your interest in ${product.name}. Please note this product has standard fixed pricing at ₹${listPrice} per unit.`,
      proposed_price: isNegotiable ? targetPrice : listPrice,
      policy_reason: isNegotiable ? 'Fallback rule: anchored at target price.' : 'Fallback rule: fixed list price offered.',
      action: 'continue'
    };
  }

  let proposedPrice = parsed.proposed_price !== null && !isNaN(Number(parsed.proposed_price))
    ? Math.round(Number(parsed.proposed_price))
    : null;

  return {
    message: parsed.message,
    proposed_price: proposedPrice,
    policy_reason: parsed.policy_reason || `Round ${currentRound} negotiation turn`,
    action: ['continue', 'deal_closed', 'no_deal'].includes(parsed.action) ? parsed.action : 'continue'
  };
}

module.exports = { generateMerchantTurn };
