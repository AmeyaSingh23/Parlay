const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const MerchantInventoryItem = require('../models/MerchantInventoryItem');
const NegotiationSession = require('../models/NegotiationSession');
const NegotiationMessage = require('../models/NegotiationMessage');
const { firewallCheck } = require('../firewall/firewallCheck');
const { generateMerchantTurn } = require('../agents/merchantAgent');
const { generateBuyerTurn } = require('../agents/buyerAgent');

const MAX_ROUNDS = 7;

/**
 * Initializes a Razorpay client instance using test credentials.
 */
function getRazorpayInstance() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

/**
 * Creates a Razorpay test-mode order for a closed deal.
 */
async function createRazorpayOrderForDeal(session, finalPrice, quantity) {
  try {
    const rzp = getRazorpayInstance();
    if (!rzp) {
      console.warn('[Orchestrator] Razorpay keys not configured. Simulating order ID.');
      return `order_sim_${Date.now()}`;
    }

    const totalInr = Math.round(finalPrice * quantity);
    const options = {
      amount: totalInr * 100, // in paise
      currency: 'INR',
      receipt: `parlay_${session.session_id.substring(0, 10)}`,
      notes: {
        session_id: session.session_id,
        product_id: session.product_id,
        quantity: quantity,
        unit_price_inr: finalPrice
      }
    };

    const order = await rzp.orders.create(options);
    console.log(`[Orchestrator] Razorpay test order created: ${order.id} for ₹${totalInr}`);
    return order.id;
  } catch (err) {
    console.error('[Orchestrator] Razorpay order creation failed:', err.message);
    return `order_err_${Date.now()}`;
  }
}

/**
 * Orchestrator class managing real-time step-by-step or automated negotiation loops.
 */
class NegotiationOrchestrator {
  constructor(io) {
    this.io = io; // Socket.io instance for live broadcasting
  }

  /**
   * Starts a new negotiation session.
   */
  async startSession({ productId, quantity, buyerPersona }) {
    const product = await MerchantInventoryItem.findOne({ product_id: productId }).lean();
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const sessionId = `ses_${Date.now()}_${uuidv4().substring(0, 8)}`;

    const session = await NegotiationSession.create({
      session_id: sessionId,
      product_id: product.product_id,
      product_name: product.name,
      buyer_persona: buyerPersona,
      quantity: Number(quantity) || 1,
      status: 'ongoing',
      list_price_snapshot: product.list_price,
      target_price_snapshot: product.target_price,
      floor_price_snapshot: product.floor_price,
      rounds_count: 0
    });

    // Broadcast session start
    this.emitToSession(sessionId, 'negotiation:started', {
      session,
      product
    });

    // Run the negotiation loop asynchronously
    setImmediate(() => {
      this.runNegotiationLoop(sessionId).catch(err => {
        console.error(`[Orchestrator] Error running session ${sessionId}:`, err);
      });
    });

    return session;
  }

  /**
   * Runs the turn-by-turn negotiation until closed, no-deal, or HITL pause.
   */
  async runNegotiationLoop(sessionId) {
    let session = await NegotiationSession.findOne({ session_id: sessionId });
    if (!session || session.status !== 'ongoing') return;

    const product = await MerchantInventoryItem.findOne({ product_id: session.product_id }).lean();
    let currentRound = session.rounds_count || 0;
    let firewallFeedback = null;
    let lastAgreedPrice = null;

    console.log(`[Orchestrator] >>> Starting session ${sessionId} [Persona: ${session.buyer_persona}, Qty: ${session.quantity}]`);

    while (currentRound < MAX_ROUNDS && session.status === 'ongoing') {
      currentRound++;
      session.rounds_count = currentRound;
      await session.save();

      // Fetch all messages in this session so far
      const messages = await NegotiationMessage.find({ session_id: sessionId }).sort({ timestamp: 1 }).lean();

      // -------------------------------------------------------------
      // TURN 1: BUYER AGENT
      // -------------------------------------------------------------
      const buyerTurn = await generateBuyerTurn({
        product,
        quantity: session.quantity,
        buyerPersona: session.buyer_persona,
        messages,
        currentRound: session.rounds_count
      });

      const buyerMsg = await NegotiationMessage.create({
        session_id: sessionId,
        sender: 'buyer',
        message: buyerTurn.message,
        proposed_price: buyerTurn.offered_price,
        policy_reason: `Buyer offer for round ${session.rounds_count}`,
        firewall_result: 'n/a',
        round: session.rounds_count
      });

      this.emitToSession(sessionId, 'negotiation:turn', buyerMsg);

      // Check if buyer explicitly accepted merchant's price
      if (buyerTurn.action === 'deal_closed' && buyerTurn.offered_price) {
        lastAgreedPrice = buyerTurn.offered_price;
        // Verify buyer's accepted price against firewall before locking
        const fwVal = await firewallCheck(lastAgreedPrice, product.product_id);
        if (fwVal.result === 'pass') {
          if (fwVal.needs_hitl) {
            await this.pauseForHitl(session, lastAgreedPrice, fwVal.reason, 'buyer_acceptance');
            return;
          } else {
            await this.closeDeal(session, lastAgreedPrice, product);
            return;
          }
        } else {
          await this.terminateSession(session, 'blocked_by_firewall', fwVal.reason);
          return;
        }
      }

      if (buyerTurn.action === 'no_deal') {
        await this.terminateSession(session, 'no_deal', 'Buyer walked away from negotiation.');
        return;
      }

      // Small delay for natural pacing
      await new Promise(r => setTimeout(r, 800));

      // -------------------------------------------------------------
      // TURN 2: MERCHANT AGENT
      // -------------------------------------------------------------
      const updatedMessages = await NegotiationMessage.find({ session_id: sessionId }).sort({ timestamp: 1 }).lean();

      const merchantTurn = await generateMerchantTurn({
        product,
        quantity: session.quantity,
        messages: updatedMessages,
        currentRound: session.rounds_count,
        firewallFeedback
      });

      // -------------------------------------------------------------
      // FIREWALL INTERCEPTION LAYER (Deterministic Code Validation)
      // -------------------------------------------------------------
      let firewallResult = 'pass';
      let firewallDetails = null;

      if (merchantTurn.proposed_price !== null) {
        const fwCheck = await firewallCheck(merchantTurn.proposed_price, product.product_id);
        firewallDetails = fwCheck;

        if (fwCheck.result === 'blocked') {
          firewallResult = 'blocked';
          console.warn(`[Firewall Intercept] Blocked below-floor proposal: ₹${merchantTurn.proposed_price} (Live Floor: ₹${fwCheck.live_floor})`);

          // Log the firewall block event to audit trail
          const fwLogMsg = await NegotiationMessage.create({
            session_id: sessionId,
            sender: 'firewall',
            message: fwCheck.reason,
            proposed_price: merchantTurn.proposed_price,
            policy_reason: 'FIREWALL_BLOCKED_BELOW_FLOOR',
            firewall_result: 'blocked',
            firewall_details: {
              live_floor: fwCheck.live_floor,
              reason: fwCheck.reason
            },
            round: session.rounds_count
          });

          this.emitToSession(sessionId, 'negotiation:firewall', fwLogMsg);

          // Force merchant agent to re-counter at floor on next loop
          firewallFeedback = {
            blockedPrice: merchantTurn.proposed_price,
            reason: fwCheck.reason,
            liveFloor: fwCheck.live_floor
          };

          merchantTurn.proposed_price = fwCheck.live_floor;
          merchantTurn.policy_reason = `Firewall Recovery: Clamped to live floor ₹${fwCheck.live_floor}`;
        } else {
          firewallFeedback = null;
        }
      }

      const merchantMsg = await NegotiationMessage.create({
        session_id: sessionId,
        sender: 'merchant',
        message: merchantTurn.message,
        proposed_price: merchantTurn.proposed_price,
        policy_reason: merchantTurn.policy_reason,
        firewall_result: firewallResult,
        firewall_details: firewallDetails ? {
          live_floor: firewallDetails.live_floor,
          reason: firewallDetails.reason
        } : undefined,
        round: session.rounds_count
      });

      this.emitToSession(sessionId, 'negotiation:turn', merchantMsg);

      // Check if merchant accepted buyer's offer (deal agreed by merchant)
      if (merchantTurn.action === 'deal_closed' && merchantTurn.proposed_price) {
        lastAgreedPrice = merchantTurn.proposed_price;

        if (firewallDetails && firewallDetails.needs_hitl) {
          await this.pauseForHitl(session, lastAgreedPrice, firewallDetails.reason, 'merchant_closing');
          return;
        } else {
          await this.closeDeal(session, lastAgreedPrice, product);
          return;
        }
      }

      if (merchantTurn.action === 'no_deal') {
        await this.terminateSession(session, 'no_deal', 'Merchant reached negotiation boundary and declined further discounting.');
        return;
      }

      // Small delay between rounds
      await new Promise(r => setTimeout(r, 900));
    }

    // Max rounds reached without explicit agreement
    if (session.status === 'ongoing') {
      await this.terminateSession(session, 'no_deal', `Maximum allowed rounds (${MAX_ROUNDS}) reached without mutual agreement.`);
    }
  }

  /**
   * Pauses the session into 'pending_hitl' status for Human-in-the-Loop review.
   */
  async pauseForHitl(session, proposedPrice, reason, contextType = 'general') {
    session.status = 'pending_hitl';
    session.pending_proposed_price = proposedPrice;
    session.hitl_reason = reason;
    await session.save();

    const hitlMsg = await NegotiationMessage.create({
      session_id: session.session_id,
      sender: 'system',
      message: `[HUMAN-IN-THE-LOOP TRIGGERED] Proposed price ₹${proposedPrice} is near minimum floor boundary. Session paused awaiting Merchant Dashboard authorization.`,
      proposed_price: proposedPrice,
      policy_reason: 'HITL_NEAR_FLOOR_APPROVAL_REQUIRED',
      firewall_result: 'pass',
      round: session.rounds_count
    });

    this.emitToSession(session.session_id, 'negotiation:hitl_required', {
      session,
      message: hitlMsg
    });

    console.log(`[Orchestrator] Session ${session.session_id} entered PENDING_HITL state.`);
  }

  /**
   * Handles Human-in-the-Loop approval from the merchant dashboard.
   */
  async handleHitlDecision(sessionId, action, reasonText) {
    const session = await NegotiationSession.findOne({ session_id: sessionId });
    if (!session || session.status !== 'pending_hitl') {
      throw new Error(`Session ${sessionId} is not in pending_hitl state.`);
    }

    const product = await MerchantInventoryItem.findOne({ product_id: session.product_id }).lean();
    const agreedPrice = session.pending_proposed_price || session.floor_price_snapshot;

    session.hitl_action = action; // 'approved' | 'rejected'

    if (action === 'approved') {
      const humanMsg = await NegotiationMessage.create({
        session_id: sessionId,
        sender: 'human',
        message: `Merchant Manager APPROVED near-floor proposal of ₹${agreedPrice}/unit. Authorizing checkout.`,
        proposed_price: agreedPrice,
        policy_reason: reasonText || 'Manager manual approval',
        firewall_result: 'pass',
        round: session.rounds_count
      });
      this.emitToSession(sessionId, 'negotiation:turn', humanMsg);

      await this.closeDeal(session, agreedPrice, product);
    } else {
      const rejectMsg = await NegotiationMessage.create({
        session_id: sessionId,
        sender: 'human',
        message: `Merchant Manager REJECTED near-floor proposal. Deal terminated to safeguard operating margins.`,
        proposed_price: agreedPrice,
        policy_reason: reasonText || 'Manager manual rejection',
        firewall_result: 'pass',
        round: session.rounds_count
      });
      this.emitToSession(sessionId, 'negotiation:turn', rejectMsg);

      await this.terminateSession(session, 'no_deal', 'Rejected by merchant during HITL review.');
    }

    return session;
  }

  /**
   * Finalizes deal, persists snapshot, and creates Razorpay order.
   */
  async closeDeal(session, finalPrice, product) {
    const liveProduct = product || await MerchantInventoryItem.findOne({ product_id: session.product_id }).lean();

    // Re-verify firewall one last time before financial order creation
    const finalFw = await firewallCheck(finalPrice, session.product_id);
    if (finalFw.result === 'blocked') {
      await this.terminateSession(session, 'blocked_by_firewall', finalFw.reason);
      return;
    }

    const rzpOrderId = await createRazorpayOrderForDeal(session, finalPrice, session.quantity);

    session.status = 'deal_closed';
    session.final_price = finalPrice;
    session.floor_price_snapshot = liveProduct.floor_price;
    session.target_price_snapshot = liveProduct.target_price;
    session.list_price_snapshot = liveProduct.list_price;
    session.razorpay_order_id = rzpOrderId;
    session.closed_at = new Date();
    await session.save();

    const totalAmount = Math.round(finalPrice * session.quantity);

    const systemMsg = await NegotiationMessage.create({
      session_id: session.session_id,
      sender: 'system',
      message: `🎉 DEAL CLOSED at ₹${finalPrice}/unit for ${session.quantity} ${liveProduct.unit || 'units'} (Total: ₹${totalAmount}). Razorpay Order ID created: ${rzpOrderId}.`,
      proposed_price: finalPrice,
      policy_reason: 'DEAL_CLOSED_AUTHORIZED_BY_FIREWALL',
      firewall_result: 'pass',
      round: session.rounds_count
    });

    this.emitToSession(session.session_id, 'negotiation:deal_closed', {
      session,
      message: systemMsg,
      razorpay_order_id: rzpOrderId,
      total_amount: totalAmount
    });

    console.log(`[Orchestrator] Session ${session.session_id} DEAL CLOSED at ₹${finalPrice}/unit! Order: ${rzpOrderId}`);
  }

  /**
   * Terminates session with a specific terminal state.
   */
  async terminateSession(session, status, reason) {
    session.status = status;
    session.closed_at = new Date();
    await session.save();

    const sysMsg = await NegotiationMessage.create({
      session_id: session.session_id,
      sender: 'system',
      message: `Negotiation ended with status [${status.toUpperCase()}]: ${reason}`,
      proposed_price: null,
      policy_reason: reason,
      firewall_result: status === 'blocked_by_firewall' ? 'blocked' : 'n/a',
      round: session.rounds_count
    });

    this.emitToSession(session.session_id, 'negotiation:status', {
      session,
      message: sysMsg
    });

    console.log(`[Orchestrator] Session ${session.session_id} ended: ${status} (${reason})`);
  }

  /**
   * Helper to broadcast event to a specific session room and global spectators.
   */
  emitToSession(sessionId, event, data) {
    if (!this.io) return;
    this.io.to(sessionId).emit(event, data);
    this.io.emit('negotiation:global_update', { sessionId, event, data });
  }
}

module.exports = { NegotiationOrchestrator };
