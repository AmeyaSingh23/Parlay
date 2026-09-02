const NegotiationSession = require('../models/NegotiationSession');
const NegotiationMessage = require('../models/NegotiationMessage');
const MerchantInventoryItem = require('../models/MerchantInventoryItem');
const { PERSONA_DEFINITIONS } = require('../agents/personaConfigs');

// POST /api/negotiation/start
const startNegotiation = async (req, res) => {
  try {
    const { product_id, quantity, buyer_persona } = req.body;

    if (!product_id || !buyer_persona) {
      return res.status(400).json({ message: 'product_id and buyer_persona are required.' });
    }

    const orchestrator = req.app.get('orchestrator');
    if (!orchestrator) {
      return res.status(500).json({ message: 'Negotiation orchestrator not initialized.' });
    }

    const session = await orchestrator.startSession({
      productId: product_id,
      quantity: Number(quantity) || 10,
      buyerPersona: buyer_persona
    });

    res.status(201).json({
      success: true,
      message: 'Negotiation session initiated.',
      session
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/negotiation/sessions
const getAllSessions = async (req, res) => {
  try {
    const sessions = await NegotiationSession.find().sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/negotiation/sessions/:sessionId
const getSessionById = async (req, res) => {
  try {
    const session = await NegotiationSession.findOne({ session_id: req.params.sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const messages = await NegotiationMessage.find({ session_id: req.params.sessionId }).sort({ timestamp: 1 });
    const product = await MerchantInventoryItem.findOne({ product_id: session.product_id });

    res.json({
      session,
      product,
      messages
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/negotiation/sessions/:sessionId/approve
const approveHitl = async (req, res) => {
  try {
    const { reason } = req.body;
    const orchestrator = req.app.get('orchestrator');

    const updatedSession = await orchestrator.handleHitlDecision(
      req.params.sessionId,
      'approved',
      reason || 'Approved by Merchant Manager via Dashboard'
    );

    res.json({
      success: true,
      message: 'Session approved and deal finalized.',
      session: updatedSession
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/negotiation/sessions/:sessionId/reject
const rejectHitl = async (req, res) => {
  try {
    const { reason } = req.body;
    const orchestrator = req.app.get('orchestrator');

    const updatedSession = await orchestrator.handleHitlDecision(
      req.params.sessionId,
      'rejected',
      reason || 'Rejected by Merchant Manager via Dashboard'
    );

    res.json({
      success: true,
      message: 'Session rejected and closed as no_deal.',
      session: updatedSession
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/negotiation/personas
const getPersonas = async (req, res) => {
  res.json(PERSONA_DEFINITIONS);
};

module.exports = {
  startNegotiation,
  getAllSessions,
  getSessionById,
  approveHitl,
  rejectHitl,
  getPersonas
};
