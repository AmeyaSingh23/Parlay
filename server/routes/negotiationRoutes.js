const express = require('express');
const router = express.Router();
const {
  startNegotiation,
  getAllSessions,
  getSessionById,
  approveHitl,
  rejectHitl,
  getPersonas
} = require('../controllers/negotiationController');

router.post('/start', startNegotiation);
router.get('/sessions', getAllSessions);
router.get('/sessions/:sessionId', getSessionById);
router.post('/sessions/:sessionId/approve', approveHitl);
router.post('/sessions/:sessionId/reject', rejectHitl);
router.get('/personas', getPersonas);

module.exports = router;
