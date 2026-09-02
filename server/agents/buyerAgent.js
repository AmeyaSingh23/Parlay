const { callGeminiRaw, parseJsonResponse } = require('./geminiClient');
const { getPersonaConfig } = require('./personaConfigs');

/**
 * Runs the simulated Buyer Agent for one turn.
 *
 * @param {object} params
 * @param {object} params.product - MerchantInventoryItem object (only list price & name shown)
 * @param {number} params.quantity - Quantity requested
 * @param {string} params.buyerPersona - Key of persona ('reasonable' | 'aggressive_lowballer' | 'generous' | 'floor_tester')
 * @param {Array<object>} params.messages - History of turns so far
 * @param {number} params.currentRound - Current negotiation round (1..8)
 * @returns {Promise<{
 *   message: string,
 *   offered_price: number | null,
 *   action: 'continue' | 'deal_closed' | 'no_deal'
 * }>}
 */
async function generateBuyerTurn({ product, quantity, buyerPersona, messages, currentRound }) {
  const persona = getPersonaConfig(buyerPersona, product);
  const listPrice = Number(product.list_price);
  const budgetCeiling = persona.budgetCeiling;

  const isOpeningTurn = !messages || messages.length === 0;

  const systemPrompt = `You are an AI purchasing procurement agent negotiating on behalf of an enterprise buyer for a wholesale order.

PURCHASE CONTEXT:
- Product: "${product.name}" (SKU: ${product.product_id})
- Quantity required: ${quantity} ${product.unit || 'units'}
- Supplier Catalog List Price: ₹${listPrice} per unit
- Your Maximum Budget Ceiling: ₹${budgetCeiling} per unit (CONFIDENTIAL — NEVER state or reveal this exact limit!)
- Buyer Persona: ${persona.displayName} (${persona.description})
- Strategy Guide: ${persona.opening_strategy}
- Walk-away Rule: ${persona.walk_away_strategy}
- Current Round: ${currentRound} of 8

RULES:
1. Speak in the distinct tone of your persona:
   - "reasonable": courteous, professional, pragmatic.
   - "aggressive_lowballer": sharp, demanding, cites alternative suppliers, relentless on bulk discounts.
   - "generous": cooperative, urgent fulfillment focus, accepts quickly.
   - "floor_tester": assertive, insists on rock-bottom wholesale rates, probes seller bottom lines.
2. NEVER say "my budget is ₹${budgetCeiling}". Negotiate strategically.
3. ACCEPTANCE TRIGGER: If the seller's proposed per-unit price is at or below your budget ceiling (₹${budgetCeiling}) and you feel further haggling will endanger the order, set action to "deal_closed", set offered_price to that agreed number, and confirm the purchase.
4. If seller rejects negotiating (fixed-price item):
   - If list price ₹${listPrice} <= budget ceiling ₹${budgetCeiling}, you can accept at list price (action: "deal_closed", offered_price: ${listPrice}) or walk away politely (action: "no_deal").
   - If list price > budget ceiling, politely decline and end negotiation (action: "no_deal").
5. If at round 6+ and seller is not moving within your budget, end the negotiation (action: "no_deal").

OUTPUT FORMAT:
Respond with strictly valid JSON:
{
  "message": "Your conversational dialogue message back to the merchant (2-3 sentences).",
  "offered_price": <number or null, the unit price in INR you are offering or accepting on this turn>,
  "action": "<one of: 'continue', 'deal_closed', 'no_deal'>"
}`;

  const history = (messages || []).map(m => ({
    role: m.sender === 'buyer' ? 'model' : 'user',
    text: `${m.sender.toUpperCase()}: ${m.message}${m.proposed_price ? ` [Price: ₹${m.proposed_price}]` : ''}`
  }));

  // If opening turn, prompt specifically to kick off the negotiation
  if (isOpeningTurn) {
    history.push({
      role: 'user',
      text: `Opening enquiry: We are submitting an RFQ for ${quantity} units of ${product.name} (Catalog list price: ₹${listPrice}). Please state your opening offer.`
    });
  }

  const rawText = await callGeminiRaw(systemPrompt, history, { temperature: 0.35 });
  const parsed = parseJsonResponse(rawText);

  if (!parsed || typeof parsed.message !== 'string') {
    const fallbackPrice = isOpeningTurn ? persona.openingOffer : Math.min(persona.openingOffer + 20, budgetCeiling);
    return {
      message: `We are interested in purchasing ${quantity} units of ${product.name}. Our target unit rate is ₹${fallbackPrice}. Can you accommodate this?`,
      offered_price: fallbackPrice,
      action: 'continue'
    };
  }

  let offeredPrice = parsed.offered_price !== null && !isNaN(Number(parsed.offered_price))
    ? Math.round(Number(parsed.offered_price))
    : null;

  return {
    message: parsed.message,
    offered_price: offeredPrice,
    action: ['continue', 'deal_closed', 'no_deal'].includes(parsed.action) ? parsed.action : 'continue'
  };
}

module.exports = { generateBuyerTurn };
