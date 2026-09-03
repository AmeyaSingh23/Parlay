const crypto = require('crypto');
const MerchantInventoryItem = require('../models/MerchantInventoryItem');
const NegotiationSession = require('../models/NegotiationSession');
const NegotiationMessage = require('../models/NegotiationMessage');
const { firewallCheck } = require('../firewall/firewallCheck');
const { generateMerchantTurn } = require('../agents/merchantAgent');
const { settlePayment } = require('./razorpayController');
const customerMemoryService = require('../services/customerMemoryService');

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

    const customerProfile = await customerMemoryService.getOrCreateCustomerProfile(persona);

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
      customer_profile_id: customerProfile._id,
      trust_score_snapshot: customerProfile.trust_score,
      loyalty_tier_snapshot: customerProfile.loyalty_tier,
      rounds_count: 1
    });

    // 1. Initial RFQ dispatch from Buyer Agent
    const buyerRfqMsg = await NegotiationMessage.create({
      session_id: sessionId,
      sender: 'buyer',
      message: `Submitting formal RFQ for ${quantity} ${product.unit || 'units'} of "${product.name}". Requesting best volume wholesale pricing and fulfillment schedule.`,
      proposed_price: null,
      policy_reason: `Initial RFQ dispatch by ${buyer_agent_name || customerProfile.company_name} (${persona})`,
      firewall_result: 'pass',
      round: 1
    });

    // 2. Opening greeting and quote from Parlay Merchant Agent (informed by Customer Memory)
    const openingPrice = Math.max(product.target_price, Math.round(product.list_price * 0.95));
    let openingGreeting = `Welcome ${buyer_agent_name || customerProfile.company_name}. We have received your RFQ for ${quantity} ${product.unit || 'units'} of "${product.name}". Our catalog list price is ₹${product.list_price}/unit, but for this wholesale volume, we can open at ₹${openingPrice}/unit with priority warehouse dispatch.`;

    if (customerProfile.loyalty_tier === 'VIP_PARTNER') {
      openingGreeting = `Welcome back, ${customerProfile.company_name}! In recognition of our ongoing volume partnership (LTV: ₹${customerProfile.lifetime_spend_inr.toLocaleString()}), our pricing engine has unlocked our Preferred VIP Tier. While catalog list price is ₹${product.list_price}/unit, we open our preferred counter at ₹${openingPrice}/unit with priority warehouse dispatch.`;
    } else if (customerProfile.loyalty_tier === 'CHRONIC_LOWBALLER') {
      openingGreeting = `Welcome ${customerProfile.company_name}. We have received your RFQ for ${quantity} units. Based on your account profile (Trust Score: ${customerProfile.trust_score}/100), our pricing is strictly anchored at ₹${product.list_price}/unit with standard enterprise dispatch terms.`;
    }

    const openingMsg = await NegotiationMessage.create({
      session_id: sessionId,
      sender: 'merchant',
      message: openingGreeting,
      proposed_price: openingPrice,
      policy_reason: 'Opening wholesale quote anchored near target margin',
      firewall_result: 'pass',
      round: 1
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('negotiation:external_rfq', {
        session_id: sessionId,
        buyer_agent_name: buyer_agent_name || customerProfile.company_name,
        product_name: product.name,
        quantity: Number(quantity),
        list_price: product.list_price,
        customerProfile,
        initialMessages: [buyerRfqMsg, openingMsg]
      });

      io.to(sessionId).emit('negotiation:turn', buyerRfqMsg);
      io.emit('negotiation:global_update', { sessionId, event: 'negotiation:turn', data: buyerRfqMsg });

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
      customer_profile: {
        company_name: customerProfile.company_name,
        loyalty_tier: customerProfile.loyalty_tier,
        trust_score: customerProfile.trust_score,
        lifetime_spend_inr: customerProfile.lifetime_spend_inr,
        deals_closed: customerProfile.deals_closed_count,
        lowball_strikes: customerProfile.lowball_strikes,
        elasticity_bonus_pct: customerProfile.discount_elasticity_bonus,
        last_deal_summary: customerProfile.last_deal_summary
      },
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

    if (session.rounds_count >= session.max_rounds) {
      session.status = 'no_deal';
      session.closed_at = new Date();
      await session.save();

      const io = req.app.get('io');
      if (io) {
        io.to(session_id).emit('negotiation:status', { session });
        io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:status', data: { session } });
      }

      return res.status(200).json({
        status: 'no_deal',
        message: `Maximum negotiation rounds (${session.max_rounds}) reached without agreement. Session concluded.`,
        session_id
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

        if (io) {
          io.to(session_id).emit('negotiation:status', { session });
          io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:status', data: { session } });
        }

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

        if (io) {
          io.to(session_id).emit('negotiation:status', { session });
          io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:status', data: { session } });
        }

        return res.status(422).json({
          status: 'blocked_by_firewall',
          message: 'Cannot close deal below merchant floor price.'
        });
      }

      // HITL GOVERNANCE GATE:
      // An autonomous deal cannot be finalized without Human Merchant sign-off if:
      // 1. fwVal.needs_hitl is true (price is near floor)
      // 2. The buyer is a Chronic Lowballer / High-Risk Account bidding below target price!
      // 3. The session has not yet received human executive sign-off (!session.hitl_action)
      const isChronicLowballerBelowTarget = (session.buyer_persona.includes('lowballer') || customerProfile?.loyalty_tier === 'CHRONIC_LOWBALLER') && agreedPrice < product.target_price;

      if ((fwVal.needs_hitl || isChronicLowballerBelowTarget) && !session.hitl_action) {
        session.status = 'pending_hitl';
        session.pending_proposed_price = agreedPrice;
        session.hitl_reason = fwVal.needs_hitl 
          ? fwVal.reason 
          : `Executive governance policy: Autonomous deal closure with Chronic Lowballer at ₹${agreedPrice}/unit (below target ₹${product.target_price}) requires Human Merchant approval.`;
        await session.save();

        const hitlMsg = await NegotiationMessage.create({
          session_id: session.session_id,
          sender: 'system',
          message: `⏸️ [HUMAN-IN-THE-LOOP REQUIRED] Agreed price ₹${agreedPrice}/unit is below target margin with a High-Risk Lowballer account. Autonomous lock suspended awaiting Merchant Executive authorization.`,
          proposed_price: agreedPrice,
          policy_reason: 'HITL_LOWBALLER_APPROVAL_REQUIRED',
          firewall_result: 'pass',
          round: session.rounds_count
        });

        if (io) {
          io.to(session_id).emit('negotiation:turn', hitlMsg);
          io.to(session_id).emit('negotiation:hitl_required', { session, message: hitlMsg });
          io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:hitl_required', data: { session, message: hitlMsg } });
        }

        return res.json({
          status: 'pending_hitl',
          session_id,
          current_round: session.rounds_count,
          pending_price: agreedPrice,
          message: 'Session paused for Merchant Executive review.',
          merchant_response: {
            message: hitlMsg.message,
            proposed_price_inr: agreedPrice,
            policy_reason: 'HITL_LOWBALLER_APPROVAL_REQUIRED',
            action: 'pending_hitl'
          }
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

      if (io) {
        io.to(session_id).emit('negotiation:status', { session });
        io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:status', data: { session } });
      }

      return res.json({
        status: 'no_deal',
        message: 'External agent ended the negotiation without mutual agreement.'
      });
    }

    // 3. GENERATE PARLAY MERCHANT COUNTER-OFFER (WITH CUSTOMER MEMORY)
    const history = await NegotiationMessage.find({ session_id }).sort({ timestamp: 1 }).lean();
    const customerProfile = await customerMemoryService.getOrCreateCustomerProfile(session.buyer_persona);

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
        } : null,
        customerProfile
      });
    } catch (llmErr) {
      merchantTurn = {
        message: `We can offer ₹${Math.max(product.floor_price, Math.round(product.target_price * 1.02))}/unit with standard enterprise warranty.`,
        proposed_price: Math.max(product.floor_price, Math.round(product.target_price * 1.02)),
        policy_reason: 'Automated fallback counter preserving target margin',
        action: 'continue'
      };
    }

    // 4. Check if merchant declared no_deal (Walkaway Retention Protocol)
    if (merchantTurn.action === 'no_deal') {
      if (product.negotiable && session.rounds_count >= 3 && !session.hitl_action) {
        // Retention price should match buyer's bid if at or above floor; never undercut the buyer's own bid!
        const retentionPrice = (numericOffer && numericOffer >= product.floor_price)
          ? numericOffer
          : Math.max(product.floor_price, Math.round(product.floor_price * 1.03));

        session.status = 'pending_hitl';
        session.pending_proposed_price = retentionPrice;
        session.hitl_reason = `Executive walk-away retention at ₹${retentionPrice}/unit (Floor: ₹${product.floor_price}). Client reached budget ceiling — Requires Merchant approval.`;
        await session.save();

        const retentionMsg = await NegotiationMessage.create({
          session_id: session.session_id,
          sender: 'merchant',
          message: `Before you walk away — we value long-term enterprise procurement relationships. For an order of ${session.quantity} ${product.unit || 'units'}, our executive pricing desk can authorize a retention concession at ₹${retentionPrice}/unit (subject to immediate management approval).`,
          proposed_price: retentionPrice,
          policy_reason: `WALKAWAY_RETENTION_PROTOCOL: Executive retention concession at ₹${retentionPrice} to retain bulk client. Escalating to Human Merchant review.`,
          firewall_result: 'pass',
          round: session.rounds_count
        });

        if (io) {
          io.to(session_id).emit('negotiation:turn', retentionMsg);
          io.to(session_id).emit('negotiation:hitl_required', { session, message: retentionMsg });
          io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:hitl_required', data: { session, message: retentionMsg } });
        }

        return res.json({
          status: 'pending_hitl',
          session_id,
          current_round: session.rounds_count,
          pending_price: retentionPrice,
          message: 'Walk-away retention protocol triggered. Paused for Merchant approval.',
          merchant_response: {
            message: retentionMsg.message,
            proposed_price_inr: retentionPrice,
            policy_reason: retentionMsg.policy_reason,
            action: 'pending_hitl'
          }
        });
      }

      // Conclude with no_deal cleanly
      session.status = 'no_deal';
      session.closed_at = new Date();
      await session.save();

      const merchantMsg = await NegotiationMessage.create({
        session_id,
        sender: 'merchant',
        message: merchantTurn.message,
        proposed_price: null,
        policy_reason: merchantTurn.policy_reason,
        firewall_result: 'pass',
        round: session.rounds_count
      });

      if (io) {
        io.to(session_id).emit('negotiation:turn', merchantMsg);
        io.to(session_id).emit('negotiation:status', { session });
        io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:status', data: { session } });
      }

      return res.json({
        status: 'no_deal',
        session_id,
        message: 'Merchant concluded negotiation rounds without price concession.',
        merchant_response: {
          message: merchantTurn.message,
          proposed_price_inr: null,
          policy_reason: merchantTurn.policy_reason,
          action: 'no_deal'
        }
      });
    }

    // 5. Check near-floor HITL condition on merchant proposed price
    let fwCheck = null;
    if (merchantTurn.proposed_price !== null && merchantTurn.proposed_price !== undefined) {
      fwCheck = await firewallCheck(merchantTurn.proposed_price, product.product_id);
      if (fwCheck.needs_hitl && !session.hitl_action) {
        session.status = 'pending_hitl';
        session.pending_proposed_price = merchantTurn.proposed_price;
        session.hitl_reason = fwCheck.reason;
        await session.save();

        const hitlMsg = await NegotiationMessage.create({
          session_id,
          sender: 'merchant',
          message: merchantTurn.message,
          proposed_price: merchantTurn.proposed_price,
          policy_reason: 'HITL_NEAR_FLOOR_APPROVAL_REQUIRED',
          firewall_result: 'pass',
          round: session.rounds_count
        });

        if (io) {
          io.to(session_id).emit('negotiation:turn', hitlMsg);
          io.to(session_id).emit('negotiation:hitl_required', { session, message: hitlMsg });
          io.emit('negotiation:global_update', { sessionId: session_id, event: 'negotiation:hitl_required', data: { session, message: hitlMsg } });
        }

        return res.json({
          status: 'pending_hitl',
          session_id,
          current_round: session.rounds_count,
          pending_price: merchantTurn.proposed_price,
          message: 'Proposed price is near minimum floor boundary. Session paused awaiting Merchant Executive authorization.',
          merchant_response: {
            message: merchantTurn.message,
            proposed_price_inr: merchantTurn.proposed_price,
            policy_reason: 'HITL_NEAR_FLOOR_APPROVAL_REQUIRED',
            action: 'pending_hitl'
          }
        });
      }
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
      customer_profile: {
        company_name: customerProfile.company_name,
        loyalty_tier: customerProfile.loyalty_tier,
        trust_score: customerProfile.trust_score,
        lifetime_spend_inr: customerProfile.lifetime_spend_inr
      },
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

/**
 * GET /api/agent/orders
 *
 * Retrieves the Procurement Audit Ledger for buyer agents and the catalog portal.
 * Returns past procurement negotiations, settlement receipts, savings achieved,
 * and tax invoice metadata.
 */
const getAgentOrders = async (req, res) => {
  try {
    const { persona, status } = req.query;
    const query = {};
    if (persona && persona !== 'all') {
      query.buyer_persona = persona;
    }
    if (status && status !== 'all') {
      if (status === 'paid') {
        query.status = 'deal_closed';
        query.payment_status = 'paid';
      } else if (status === 'pending') {
        query.status = 'deal_closed';
        query.payment_status = { $ne: 'paid' };
      } else if (status === 'quarantined') {
        query.status = 'blocked_by_firewall';
      } else if (status === 'deal_closed') {
        query.status = 'deal_closed';
      }
    } else {
      query.status = { $in: ['deal_closed', 'blocked_by_firewall'] };
    }

    const sessions = await NegotiationSession.find(query)
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const orders = sessions.map(s => {
      const isClosed = s.status === 'deal_closed';
      const listPrice = s.list_price_snapshot || 0;
      const unitPrice = isClosed ? (s.final_price || listPrice) : 0;
      const qty = s.quantity || 1;
      const subtotal = Math.round(unitPrice * qty);
      const totalWithGst = Math.round(subtotal * 1.18);
      const listTotal = Math.round(listPrice * qty);
      const savingsInr = isClosed ? Math.max(0, listTotal - subtotal) : 0;
      const savingsPct = (isClosed && listTotal > 0) ? Number(((savingsInr / listTotal) * 100).toFixed(1)) : 0;

      return {
        session_id: s.session_id,
        invoice_number: isClosed ? `INV-PAR-${s.session_id.substring(4, 12).toUpperCase()}` : null,
        receipt_number: (isClosed && s.payment_status === 'paid') ? `RCPT-PAR-${s.session_id.substring(4, 12).toUpperCase()}` : null,
        product_id: s.product_id,
        product_name: s.product_name,
        quantity: qty,
        list_price_inr: listPrice,
        final_price_inr: s.final_price,
        floor_price_snapshot: s.floor_price_snapshot,
        savings_inr: savingsInr,
        savings_pct: savingsPct,
        subtotal_inr: subtotal,
        gst_inr: totalWithGst - subtotal,
        total_inr: totalWithGst,
        status: s.status,
        payment_status: isClosed ? (s.payment_status || 'unpaid') : 'n/a',
        razorpay_payment_id: s.razorpay_payment_id,
        razorpay_order_id: s.razorpay_order_id,
        buyer_persona: s.buyer_persona,
        buyer_agent_name: s.buyer_agent_name || `${s.buyer_persona} Agent`,
        rounds_completed: s.rounds_count || 0,
        quarantine_reason: s.quarantine_reason,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
        paid_at: s.paid_at
      };
    });

    const closedOrders = orders.filter(o => o.status === 'deal_closed');
    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const totalSpent = paidOrders.reduce((sum, o) => sum + o.total_inr, 0);
    const totalSavings = closedOrders.reduce((sum, o) => sum + o.savings_inr, 0);

    res.json({
      success: true,
      summary: {
        total_deals: closedOrders.length,
        paid_deals: paidOrders.length,
        pending_payment: closedOrders.length - paidOrders.length,
        total_spend_inr: totalSpent,
        total_savings_inr: totalSavings
      },
      orders
    });
  } catch (err) {
    console.error('[AgentGateway] getAgentOrders error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/agent/profiles
 * Returns all recognized B2B customer profiles with reputation metrics.
 */
const getCustomerProfiles = async (req, res) => {
  try {
    const profiles = await customerMemoryService.getAllCustomerProfiles();
    res.json({
      success: true,
      count: profiles.length,
      profiles
    });
  } catch (err) {
    console.error('[AgentGateway] getCustomerProfiles error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getAgentCatalog,
  createAgentRfq,
  handleAgentNegotiate,
  handleAgentSettle,
  getAgentOrders,
  getCustomerProfiles
};
