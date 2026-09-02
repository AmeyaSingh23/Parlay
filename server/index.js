require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const inventoryRoutes = require('./routes/inventoryRoutes');
const negotiationRoutes = require('./routes/negotiationRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const startCleanupJob = require('./jobs/cleanupOrders');
const { NegotiationOrchestrator } = require('./orchestrator/negotiationOrchestrator');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Attach Socket.io and Orchestrator to Express app
const orchestrator = new NegotiationOrchestrator(io);
app.set('io', io);
app.set('orchestrator', orchestrator);

// Global Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());

// Socket.io Real-Time Channel Handlers
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Join a specific negotiation session room for real-time live transcript feed
  socket.on('join:session', (sessionId) => {
    if (sessionId) {
      socket.join(sessionId);
      console.log(`[Socket.io] Socket ${socket.id} joined session room: ${sessionId}`);
    }
  });

  socket.on('leave:session', (sessionId) => {
    if (sessionId) {
      socket.leave(sessionId);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Parlay B2B Negotiation API',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    firewall: 'active'
  });
});

// Mount API Routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/negotiation', negotiationRoutes);
app.use('/api/users', authRoutes);
app.use('/api/payment', paymentRoutes);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected to Parlay database');
    startCleanupJob();
    server.listen(PORT, () => {
      console.log(`🚀 Parlay Server + Socket.io running on port ${PORT}`);
      console.log(`🛡️  Deterministic Code Firewall Active`);
      console.log(`🤖 LLM Agent Modules Active (Gemini on GCP Vertex AI)`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
