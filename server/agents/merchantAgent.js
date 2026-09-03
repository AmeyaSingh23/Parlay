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
async function generateMerchantTurn({ product, quantity, messages, currentRound, firewallFeedback, customerProfile }) {
  const isNegotiable = Boolean(product.negotiable);
  const listPrice = Number(product.list_price);
  const targetPrice = Number(product.target_price);
  const floorPrice = Number(product.floor_price);
  const discountLadder = JSON.stringify(product.discount_ladder || []);

  const customerContext = customerProfile ? `
BUYER REPUTATION & CUSTOMER MEMORY (LTV ENGINE):
- Client Entity: "${customerProfile.company_name}"
- Relationship Tier: ${customerProfile.loyalty_tier}
- Trust Score: ${customerProfile.trust_score} / 100
- Cumulative Lifetime Value (LTV): ₹${customerProfile.lifetime_spend_inr.toLocaleString()}
- Completed Deals: ${customerProfile.deals_closed_count} fulfilled contracts
- Historical Lowball Strikes: ${customerProfile.lowball_strikes}
- Payment Reliability: ${customerProfile.payment_reliability_score}%
- Concession Elasticity Adjustment: ${customerProfile.discount_elasticity_bonus >= 0 ? `+${customerProfile.discount_elasticity_bonus}%` : `${customerProfile.discount_elasticity_bonus}%`}
- Memory of Previous Deal: "${customerProfile.last_deal_summary}"

BEHAVIORAL POLICY DIRECTIVE:
${customerProfile.loyalty_tier === 'VIP_PARTNER' ? 
  `• REPEAT VIP CLIENT: This buyer is a trusted, high-volume partner (LTV ₹${customerProfile.lifetime_spend_inr.toLocaleString()}). In your opening greeting or counter, warmly acknowledge their ongoing partnership. You are authorized to utilize your unlocked +${customerProfile.discount_elasticity_bonus}% concession elasticity to offer preferred volume pricing and ensure customer retention.` : 
customerProfile.loyalty_tier === 'GROWTH_ACCOUNT' ?
  `• VALUED GROWTH CLIENT: Good transaction history (Trust Score: ${customerProfile.trust_score}/100). Maintain a professional, collaborative tone with standard volume flexibility.` :
customerProfile.loyalty_tier === 'WATCHLIST' ?
  `• WATCHLIST ACCOUNT: Mixed history with ${customerProfile.lowball_strikes} past lowball attempts. Tighten concession rounds and demand firm commitments before discounting.` :
customerProfile.loyalty_tier === 'CHRONIC_LOWBALLER' ?
  `• CHRONIC LOWBALLER / HIGH RISK: This buyer frequently attempts predatory bids below cost (Trust Score: ${customerProfile.trust_score}/100). Do NOT concede any volume discounts. Anchor strictly at full list price (₹${listPrice}/unit). Be polite but completely unyielding.` :
  `• NEW PROSPECT: First-time customer. Standard B2B negotiation terms apply.`}
` : '';

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
- Current Round: ${currentRound} of 8
${customerContext}

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
   - In late rounds (Round 5+): If buyer offer is within acceptable margin (>= ₹${targetPrice}), you can accept. If buyer is close to target price, make a best-and-final compromise to capture the bulk volume. If buyer refuses to increase their price and remains stubbornly below cost/floor, politely declare "no_deal".
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
    : (parsed.action === 'no_deal' ? null : listPrice);

  return {
    message: parsed.message,
    proposed_price: proposedPrice,
    policy_reason: parsed.policy_reason || `Round ${currentRound} negotiation turn`,
    action: ['continue', 'deal_closed', 'no_deal'].includes(parsed.action) ? parsed.action : 'continue'
  };
}

module.exports = { generateMerchantTurn };
