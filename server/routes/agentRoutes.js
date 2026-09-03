const express = require('express');
const router = express.Router();
const {
  getAgentCatalog,
  createAgentRfq,
  handleAgentNegotiate,
  handleAgentSettle,
  getAgentOrders,
  getCustomerProfiles
} = require('../controllers/agentGatewayController');

/**
 * Public Agent-to-Agent (A2A) Gateway Endpoints:
 * Allows external autonomous AI procurement agents, MCP clients, and scripts
 * to discover inventory, submit RFQs, negotiate with deterministic firewall protection,
 * and execute bounded Razorpay settlements.
 */
router.get('/catalog', getAgentCatalog);
router.post('/rfq', createAgentRfq);
router.post('/negotiate', handleAgentNegotiate);
router.post('/settle', handleAgentSettle);
router.get('/orders', getAgentOrders);
router.get('/profiles', getCustomerProfiles);

module.exports = router;
