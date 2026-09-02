import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/Navbar';
import ProductSelector from '../components/ProductSelector';
import TranscriptPanel from '../components/TranscriptPanel';
import SessionList from '../components/SessionList';
import FloorPriceModal from '../components/FloorPriceModal';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const socket = useSocket();

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [personas, setPersonas] = useState({});
  const [selectedPersona, setSelectedPersona] = useState('reasonable');
  const [quantity, setQuantity] = useState(50);

  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [isNegotiating, setIsNegotiating] = useState(false);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);

  // Initial Data Fetch
  useEffect(() => {
    fetchInventory();
    fetchPersonas();
    fetchSessions();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await axios.get('/inventory');
      setProducts(res.data);
      if (res.data.length > 0 && !selectedProduct) {
        setSelectedProduct(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  };

  const fetchPersonas = async () => {
    try {
      const res = await axios.get('/negotiation/personas');
      setPersonas(res.data);
    } catch (err) {
      console.error('Failed to load personas:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get('/negotiation/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  // Socket.io Real-Time Listeners
  useEffect(() => {
    if (!socket) return;

    const handleTurn = (msg) => {
      setMessages((prev) => {
        if (msg._id && prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    const handleFirewall = (fwMsg) => {
      toast.error(`⚠️ FIREWALL BLOCKED proposal of ₹${fwMsg.proposed_price}: Below live floor!`, { duration: 5000 });
      setMessages((prev) => [...prev, fwMsg]);
    };

    const handleHitl = ({ session, message }) => {
      toast('🛑 Human-in-the-Loop review triggered (near-floor price)', { icon: '⚠️', duration: 6000 });
      setCurrentSession(session);
      setIsNegotiating(false);
      setMessages((prev) => [...prev, message]);
      fetchSessions();
    };

    const handleDealClosed = ({ session, message, razorpay_order_id, total_amount }) => {
      toast.success(`🎉 Deal Closed! Razorpay Order: ${razorpay_order_id} (₹${total_amount})`, { duration: 6000 });
      setCurrentSession(session);
      setIsNegotiating(false);
      setMessages((prev) => [...prev, message]);
      fetchSessions();
    };

    const handleStatus = ({ session, message }) => {
      setCurrentSession(session);
      setIsNegotiating(false);
      if (message) {
        setMessages((prev) => [...prev, message]);
      }
      fetchSessions();
    };

    const handleInventoryUpdated = (updatedProduct) => {
      toast(`⚡ Live Floor mutated for ${updatedProduct.name}: ₹${updatedProduct.floor_price}`, { icon: '📊' });
      setProducts((prev) => prev.map(p => p.product_id === updatedProduct.product_id ? updatedProduct : p));
      setSelectedProduct((prev) => prev?.product_id === updatedProduct.product_id ? updatedProduct : prev);
    };

    socket.on('negotiation:turn', handleTurn);
    socket.on('negotiation:firewall', handleFirewall);
    socket.on('negotiation:hitl_required', handleHitl);
    socket.on('negotiation:deal_closed', handleDealClosed);
    socket.on('negotiation:status', handleStatus);
    socket.on('inventory:updated', handleInventoryUpdated);

    return () => {
      socket.off('negotiation:turn', handleTurn);
      socket.off('negotiation:firewall', handleFirewall);
      socket.off('negotiation:hitl_required', handleHitl);
      socket.off('negotiation:deal_closed', handleDealClosed);
      socket.off('negotiation:status', handleStatus);
      socket.off('inventory:updated', handleInventoryUpdated);
    };
  }, [socket]);

  // Start Live Negotiation
  const handleStartNegotiation = async () => {
    if (!selectedProduct) return;

    setIsNegotiating(true);
    setMessages([]);

    try {
      const res = await axios.post('/negotiation/start', {
        product_id: selectedProduct.product_id,
        quantity: Number(quantity),
        buyer_persona: selectedPersona
      });

      const newSession = res.data.session;
      setCurrentSession(newSession);

      if (socket) {
        socket.emit('join:session', newSession.session_id);
      }

      toast.success(`Session started against ${selectedPersona} persona!`);
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start negotiation');
      setIsNegotiating(false);
    }
  };

  // Inspect Past Session from Audit Log
  const handleSelectSession = async (sessionId) => {
    try {
      const res = await axios.get(`/negotiation/sessions/${sessionId}`);
      setCurrentSession(res.data.session);
      setMessages(res.data.messages);

      const matchedProd = products.find(p => p.product_id === res.data.session.product_id);
      if (matchedProd) setSelectedProduct(matchedProd);

      if (socket) {
        socket.emit('join:session', sessionId);
      }
    } catch (err) {
      toast.error('Failed to load session transcript');
    }
  };

  // HITL Decisions
  const handleApproveHitl = async (sessionId) => {
    try {
      await axios.post(`/negotiation/sessions/${sessionId}/approve`, {
        reason: 'Authorized via Merchant Dashboard'
      });
      toast.success('HITL Proposal approved! Finalizing Razorpay checkout...');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve HITL proposal');
    }
  };

  const handleRejectHitl = async (sessionId) => {
    try {
      await axios.post(`/negotiation/sessions/${sessionId}/reject`, {
        reason: 'Declined by Merchant to protect margin'
      });
      toast('HITL Proposal rejected and negotiation closed.', { icon: '🛑' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject HITL proposal');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10]">
      {/* Top Navbar */}
      <Navbar onOpenFloorModal={() => setIsFloorModalOpen(true)} />

      {/* Main 3-Column Arena Layout */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-62px)]">
        {/* Left Column: Setup (3 cols) */}
        <div className="lg:col-span-3 h-full overflow-hidden">
          <ProductSelector
            products={products}
            selectedProduct={selectedProduct}
            onSelectProduct={setSelectedProduct}
            personas={personas}
            selectedPersona={selectedPersona}
            onSelectPersona={setSelectedPersona}
            quantity={quantity}
            onChangeQuantity={setQuantity}
            onStartNegotiation={handleStartNegotiation}
            isNegotiating={isNegotiating}
          />
        </div>

        {/* Center Column: Live Real-Time Arena (6 cols) */}
        <div className="lg:col-span-6 h-full overflow-hidden">
          <TranscriptPanel
            session={currentSession}
            messages={messages}
            isNegotiating={isNegotiating}
            onApproveHitl={handleApproveHitl}
            onRejectHitl={handleRejectHitl}
          />
        </div>

        {/* Right Column: Audit Log & Sessions History (3 cols) */}
        <div className="lg:col-span-3 h-full overflow-hidden">
          <SessionList
            sessions={sessions}
            currentSessionId={currentSession?.session_id}
            onSelectSession={handleSelectSession}
            onRefresh={fetchSessions}
            onApproveHitl={handleApproveHitl}
            onRejectHitl={handleRejectHitl}
          />
        </div>
      </main>

      {/* Dynamic Price Mutation Modal for Scenario C */}
      <FloorPriceModal
        isOpen={isFloorModalOpen}
        onClose={() => setIsFloorModalOpen(false)}
        products={products}
        onPriceUpdated={(updated) => {
          setProducts(prev => prev.map(p => p.product_id === updated.product_id ? updated : p));
          if (selectedProduct?.product_id === updated.product_id) {
            setSelectedProduct(updated);
          }
        }}
      />
    </div>
  );
}
