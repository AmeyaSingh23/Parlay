const crypto = require('crypto');
const MerchantInventoryItem = require('../models/MerchantInventoryItem');
const NegotiationSession = require('../models/NegotiationSession');
const NegotiationMessage = require('../models/NegotiationMessage');
const { firewallCheck } = require('../firewall/firewallCheck');
const { generateMerchantTurn } = require('../agents/merchantAgent');
const { settlePayment } = require('./razorpayController');

/**
 * GET /api/agent/catalog
 *
 * Exposes real-time warehouse inventory as a standardized Agent-Readable Catalog.
 * Formatted for LLM autonomous procurement agents, Model Context Protocol (MCP) clients,
 * and programmatic RFQ bidding systems.
 */
const getAgentCatalog = async (req, res) => {
  try {
    const products = await MerchantInventoryItem.find().sort({ createdAt: 1 }).lean();

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const catalogResponse = {
      spec_version: '1.0.0-agentic-commerce',
      merchant_name: 'Parlay B2B Direct Wholesale Gateway',
      currency: 'INR',
      description: 'Autonomous B2B catalog with real-time stock levels, volume discounts, and deterministic firewall enforcement.',
      gateway_endpoints: {
        catalog_url: `${baseUrl}/api/agent/catalog`,
        rfq_initiate_url: `${baseUrl}/api/agent/rfq`,
        negotiate_turn_url: `${baseUrl}/api/agent/negotiate`,
        autonomous_checkout_url: `${baseUrl}/api/agent/settle`
      },
      rules: {
        max_negotiation_rounds: 8,
        firewall_enforcement: 'deterministic_hardware_code_layer',
        prompt_injection_protection: true,
        settlement_rail: 'Razorpay B2B Orders & M2M Pre-Authorized Mandates'
      },
      items: products.map(p => ({
        sku: p.product_id,
        name: p.name,
        category: p.category,
        description: p.description,
        unit: p.unit || 'units',
        list_price_inr: p.list_price,
        ready_stock: p.stock_level,
        is_negotiable: p.negotiable,
        volume_discount_tiers: (p.discount_ladder || []).map(d => {
          const discountPct = d.max_discount_pct || d.discount_pct || 0;
          return {
            min_quantity: d.min_qty,
            max_discount_pct: discountPct,
            estimated_rate_inr: Math.round(p.list_price * (1 - (discountPct / 100)))
          };
        })
      }))
    };

    res.json(catalogResponse);
  } catch (err) {
    console.error('[AgentGateway] getAgentCatalog error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/agent/rfq
 *
 * Initiates an external Agent-to-Agent (A2A) negotiation session.
 * External AI procurement bots call this endpoint to start negotiating on a specific SKU.
 */
const createAgentRfq = async (req, res) => {
  try {
    const { product_id, quantity, buyer_agent_name, buyer_persona } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({
        error: 'INVALID_RFQ_PAYLOAD',
        message: 'product_id and quantity are required to initiate an RFQ.'
      });
    }

    const product = await MerchantInventoryItem.findOne({ product_id }).lean();
    if (!product) {
      return res.status(404).json({
        error: 'SKU_NOT_FOUND',
        message: `Product with SKU ${product_id} was not found in active inventory.`
      });
    }

    const sessionId = `ses_ext_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    let persona = buyer_persona || 'reasonable';
    if (persona === 'lowballer') persona = 'aggressive_lowballer';
    if (persona === 'impatient') persona = 'impatient_enterprise';

    const session = await NegotiationSession.create({
      session_id: sessionId,
      product_id: product.product_id,
      product_name: product.name,
      buyer_persona: persona,
      quantity: Number(quantity),
      status: 'ongoing',
      list_price_snapshot: product.list_price,
      target_price_snapshot: product.target_price,
      floor_price_snapshot: product.floor_price,
      rounds_count: 1
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('negotiation:external_rfq', {
        session_id: sessionId,
        buyer_agent_name: buyer_agent_name || 'External AI Agent',
        product_name: product.name,
        quantity: Number(quantity),
        list_price: product.list_price
      });
    }

    // 1. Initial RFQ dispatch from Buyer Agent
    const buyerRfqMsg = await NegotiationMessage.create({
      session_id: sessionId,
      sender: 'buyer',
      message: `Submitting formal RFQ for ${quantity} ${product.unit || 'units'} of "${product.name}". Requesting best volume wholesale pricing and fulfillment schedule.`,
      proposed_price: null,
      policy_reason: `Initial RFQ dispatch by ${buyer_agent_name || 'Buyer Agent'} (${persona})`,
      firewall_result: 'pass',
      round: 1
    });

    if (io) {
      io.to(sessionId).emit('negotiation:turn', buyerRfqMsg);
      io.emit('negotiation:global_update', { sessionId, event: 'negotiation:turn', data: buyerRfqMsg });
    }

    // 2. Opening greeting and quote from Parlay Merchant Agent
    const openingPrice = Math.max(product.target_price, Math.round(product.list_price * 0.95));
    const openingMsg = await NegotiationMessage.create({
      session_id: sessionId,
      sender: 'merchant',
      message: `Welcome ${buyer_agent_name || 'Procurement Agent'}. We have received your RFQ for ${quantity} ${product.unit || 'units'} of "${product.name}". Our catalog list price is ₹${product.list_price}/unit, but for this wholesale volume, we can open at ₹${openingPrice}/unit with priority warehouse dispatch.`,
      proposed_price: openingPrice,
      policy_reason: 'Opening wholesale quote anchored near target margin',
      firewall_result: 'pass',
      round: 1
    });

    if (io) {
      io.to(sessionId).emit('negotiation:turn', openingMsg);
      io.emit('negotiation:global_update', { sessionId, event: 'negotiation:turn', data: openingMsg });
    }

    res.status(201).json({
      success: true,
      session_id: sessionId,
      product_name: product.name,
      sku: product.product_id,
      quantity: Number(quantity),
      current_round: 1,
      max_rounds: 8,
      merchant_opening_turn: {
        message: openingMsg.message,
        proposed_price_inr: openingMsg.proposed_price,
        policy_reason: openingMsg.policy_reason
      },
      next_action: {
        endpoint: '/api/agent/negotiate',
        method: 'POST',
        payload_schema: {
          session_id: sessionId,
          offered_price: 'number (your counter-offer in INR per unit)',
          message: 'string (your dialogue back to merchant)',
          action: "'continue' | 'deal_closed' | 'no_deal'"
        }
      }
    });
  } catch (err) {
    console.error('[AgentGateway] createAgentRfq error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/agent/negotiate
 *
 * Receives an external AI buyer's counter-offer.
 * Runs the Deterministic Code Firewall, streams to dashboard, and returns merchant response.
 */
const handleAgentNegotiate = async (req, res) => {
  try {
    const { session_id, offered_price, message, action } = req.body;

    const session = await NegotiationSession.findOne({ session_id });
    if (!session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Negotiation session not found.' });
    }

    if (session.status !== 'ongoing') {
      return res.status(400).json({
        error: 'SESSION_TERMINATED',
        status: session.status,
        message: `This negotiation is already in "${session.status}" state.`
      });
    }

    const product = await MerchantInventoryItem.findOne({ product_id: session.product_id }).lean();
    session.rounds_count += 1;
    await session.save();

    const io = req.app.get('io');
    const numericOffer = offered_price !== null && offered_price !== undefined ? Number(offered_price) : null;

    // 1. DETERMINISTIC FIREWALL CHECK ON EXTERNAL BID
    let buyerFwCheck = null;
    let isFirewallBlocked = false;

    if (numericOffer !== null && !isNaN(numericOffer)) {
      buyerFwCheck = await firewallCheck(numericOffer, product.product_id);
      if (buyerFwCheck.result === 'blocked') {
        isFirewallBlocked = true;
      }
    }

    // Save external buyer turn
    const buyerMsg = await NegotiationMessage.create({
      session_id,
      sender: 'buyer',
      message: message || `External agent counter at ₹${numericOffer}/unit`,
      proposed_price: numericOffer,
      policy_reason: `External AI Agent Turn (Round ${session.rounds_count})`,
      firewall_result: isFirewallBlocked ? 'blocked' : 'pass',
      firewall_details: buyerFwCheck && isFirewallBlocked ? {
        live_floor: buyerFwCheck.live_floor,
        reason: buyerFwCheck.reason
      } : undefined,
      round: session.rounds_count
    });

    if (io) {
      io.to(session_id).emit('negotiation:turn', buyerMsg);
      io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:turn', data: buyerMsg });
    }

    // Emit firewall alert if blocked
    if (isFirewallBlocked) {
      const fwLogMsg = await NegotiationMessage.create({
        session_id,
        sender: 'firewall',
        message: `🚨 FIREWALL INTERCEPTION: External Agent bid ₹${numericOffer}/unit breaches live merchant floor of ₹${buyerFwCheck.live_floor}. Transaction forbidden below boundary.`,
        proposed_price: numericOffer,
        policy_reason: 'FIREWALL_BLOCKED_BELOW_FLOOR',
        firewall_result: 'blocked',
        firewall_details: {
          live_floor: buyerFwCheck.live_floor,
          reason: buyerFwCheck.reason
        },
        round: session.rounds_count
      });

      if (io) {
        io.to(session_id).emit('negotiation:firewall', fwLogMsg);
        io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:turn', data: fwLogMsg });
      }

      // If buyer repeatedly attacks floor in round 4+, quarantine
      if (session.rounds_count >= 4) {
        session.status = 'blocked_by_firewall';
        session.closed_at = new Date();
        await session.save();

        return res.status(422).json({
          status: 'blocked_by_firewall',
          error: 'FIREWALL_SECURITY_QUARANTINE',
          message: `Your bid of ₹${numericOffer}/unit breaches our minimum commercial operating margin. Multiple sub-economic proposals have quarantined this session.`,
          session_id
        });
      }
    }

    // 2. CHECK IF EXTERNAL BUYER ACCEPTED OR WALKED AWAY
    if (action === 'deal_closed' && numericOffer) {
      const agreedPrice = numericOffer;
      const fwVal = await firewallCheck(agreedPrice, product.product_id);

      if (fwVal.result === 'blocked') {
        session.status = 'blocked_by_firewall';
        await session.save();
        return res.status(422).json({
          status: 'blocked_by_firewall',
          message: 'Cannot close deal below merchant floor price.'
        });
      }

      const orchestrator = req.app.get('orchestrator');
      await orchestrator.closeDeal(session, agreedPrice, product);

      return res.json({
        status: 'deal_closed',
        message: `Deal locked at ₹${agreedPrice}/unit for ${session.quantity} units!`,
        final_price_inr: agreedPrice,
        subtotal_inr: Math.round(agreedPrice * session.quantity),
        total_with_gst_inr: Math.round(agreedPrice * session.quantity * 1.18),
        razorpay_order_id: session.razorpay_order_id,
        checkout_instructions: {
          settle_endpoint: '/api/agent/settle',
          payload: { session_id, max_authorized_budget: agreedPrice }
        }
      });
    }

    if (action === 'no_deal') {
      session.status = 'no_deal';
      session.closed_at = new Date();
      await session.save();
      return res.json({
        status: 'no_deal',
        message: 'External agent ended the negotiation without mutual agreement.'
      });
    }

    // 3. GENERATE PARLAY MERCHANT COUNTER-OFFER
    const history = await NegotiationMessage.find({ session_id }).sort({ timestamp: 1 }).lean();
    let merchantTurn;
    try {
      merchantTurn = await generateMerchantTurn({
        product,
        quantity: session.quantity,
        messages: history,
        currentRound: session.rounds_count,
        firewallFeedback: isFirewallBlocked ? {
          blockedPrice: numericOffer,
          reason: `Buyer bid ₹${numericOffer} was blocked by commercial firewall (Floor: ₹${buyerFwCheck.live_floor}). Counter firmly at or above floor.`,
          liveFloor: buyerFwCheck.live_floor
        } : null
      });
    } catch (llmErr) {
      merchantTurn = {
        message: `We can offer ₹${Math.max(product.floor_price, Math.round(product.target_price * 1.02))}/unit with standard enterprise warranty.`,
        proposed_price: Math.max(product.floor_price, Math.round(product.target_price * 1.02)),
        policy_reason: 'Automated fallback counter preserving target margin',
        action: 'continue'
      };
    }

    const merchantMsg = await NegotiationMessage.create({
      session_id,
      sender: 'merchant',
      message: merchantTurn.message,
      proposed_price: merchantTurn.proposed_price,
      policy_reason: merchantTurn.policy_reason,
      firewall_result: 'pass',
      round: session.rounds_count
    });

    if (io) {
      io.to(session_id).emit('negotiation:turn', merchantMsg);
      io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:turn', data: merchantMsg });
    }

    res.json({
      status: 'ongoing',
      session_id,
      current_round: session.rounds_count,
      max_rounds: 8,
      firewall_status: isFirewallBlocked ? 'INTERCEPTED_AND_WARNED' : 'PASS',
      merchant_response: {
        message: merchantTurn.message,
        proposed_price_inr: merchantTurn.proposed_price,
        policy_reason: merchantTurn.policy_reason,
        action: merchantTurn.action
      }
    });
  } catch (err) {
    console.error('[AgentGateway] handleAgentNegotiate error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/agent/settle
 *
 * Bounded Machine-to-Machine Autonomous Settlement:
 * External AI agent executes settlement against pre-approved budget bounds.
 * Integrates with Razorpay Order generation and atomic inventory deduction.
 */
const handleAgentSettle = async (req, res) => {
  try {
    const { session_id, max_authorized_budget } = req.body;

    const session = await NegotiationSession.findOne({ session_id });
    if (!session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'Session not found.' });
    }

    if (session.payment_status === 'paid') {
      return res.json({
        success: true,
        already_paid: true,
        message: 'This invoice has already been settled.',
        transaction_id: session.razorpay_payment_id
      });
    }

    if (session.status !== 'deal_closed') {
      return res.status(400).json({
        error: 'DEAL_NOT_CLOSED',
        message: `Cannot execute settlement. Current session status is "${session.status}".`
      });
    }

    // Bounded budget validation: ensure final price is within agent's pre-approved authorization
    if (max_authorized_budget && session.final_price > Number(max_authorized_budget)) {
      return res.status(400).json({
        error: 'BUDGET_EXCEEDED',
        message: `Final agreed price ₹${session.final_price} exceeds agent's authorized budget ceiling of ₹${max_authorized_budget}.`
      });
    }

    const paymentId = `pay_ext_agent_${crypto.randomBytes(8).toString('hex')}`;
    const io = req.app.get('io');

    const settlement = await settlePayment({
      session,
      paymentId,
      orderId: session.razorpay_order_id,
      io,
      method: 'External AI Agent Autonomous M2M Settlement'
    });

    res.json({
      success: true,
      status: 'settled',
      transaction_id: paymentId,
      razorpay_order_id: session.razorpay_order_id,
      final_price_per_unit_inr: session.final_price,
      quantity: session.quantity,
      subtotal_inr: Math.round(session.final_price * session.quantity),
      total_with_gst_inr: Math.round(session.final_price * session.quantity * 1.18),
      settled_at: session.paid_at,
      receipt_audit: settlement.receiptMsg?.message,
      stock_allocated: true
    });
  } catch (err) {
    console.error('[AgentGateway] handleAgentSettle error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAgentCatalog,
  createAgentRfq,
  handleAgentNegotiate,
  handleAgentSettle
};
