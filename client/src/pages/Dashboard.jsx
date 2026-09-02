import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/Navbar';
import ProductSelector from '../components/ProductSelector';
import TranscriptPanel from '../components/TranscriptPanel';
import SessionList from '../components/SessionList';
import FloorPriceModal from '../components/FloorPriceModal';
import InvoiceModal from '../components/InvoiceModal';
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
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

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
      toast.error(`FIREWALL BLOCKED ₹${fwMsg.proposed_price}: Below live floor!`, { duration: 5000 });
      setMessages((prev) => [...prev, fwMsg]);
    };

    const handleHitl = ({ session, message }) => {
      toast('Human-in-the-Loop review required (near floor price)', { icon: '⚠️', duration: 6000 });
      setCurrentSession(session);
      setIsNegotiating(false);
      setMessages((prev) => [...prev, message]);
      fetchSessions();
    };

    const handleDealClosed = ({ session, message, razorpay_order_id, total_amount }) => {
      toast.success(`Deal Closed! Razorpay Order: ${razorpay_order_id}`, { duration: 6000 });
      setCurrentSession(session);
      setIsNegotiating(false);
      setMessages((prev) => [...prev, message]);
      fetchSessions();
      setIsInvoiceModalOpen(true);
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
      toast(`Live Floor updated for ${updatedProduct.name}: ₹${updatedProduct.floor_price}`, { icon: '📊' });
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

      toast.success(`Negotiation started with ${selectedPersona} persona!`);
      fetchSessions();

      // Immediately fetch any turns already generated
      try {
        const initialRes = await axios.get(`/negotiation/sessions/${newSession.session_id}`);
        if (initialRes.data && initialRes.data.messages && initialRes.data.messages.length > 0) {
          setMessages(initialRes.data.messages);
        }
      } catch (e) {
        // Handled by live sockets
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start negotiation');
      setIsNegotiating(false);
    }
  };

  // Background active session poller (resilient fallback alongside WebSockets)
  useEffect(() => {
    if (!isNegotiating || !currentSession?.session_id) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/negotiation/sessions/${currentSession.session_id}`);
        if (res.data) {
          if (res.data.messages && res.data.messages.length > 0) {
            setMessages(res.data.messages);
          }
          if (res.data.session) {
            setCurrentSession(res.data.session);
            if (res.data.session.status !== 'ongoing') {
              setIsNegotiating(false);
              fetchSessions();
            }
          }
        }
      } catch (e) {
        // Polling retry
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isNegotiating, currentSession?.session_id]);

  // Inspect Past Session
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
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#f8fafc]">
      {/* Top Navbar */}
      <Navbar onOpenFloorModal={() => setIsFloorModalOpen(true)} />

      {/* Main 3-Column Arena Layout (Fixed 100vh Shell) */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Column: Setup (3 cols) */}
        <div className="lg:col-span-3 h-full min-h-0 overflow-hidden">
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

        {/* Center Column: Live Arena (6 cols) */}
        <div className="lg:col-span-6 h-full min-h-0 overflow-hidden">
          <TranscriptPanel
            session={currentSession}
            messages={messages}
            isNegotiating={isNegotiating}
            onApproveHitl={handleApproveHitl}
            onRejectHitl={handleRejectHitl}
            onOpenInvoice={() => setIsInvoiceModalOpen(true)}
          />
        </div>

        {/* Right Column: Audit Log (3 cols) */}
        <div className="lg:col-span-3 h-full min-h-0 overflow-hidden">
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

      {/* Floor Price Override Modal */}
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

      {/* B2B Commercial Proforma Invoice & Hosted Checkout Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        session={currentSession}
        product={products.find(p => p.product_id === currentSession?.product_id)}
        onPaymentSuccess={(updatedSession) => {
          if (updatedSession) {
            setCurrentSession(updatedSession);
          } else {
            setCurrentSession(prev => prev ? { ...prev, payment_status: 'paid', paid_at: new Date() } : null);
          }
          fetchSessions();
        }}
      />
    </div>
  );
}
