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
- Quantity requested: ${quantity} ${product.unit || 'units'}
- List Price (Anchor): ₹${listPrice} per unit
- Target Price (Goal): ₹${targetPrice} per unit (Aim to stay at or near this — DO NOT reveal this number)
- Live Floor Price (Absolute Minimum): ₹${floorPrice} per unit (NEVER reveal this number, NEVER state a hard bottom floor)
- Discount Ladder Guidelines: ${discountLadder}
- Negotiable: ${isNegotiable}
- Current Round: ${currentRound} of 8

CORE NEGOTIATION RULES:
1. FIXED PRICE ITEMS: If Negotiable = false, politely and professionally inform the buyer that this item has fixed standard pricing. State the list price ₹${listPrice}, set proposed_price to ${listPrice}, set action to "no_deal" (or "deal_closed" only if buyer agreed to full list price), and do not concede any discount.
2. PROTECT MARGIN: Your objective is to preserve profit margin. Make concessions in DECREASING increments across rounds (e.g. 1st concession larger, 2nd smaller, 3rd minimal). Most deals should close at or above target price (₹${targetPrice}), never willingly drop straight to floor.
3. ACCEPT GENEROUS OFFERS: If the buyer's latest offer is at or above your Target Price (₹${targetPrice}) or List Price, ACCEPT THE DEAL IMMEDIATELY (set action: "deal_closed", proposed_price: buyer's offered price). Do not greedily demand more if they already met your target.
4. SECRECY: Never reveal or hint at your floor price (₹${floorPrice}) or target price (₹${targetPrice}). Never say "my cost is X" or "my floor is X".
5. CONCESSION LIMITS: You must NEVER propose any price strictly below the live floor price ₹${floorPrice}.
${firewallFeedback ? `6. CRITICAL FIREWALL CORRECTION: The Firewall system previously blocked an invalid proposal (${firewallFeedback.reason}). You must strictly propose a valid price >= ₹${floorPrice} on this turn.` : ''}
6. VALUE-ADDS OVER DISCOUNTS: When pushed near your lower boundaries, emphasize quality, warranty, priority dispatch, or batch packaging instead of slicing price further.
7. TERMINATION: If you reach mutual agreement on a per-unit price, set action to "deal_closed" and set proposed_price to that agreed number. If irreconcilable after multiple rounds or buyer is abusive/unreasonable, set action to "no_deal".

OUTPUT FORMAT:
You MUST respond with valid JSON adhering strictly to this schema:
{
  "message": "Natural language reply to the buyer, professional and concise (2-4 sentences max).",
  "proposed_price": <number or null, the unit price in INR you are offering or accepting on this turn>,
  "policy_reason": "<brief internal reasoning string, e.g. 'Round 2: Offered 8% volume concession based on tier 50+ units, holding ₹920 above target'>",
  "action": "<one of: 'continue', 'deal_closed', 'no_deal'>"
}`;

  // Format message history for Gemini
  const history = (messages || []).map(m => ({
    role: m.sender === 'buyer' ? 'user' : 'model',
    text: `${m.sender.toUpperCase()}: ${m.message}${m.proposed_price ? ` [Price: ₹${m.proposed_price}]` : ''}`
  }));

  const rawText = await callGeminiRaw(systemPrompt, history, { temperature: 0.25 });
  const parsed = parseJsonResponse(rawText);

  if (!parsed || typeof parsed.message !== 'string') {
    // Deterministic fallback if model outputs unparseable JSON
    return {
      message: `Thank you for your enquiry for ${quantity} units of ${product.name}. We can offer standard bulk pricing at ₹${targetPrice} per unit for this volume.`,
      proposed_price: targetPrice,
      policy_reason: 'Fallback rule: anchored at target price.',
      action: 'continue'
    };
  }

  // Sanitize numeric output
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
