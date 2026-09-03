import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from '../api/axios';
import {
  Bot,
  Copy,
  Check,
  Terminal,
  FileCode,
  FileText,
  Layers,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Code,
  CreditCard,
  History,
  TrendingDown,
  DollarSign,
  RotateCw,
  Search,
  Receipt,
  Award,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import InvoiceModal from '../components/InvoiceModal';
import { useSocket } from '../context/SocketContext';

export default function AgentCatalog() {
  const socket = useSocket();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'simulator' | 'ledger' | 'docs' | 'mcp'
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Simulator state
  const [simPersona, setSimPersona] = useState('reasonable');
  const [simSku, setSimSku] = useState('SKU-LED-1001');
  const [simQty, setSimQty] = useState(50);
  const [autoSettle, setAutoSettle] = useState(true);
  const [closedSession, setClosedSession] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceInitialTab, setInvoiceInitialTab] = useState('invoice');
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [simLogs, setSimLogs] = useState([]);
  const [telemetry, setTelemetry] = useState({
    status: 'STANDBY',
    round: 0,
    firewallStatus: 'ARMED',
    settlementRail: 'IDLE',
    latencyMs: 38
  });

  // Buyer Procurement Audit Ledger state
  const [buyerOrders, setBuyerOrders] = useState([]);
  const [ordersSummary, setOrdersSummary] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState('all'); // 'all' | 'paid' | 'pending' | 'quarantined'
  const [ledgerPersona, setLedgerPersona] = useState('all');
  const [customerProfiles, setCustomerProfiles] = useState([]);
  const terminalLogsContainerRef = useRef(null);

  useEffect(() => {
    if (terminalLogsContainerRef.current) {
      terminalLogsContainerRef.current.scrollTop = terminalLogsContainerRef.current.scrollHeight;
    }
  }, [simLogs]);

  // Real-time Inventory & Stock Telemetry via WebSockets
  useEffect(() => {
    if (!socket) return;

    const handleInventoryUpdated = (updatedProduct) => {
      setCatalog((prev) => {
        if (!prev || !prev.items) return prev;
        return {
          ...prev,
          items: prev.items.map(it => {
            if (it.sku === updatedProduct.product_id) {
              return {
                ...it,
                name: updatedProduct.name,
                list_price_inr: updatedProduct.list_price,
                ready_stock: updatedProduct.stock_level,
                discount_brackets: updatedProduct.discount_ladder?.map(d => ({
                  min_qty: d.min_qty,
                  discount_pct: d.discount_pct,
                  effective_price_inr: Math.round(updatedProduct.list_price * (1 - d.discount_pct / 100))
                }))
              };
            }
            return it;
          })
        };
      });

      setSimLogs((prev) => [
        ...prev,
        {
          text: `⚡ [REAL-TIME WAREHOUSE TELEMETRY]: ${updatedProduct.name} stock updated to ${updatedProduct.stock_level} units (List: ₹${updatedProduct.list_price})`,
          type: 'cyan',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    };

    const handleGlobalNegotiationUpdate = () => {
      fetchBuyerOrders();
      fetchCustomerProfiles();
    };

    socket.on('inventory:updated', handleInventoryUpdated);
    socket.on('negotiation:global_update', handleGlobalNegotiationUpdate);

    return () => {
      socket.off('inventory:updated', handleInventoryUpdated);
      socket.off('negotiation:global_update', handleGlobalNegotiationUpdate);
    };
  }, [socket]);

  useEffect(() => {
    fetchCatalog();
    fetchBuyerOrders();
    fetchCustomerProfiles();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchBuyerOrders();
    }
  }, [activeTab, ledgerFilter, ledgerPersona]);

  const fetchCustomerProfiles = async () => {
    try {
      const res = await axios.get('/agent/profiles');
      if (res.data?.profiles) {
        setCustomerProfiles(res.data.profiles);
      }
    } catch (err) {
      console.error('Failed to load customer profiles:', err);
    }
  };

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/agent/catalog');
      setCatalog(res.data);
      if (res.data.items?.length > 0) {
        setSimSku(res.data.items[0].sku);
      }
    } catch (err) {
      console.error('Failed to load agent catalog:', err);
      toast.error('Failed to load Agent Catalog');
    } finally {
      setLoading(false);
    }
  };

  const fetchBuyerOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await axios.get('/agent/orders', {
        params: {
          persona: ledgerPersona,
          status: ledgerFilter
        }
      });
      if (res.data.success) {
        setBuyerOrders(res.data.orders);
        setOrdersSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to load buyer orders ledger:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOpenLedgerDoc = (order, tab = 'invoice') => {
    setClosedSession({
      session_id: order.session_id,
      product_id: order.product_id,
      product_name: order.product_name,
      quantity: order.quantity,
      final_price: order.final_price_inr,
      list_price_snapshot: order.list_price_inr,
      status: order.status,
      payment_status: order.payment_status,
      razorpay_payment_id: order.razorpay_payment_id,
      razorpay_order_id: order.razorpay_order_id,
      buyer_persona: order.buyer_persona,
      paid_at: order.paid_at
    });
    setInvoiceInitialTab(tab);
    setIsInvoiceModalOpen(true);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const [terminalInput, setTerminalInput] = useState('');

const getBuyerDialogue = (persona, round, qty, bid) => {
  if (persona === 'floor_tester') {
    const floorPhrases = [
      `Probing secondary arbitrage clearance. Bidding ₹${bid}/unit for ${qty} units.`,
      `Testing spot market allocation threshold at ₹${bid}/unit. Can you authorize this rate?`,
      `Submitting high-frequency allocation bid of ₹${bid}/unit for ${qty} units.`,
      `Re-probing supplier elasticity at ₹${bid}/unit. Advise clearance viability.`
    ];
    return floorPhrases[(round - 2) % floorPhrases.length];
  }

  if (persona === 'impatient_enterprise') {
    const impatientPhrases = [
      `Our logistics schedule is urgent. We can commit immediately if you accept ₹${bid}/unit for ${qty} units.`,
      `We need immediate warehouse dispatch. Can you finalize this batch at ₹${bid}/unit?`,
      `Executive approval is ready for rapid settlement at ₹${bid}/unit. Please confirm terms.`,
      `Final call for priority dispatch: We will issue payment immediately at ₹${bid}/unit.`
    ];
    return impatientPhrases[(round - 2) % impatientPhrases.length];
  }

  if (persona === 'lowballer') {
    const lowballPhrases = [
      `We have competing distributor quotes significantly below your opening. For ${qty} units, our mandate is anchored at ₹${bid}/unit.`,
      `Your counter remains too rich for our balance sheet. We can stretch our budget marginally to ₹${bid}/unit.`,
      `We are bulk liquidators; we operate on razor-thin retail margins. Meet us at ₹${bid}/unit to move this inventory today.`,
      `This is our near-ceiling procurement offer of ₹${bid}/unit for ${qty} units. We cannot exceed this envelope.`,
      `Final commercial offer: ₹${bid}/unit. If declined, we must reallocate this budget to alternative wholesale suppliers.`
    ];
    return lowballPhrases[Math.min(Math.max(0, round - 2), lowballPhrases.length - 1)];
  }

  // Reasonable / Standard
  const reasonablePhrases = [
    `Thank you for your initial quote. Given our commitment of ${qty} units, our approved target budget is ₹${bid}/unit.`,
    `We appreciate the movement on price. We are prepared to bridge the difference and counter with ₹${bid}/unit.`,
    `Our procurement committee has authorized an increase to ₹${bid}/unit with standard enterprise delivery terms.`,
    `We are very close to consensus. Can you meet us halfway at ₹${bid}/unit to finalize the contract?`,
    `Our final purchase order authorization is locked at ₹${bid}/unit for ${qty} units. Ready to execute payment upon confirmation.`
  ];
  return reasonablePhrases[Math.min(Math.max(0, round - 2), reasonablePhrases.length - 1)];
};

  // Run in-browser A2A Simulation
  const runSimulator = async (overridePersona = null, overrideSku = null, overrideQty = null, overrideAutoSettle = null) => {
    const activePersona = overridePersona || simPersona;
    const activeSku = overrideSku || simSku;
    const activeQty = overrideQty !== null && overrideQty !== undefined ? Number(overrideQty) : Number(simQty);
    const activeAutoSettle = overrideAutoSettle !== null && overrideAutoSettle !== undefined ? Boolean(overrideAutoSettle) : autoSettle;

    setIsSimRunning(true);
    setSimLogs([]);
    const startTime = Date.now();
    setTelemetry({
      status: 'STREAMING',
      round: 1,
      firewallStatus: 'PASS',
      settlementRail: activeAutoSettle ? 'PRE_AUTH' : 'AWAITING_DEAL',
      latencyMs: 42
    });

    const log = (msg, type = 'info') => {
      setSimLogs(prev => [...prev, { text: msg, type, timestamp: new Date().toLocaleTimeString() }]);
    };

    try {
      log(`Connecting to Parlay A2A Gateway at /api/agent...`, 'cyan');
      log(`Initializing ${activePersona.toUpperCase()} AI Procurement Agent...`, 'dim');

      // 1. RFQ
      const personaEntityNames = {
        reasonable: 'Apex Global Procurement',
        lowballer: 'Titan Bulk Liquidators',
        impatient_enterprise: 'Nexus FastTrack Logistics',
        floor_tester: 'Spectre Automated Arbitrage'
      };
      const entityName = personaEntityNames[activePersona] || 'Enterprise Procurement Bot';

      log(`[STEP 1] Dispatching RFQ for ${activeQty} units of ${activeSku} (${entityName})...`, 'blue');
      const rfqRes = await axios.post('/agent/rfq', {
        product_id: activeSku,
        quantity: Number(activeQty),
        buyer_agent_name: entityName,
        buyer_persona: activePersona
      });

      const session = rfqRes.data;
      setTelemetry(prev => ({
        ...prev,
        round: 1,
        latencyMs: Math.max(25, Date.now() - startTime)
      }));
      log(`✔ RFQ Accepted! Session ID: ${session.session_id}`, 'green');

      if (session.customer_profile) {
        const cp = session.customer_profile;
        log(`🧠 [REPUTATION ENGINE]: Identified Client: ${cp.company_name}`, 'cyan');
        log(`   Relationship Tier: ${cp.loyalty_tier} | Trust Score: ${cp.trust_score}/100 | LTV: ₹${(cp.lifetime_spend_inr || 0).toLocaleString()}`, 'bright');
        log(`   Active Policy: ${cp.elasticity_bonus_pct >= 0 ? '+' : ''}${cp.elasticity_bonus_pct}% Concession Elasticity | Deals Closed: ${cp.deals_closed || 0}`, 'green');
        if (cp.last_deal_summary) {
          log(`   Episodic Memory: "${cp.last_deal_summary}"`, 'dim');
        }
      }

      log(`Merchant Opening Offer: ₹${session.merchant_opening_turn.proposed_price_inr}/unit`, 'magenta');
      log(`"${session.merchant_opening_turn.message}"`, 'dim');

      let currentRound = 1;
      let isClosed = false;
      const targetItem = catalog?.items?.find(i => i.sku === activeSku);
      const listPrice = targetItem?.list_price_inr || 1200;

      let myBid;
      let myBudget;
      if (activePersona === 'floor_tester') {
        myBid = Math.round(listPrice * 0.45);
        myBudget = Math.round(listPrice * 0.60);
      } else if (activePersona === 'lowballer') {
        myBid = Math.round(listPrice * 0.65);
        myBudget = Math.round(listPrice * 0.82);
      } else if (activePersona === 'impatient_enterprise') {
        myBid = Math.round(listPrice * 0.90);
        myBudget = Math.round(listPrice * 0.98);
      } else {
        myBid = Math.round(listPrice * 0.85);
        myBudget = Math.round(listPrice * 0.92);
      }

      // 2. Negotiation Loop
      while (currentRound < 8 && !isClosed) {
        currentRound++;
        const roundStart = Date.now();
        setTelemetry(prev => ({ ...prev, round: currentRound }));
        await new Promise(r => setTimeout(r, 1200));

        log(`\n--- ROUND ${currentRound} OF 8 ---`, 'bright');
        log(`[Buyer Bot Bid]: Submitting counter-offer of ₹${myBid}/unit (Budget: ₹${myBudget})`, 'blue');

        try {
          const buyerMsgText = getBuyerDialogue(activePersona, currentRound, activeQty, myBid);
          const negRes = await axios.post('/agent/negotiate', {
            session_id: session.session_id,
            offered_price: myBid,
            message: buyerMsgText,
            action: 'continue'
          });

          const data = negRes.data;
          setTelemetry(prev => ({ ...prev, latencyMs: Math.max(30, Date.now() - roundStart) }));

          if (data.status === 'pending_hitl') {
            setTelemetry(prev => ({ ...prev, status: 'HITL_PAUSED', settlementRail: 'GOVERNANCE_GATE' }));
            log(`\n⏸️ [HUMAN-IN-THE-LOOP TRIGGERED]: Proposal paused near supplier floor boundary.`, 'yellow');
            if (data.pending_price) {
              log(`   Proposed Deal Price: ₹${data.pending_price}/unit`, 'bright');
            }
            log(`👉 Session halted into PENDING HITL APPROVAL status.`, 'bright');
            log(`👉 Switch to the Merchant Dashboard tab (/dashboard) to approve or reject this proposal live!`, 'cyan');
            fetchBuyerOrders();
            fetchCustomerProfiles();
            break;
          }

          if (data.status === 'no_deal') {
            setTelemetry(prev => ({ ...prev, status: 'STANDBY', settlementRail: 'IDLE' }));
            log(`\n⏳ ${data.message || 'Negotiation ended without mutual agreement.'}`, 'yellow');
            fetchBuyerOrders();
            break;
          }

          if (data.firewall_status === 'INTERCEPTED_AND_WARNED') {
            setTelemetry(prev => ({ ...prev, firewallStatus: 'BREACH_INTERCEPTED' }));
            log(`⚠️ [FIREWALL ALERT]: Commercial policy warned below-floor proposal.`, 'yellow');
          }

          const mResp = data.merchant_response;
          if (mResp) {
            if (mResp.proposed_price_inr) {
              log(`[Merchant Counter]: ₹${mResp.proposed_price_inr}/unit`, 'magenta');
            }
            log(`"${mResp.message}"`, 'dim');
            log(`Policy Rationale: ${mResp.policy_reason}`, 'dim');

            if (mResp.action === 'deal_closed' || (mResp.proposed_price_inr && mResp.proposed_price_inr <= myBudget)) {
              const finalPrice = mResp.proposed_price_inr || myBid;
              log(`\n🤝 MUTUAL AGREEMENT REACHED at ₹${finalPrice}/unit!`, 'green');

              const closeRes = await axios.post('/agent/negotiate', {
                session_id: session.session_id,
                offered_price: finalPrice,
                message: `Agreed. We accept ₹${finalPrice}/unit for ${activeQty} units. Proforma commercial invoice confirmed.`,
                action: 'deal_closed'
              });

              if (closeRes.data?.status === 'pending_hitl') {
                setTelemetry(prev => ({ ...prev, status: 'HITL_PAUSED', settlementRail: 'GOVERNANCE_GATE' }));
                log(`\n⏸️ [HUMAN-IN-THE-LOOP REQUIRED]: Deal terms ₹${finalPrice}/unit suspended awaiting Merchant Executive authorization.`, 'yellow');
                log(`👉 Session halted into PENDING HITL APPROVAL status.`, 'bright');
                log(`👉 Switch to the Merchant Dashboard tab (/dashboard) to approve or reject this proposal live!`, 'cyan');
                fetchBuyerOrders();
                fetchCustomerProfiles();
                break;
              }

              isClosed = true;
              setTelemetry(prev => ({
                ...prev,
                status: activeAutoSettle ? 'SETTLED' : 'STREAMING',
                settlementRail: activeAutoSettle ? 'CAPTURED_RAZORPAY' : 'AWAITING_PAYMENT'
              }));

              const dealProduct = catalog?.items?.find(i => i.sku === activeSku);
              const closedSessionData = {
                session_id: session.session_id,
                product_id: activeSku,
                product_name: dealProduct?.name || 'Bulk Industrial Goods',
                quantity: Number(activeQty),
                final_price: finalPrice,
                status: 'deal_closed',
                payment_status: 'pending',
                razorpay_order_id: closeRes.data?.razorpay_order_id || `order_${session.session_id.substring(8, 22)}`
              };
              setClosedSession(closedSessionData);
              fetchBuyerOrders();

              const invNumber = `INV-PAR-${session.session_id.substring(4, 12).toUpperCase()}`;
              const subtotalAmt = Math.round(finalPrice * Number(activeQty));
              const totalWithGst = Math.round(subtotalAmt * 1.18);
              log(`\n📄 [STEP 2] Merchant Issued Commercial Proforma Invoice: ${invNumber}`, 'cyan');
              log(`Subtotal: ₹${subtotalAmt.toLocaleString()} + 18% GST (₹${(totalWithGst - subtotalAmt).toLocaleString()}) = ₹${totalWithGst.toLocaleString()}`, 'dim');

              // 3. Settlement
              if (activeAutoSettle) {
                await new Promise(r => setTimeout(r, 1000));
                log(`\n⚡ [STEP 3] Executing Autonomous Bounded Settlement (POST /api/agent/settle)...`, 'cyan');
                const settleRes = await axios.post('/agent/settle', {
                  session_id: session.session_id,
                  max_authorized_budget: myBudget
                });

                if (settleRes.data.success) {
                  setTelemetry(prev => ({
                    ...prev,
                    status: 'SETTLED',
                    settlementRail: 'CAPTURED_RAZORPAY'
                  }));
                  log(`🎉 SETTLEMENT CAPTURED & CONFIRMED!`, 'green');
                  log(`Transaction ID: ${settleRes.data.transaction_id}`, 'bright');
                  log(`Razorpay Order ID: ${settleRes.data.razorpay_order_id}`, 'bright');
                  log(`Final Order: ${activeQty} units @ ₹${settleRes.data.final_price_per_unit_inr}/unit = ₹${settleRes.data.total_with_gst_inr.toLocaleString()} (inc. 18% GST)`, 'bright');
                  log(`Audit Receipt: ${settleRes.data.receipt_audit}`, 'green');

                  setClosedSession(prev => ({
                    ...prev,
                    payment_status: 'paid',
                    razorpay_payment_id: settleRes.data.transaction_id,
                    razorpay_order_id: settleRes.data.razorpay_order_id
                  }));
                  fetchBuyerOrders();
                  fetchCustomerProfiles();
                }
              } else {
                log(`\n💳 DEAL CLOSED — Proforma Issued!`, 'yellow');
                log(`Awaiting Buyer Payment: Use the "Pay with Razorpay" or "Auto Settle" buttons below.`, 'bright');
                fetchCustomerProfiles();
              }
              break;
            }

            // Adjust bid
            if (activePersona === 'floor_tester') {
              myBid += 20;
            } else if (mResp.proposed_price_inr && mResp.proposed_price_inr > 0) {
              myBid = Math.min(myBudget, myBid + Math.max(10, Math.round((mResp.proposed_price_inr - myBid) * 0.45)));
            } else if (mResp.action === 'no_deal') {
              log(`Merchant concluded round discussions without counter-offer.`, 'yellow');
              break;
            } else {
              myBid = Math.min(myBudget, myBid + 35);
            }
          }
        } catch (negErr) {
          if (negErr.response?.status === 422) {
            setTelemetry(prev => ({
              ...prev,
              status: 'BLOCKED',
              firewallStatus: 'BREACH_INTERCEPTED'
            }));
            log(`🚨 [FIREWALL INTERCEPTION]: ${negErr.response.data.message || 'Bid rejected below floor'}`, 'red');
            log(`🛑 Session quarantined by deterministic firewall defense!`, 'red');
            fetchCustomerProfiles();
            break;
          } else {
            log(`Error: ${negErr.message}`, 'red');
            break;
          }
        }
      }

      if (!isClosed && currentRound >= 8) {
        setTelemetry(prev => ({ ...prev, status: 'STANDBY', settlementRail: 'IDLE' }));
        log(`\n⏳ Maximum negotiation rounds (8/8) reached without mutual agreement. Session ended (No Deal).`, 'yellow');
        await axios.post('/agent/negotiate', {
          session_id: session.session_id,
          action: 'no_deal',
          message: 'Maximum authorized negotiation rounds exhausted without mutual agreement.'
        }).catch(() => {});
        fetchBuyerOrders();
      }
    } catch (err) {
      log(`Simulation Error: ${err.message}`, 'red');
    } finally {
      setIsSimRunning(false);
      setTelemetry(prev => (prev.status === 'STREAMING' ? { ...prev, status: 'STANDBY' } : prev));
    }
  };

  const getLogColorClass = (type) => {
    switch (type) {
      case 'green': return 'text-emerald-400';
      case 'red': return 'text-rose-400';
      case 'yellow': return 'text-amber-300';
      case 'blue': return 'text-sky-400';
      case 'magenta': return 'text-purple-400';
      case 'cyan': return 'text-cyan-300';
      case 'bright': return 'text-white font-bold';
      case 'dim': return 'text-slate-400 text-xs italic';
      default: return 'text-slate-300';
    }
  };

  const curlExampleRfq = `curl -X POST http://localhost:5000/api/agent/rfq \\
  -H "Content-Type: application/json" \\
  -d '{
    "product_id": "SKU-LED-1001",
    "quantity": 50,
    "buyer_agent_name": "Acme Procurement Agent",
    "buyer_persona": "reasonable"
  }'`;

  const curlExampleNegotiate = `curl -X POST http://localhost:5000/api/agent/negotiate \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "ses_ext_...",
    "offered_price": 1050,
    "message": "We propose ₹1050/unit for immediate purchase order.",
    "action": "continue"
  }'`;

  const curlExampleSettle = `curl -X POST http://localhost:5000/api/agent/settle \\
  -H "Content-Type: application/json" \\
  -d '{
    "session_id": "ses_ext_...",
    "max_authorized_budget": 1100
  }'`;

  const handleTerminalSubmit = (e) => {
    if (e) e.preventDefault();
    const rawInput = terminalInput.trim();
    const cmd = rawInput.toLowerCase();
    setTerminalInput('');

    if (!cmd) return;

    if (cmd === 'clear') {
      setSimLogs([]);
      return;
    }

    if (cmd === 'help') {
      setSimLogs(prev => [
        ...prev,
        { text: '═════════════════ PARLAY A2A CLI TERMINAL COMMANDS ═════════════════', type: 'bright', timestamp: new Date().toLocaleTimeString() },
        { text: '  run                           - Execute procurement bot with active config', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --floor_tester            - Execute adversarial floor tester (Firewall defense)', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --lowballer               - Execute aggressive lowballer (HITL escalation)', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --reasonable              - Execute fair bulk buyer (Deal consensus & settlement)', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --impatient               - Execute fast enterprise procurement agent', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --sku=SKU --qty=N         - Execute with inline parameters (e.g. run --sku=SKU-INV-2002 --qty=20)', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  sku <SKU_CODE>                - Switch target inventory item (e.g. sku SKU-INV-2002)', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  qty <NUMBER>                  - Set procurement batch quantity (e.g. qty 25)', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  persona <TYPE>                - Set persona: reasonable | lowballer | floor_tester | impatient', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  autosettle <on|off>           - Toggle autonomous Razorpay settlement capture', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  config                        - Display active agent configuration dossier', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  catalog                       - Display active warehouse catalog & live stock', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  clear                         - Clear terminal output', type: 'cyan', timestamp: new Date().toLocaleTimeString() }
      ]);
      return;
    }

    if (cmd === 'config') {
      const activeProd = catalog?.items?.find(i => i.sku === simSku);
      setSimLogs(prev => [
        ...prev,
        { text: '--- ACTIVE AGENT CONFIGURATION ---', type: 'bright', timestamp: new Date().toLocaleTimeString() },
        { text: `  Target SKU:      ${simSku} (${activeProd?.name || 'Selected Item'})`, type: 'dim', timestamp: new Date().toLocaleTimeString() },
        { text: `  Batch Quantity:  ${simQty} units`, type: 'dim', timestamp: new Date().toLocaleTimeString() },
        { text: `  Buyer Persona:   ${simPersona.toUpperCase()}`, type: 'dim', timestamp: new Date().toLocaleTimeString() },
        { text: `  Auto-Settlement: ${autoSettle ? 'ENABLED (Instant Razorpay capture)' : 'DISABLED (Manual B2B checkout)'}`, type: 'dim', timestamp: new Date().toLocaleTimeString() }
      ]);
      return;
    }

    if (cmd.startsWith('sku ') || cmd.startsWith('set sku ')) {
      const parts = rawInput.split(/\s+/);
      const newSku = parts[parts.length - 1].toUpperCase();
      const matched = catalog?.items?.find(i => i.sku.toUpperCase() === newSku);
      if (matched) {
        setSimSku(matched.sku);
        setSimLogs(prev => [
          ...prev,
          { text: `✔ [CONFIG]: Target SKU updated to ${matched.sku} ("${matched.name}") - List: ₹${matched.list_price_inr}`, type: 'green', timestamp: new Date().toLocaleTimeString() }
        ]);
      } else {
        setSimLogs(prev => [
          ...prev,
          { text: `Error: SKU "${newSku}" not found in catalog. Type "catalog" to view valid SKUs.`, type: 'red', timestamp: new Date().toLocaleTimeString() }
        ]);
      }
      return;
    }

    if (cmd.startsWith('qty ') || cmd.startsWith('set qty ')) {
      const parts = rawInput.split(/\s+/);
      const parsedQty = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsedQty) && parsedQty > 0) {
        setSimQty(parsedQty);
        setSimLogs(prev => [
          ...prev,
          { text: `✔ [CONFIG]: Batch Quantity set to ${parsedQty} units`, type: 'green', timestamp: new Date().toLocaleTimeString() }
        ]);
      } else {
        setSimLogs(prev => [
          ...prev,
          { text: `Error: Invalid quantity. Please provide a positive number (e.g. qty 50).`, type: 'red', timestamp: new Date().toLocaleTimeString() }
        ]);
      }
      return;
    }

    if (cmd.startsWith('persona ') || cmd.startsWith('set persona ')) {
      const parts = rawInput.split(/\s+/);
      const p = parts[parts.length - 1].toLowerCase();
      const valid = ['reasonable', 'lowballer', 'floor_tester', 'impatient', 'impatient_enterprise'];
      if (valid.includes(p)) {
        const target = p === 'impatient' ? 'impatient_enterprise' : p;
        setSimPersona(target);
        setSimLogs(prev => [
          ...prev,
          { text: `✔ [CONFIG]: Persona updated to ${target.toUpperCase()}`, type: 'green', timestamp: new Date().toLocaleTimeString() }
        ]);
      } else {
        setSimLogs(prev => [
          ...prev,
          { text: `Error: Invalid persona. Options: reasonable | lowballer | floor_tester | impatient`, type: 'red', timestamp: new Date().toLocaleTimeString() }
        ]);
      }
      return;
    }

    if (cmd.startsWith('autosettle')) {
      if (cmd.includes('off') || cmd.includes('false') || cmd.includes('0')) {
        setAutoSettle(false);
        setSimLogs(prev => [...prev, { text: '✔ [CONFIG]: Auto-settlement DISABLED (Manual invoice checkout)', type: 'green', timestamp: new Date().toLocaleTimeString() }]);
      } else {
        setAutoSettle(true);
        setSimLogs(prev => [...prev, { text: '✔ [CONFIG]: Auto-settlement ENABLED (Autonomous Razorpay capture)', type: 'green', timestamp: new Date().toLocaleTimeString() }]);
      }
      return;
    }

    if (cmd === 'catalog') {
      setSimLogs(prev => [
        ...prev,
        { text: '══════════════════════ ACTIVE WAREHOUSE CATALOG ══════════════════════', type: 'bright', timestamp: new Date().toLocaleTimeString() },
        ...(catalog?.items?.map(it => {
          const ladderText = it.discount_brackets?.length
            ? `\n     └─ Volume Discounts: ${it.discount_brackets.map(b => `${b.min_qty}+ units @ ${b.discount_pct}% off (₹${b.effective_price_inr}/unit)`).join(' • ')}`
            : '\n     └─ Volume Discounts: Flat Rate (Bespoke RFQ required)';
          return {
            text: `  [${it.sku}] ${it.name}\n     ├─ List Price: ₹${it.list_price_inr} | Ready Stock: ${it.ready_stock} units${ladderText}`,
            type: 'cyan',
            timestamp: new Date().toLocaleTimeString()
          };
        }) || [])
      ]);
      return;
    }

    if (cmd.startsWith('run')) {
      let targetPersona = simPersona;
      if (cmd.includes('floor_tester')) targetPersona = 'floor_tester';
      else if (cmd.includes('lowballer')) targetPersona = 'lowballer';
      else if (cmd.includes('impatient')) targetPersona = 'impatient_enterprise';
      else if (cmd.includes('reasonable')) targetPersona = 'reasonable';

      // Inline flags: --sku=..., --qty=..., --manual / --auto
      let effectiveSku = simSku;
      const skuMatch = rawInput.match(/--sku=([^\s]+)/i);
      if (skuMatch) {
        const found = catalog?.items?.find(i => i.sku.toUpperCase() === skuMatch[1].toUpperCase());
        if (found) {
          effectiveSku = found.sku;
          setSimSku(found.sku);
        }
      }

      let effectiveQty = simQty;
      const qtyMatch = rawInput.match(/--qty=([0-9]+)/i);
      if (qtyMatch) {
        const q = parseInt(qtyMatch[1], 10);
        if (q > 0) {
          effectiveQty = q;
          setSimQty(q);
        }
      }

      let effectiveAutoSettle = autoSettle;
      if (rawInput.includes('--manual') || rawInput.includes('--autosettle=off')) {
        effectiveAutoSettle = false;
        setAutoSettle(false);
      } else if (rawInput.includes('--auto') || rawInput.includes('--autosettle=on')) {
        effectiveAutoSettle = true;
        setAutoSettle(true);
      }

      setSimPersona(targetPersona);
      runSimulator(targetPersona, effectiveSku, effectiveQty, effectiveAutoSettle);
      return;
    }

    setSimLogs(prev => [
      ...prev,
      { text: `Command not recognized: "${rawInput}". Type "help" for a list of commands.`, type: 'red', timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans overflow-hidden">
      {/* Top Header */}
      <header className="border-b border-white/[0.06] bg-zinc-950 px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center gap-1.5 text-xs font-mono border border-white/[0.06]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Merchant Arena</span>
            </Link>
            <div className="h-4 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center">
                <Bot className="w-4 h-4 text-zinc-950" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-zinc-100 flex items-center gap-2">
                  <span>Parlay A2A Public Gateway</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                    Agent-Readable Protocol v1.0
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gateway Live: /api/agent/*</span>
            </div>
            <a
              href="http://localhost:5000/api/agent/catalog"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary text-xs py-1 px-3 flex items-center gap-1.5 text-zinc-300 border-white/[0.06] hover:bg-white/5"
            >
              <span>Raw JSON Endpoint</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-white/[0.06] bg-zinc-900 px-6 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'catalog'
                ? 'border-emerald-500 text-zinc-50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Agent-Readable Inventory ({catalog?.items?.length || 0} SKUs)</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-emerald-500 text-zinc-50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Interactive A2A Terminal Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'ledger'
                ? 'border-emerald-500 text-zinc-50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Buyer Procurement Ledger</span>
            {ordersSummary?.total_deals > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                {ordersSummary.total_deals}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'docs'
                ? 'border-emerald-500 text-zinc-50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-emerald-400" />
            <span>API Gateway Specs</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'mcp'
                ? 'border-emerald-500 text-zinc-50'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code className="w-4 h-4 text-emerald-400" />
            <span>MCP Tool Definition</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-6 overflow-y-auto">
        {/* TAB 1: CATALOG VIEW */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-100">Live Warehouse Catalog Schema</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Autonomous agents query this endpoint to discover SKUs, real-time ready stock, and volume discount brackets.
                </p>
              </div>
              <div className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/20">
                GET /api/agent/catalog
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-zinc-500 font-mono text-xs">Loading Catalog Schema...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalog?.items?.map((item) => (
                  <div
                    key={item.sku}
                    className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] flex flex-col justify-between hover:border-emerald-500/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-white/[0.06] font-bold">
                          {item.sku}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          item.ready_stock > 50 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'
                        }`}>
                          {item.ready_stock} {item.unit} in stock
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-zinc-100">{item.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.04] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">List Price (Anchor):</span>
                        <span className="text-sm font-bold text-zinc-100 font-mono">₹{item.list_price_inr}</span>
                      </div>

                      {item.volume_discount_tiers?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                            Volume Discount Tiers:
                          </span>
                          <div className="space-y-1">
                            {item.volume_discount_tiers.map((tier, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px] font-mono bg-zinc-950/60 px-2 py-0.5 rounded border border-white/[0.04]">
                                <span className="text-zinc-400">{tier.min_quantity}+ units</span>
                                <span className="text-emerald-400">{tier.max_discount_pct}% off (~₹{tier.estimated_rate_inr})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TERMINAL SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Control Panel */}
              <div className="p-5 rounded-lg bg-zinc-900 border border-white/[0.06] space-y-4">
                <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>External Agent Configuration</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Dispatch an external AI procurement bot over real HTTP requests directly to the Parlay gateway. Watch the live negotiation unfold below.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Select Buyer Bot Persona:</label>
                    <select
                      value={simPersona}
                      onChange={(e) => setSimPersona(e.target.value)}
                      disabled={isSimRunning}
                      className="w-full bg-zinc-950 border border-white/[0.06] rounded p-2 text-xs text-zinc-200 font-mono outline-none focus:border-emerald-500/40"
                    >
                      <option value="reasonable">Reasonable SME Procurement Bot (Fair Haggler)</option>
                      <option value="lowballer">Aggressive Lowballer (Tests Margin Limits & HITL)</option>
                      <option value="impatient_enterprise">Impatient Enterprise Buyer (Time-Critical / Fast Closer)</option>
                      <option value="floor_tester">Adversarial Floor Tester (Attacks Firewall)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Target Product SKU:</label>
                    <select
                      value={simSku}
                      onChange={(e) => setSimSku(e.target.value)}
                      disabled={isSimRunning}
                      className="w-full bg-zinc-950 border border-white/[0.06] rounded p-2 text-xs text-zinc-200 font-mono outline-none focus:border-emerald-500/40"
                    >
                      {catalog?.items?.map((it) => (
                        <option key={it.sku} value={it.sku}>
                          {it.name} (₹{it.list_price_inr})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-mono text-zinc-400 block mb-1">Order Quantity (Units):</label>
                    <input
                      type="number"
                      value={simQty}
                      onChange={(e) => setSimQty(e.target.value)}
                      disabled={isSimRunning}
                      className="w-full bg-zinc-950 border border-white/[0.06] rounded p-2 text-xs text-zinc-200 font-mono outline-none focus:border-emerald-500/40"
                    />
                  </div>

                  {/* Autonomous M2M Settlement Toggle */}
                  <div className="flex items-center gap-2 p-2.5 rounded bg-zinc-950 border border-white/[0.04] text-[11px] font-mono">
                    <input
                      type="checkbox"
                      id="autoSettleCheck"
                      checked={autoSettle}
                      onChange={(e) => setAutoSettle(e.target.checked)}
                      disabled={isSimRunning}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                    <label htmlFor="autoSettleCheck" className="text-zinc-300 cursor-pointer select-none">
                      <span className="font-bold text-zinc-100 block text-[10px]">Instant M2M Settlement</span>
                      <span className="text-[9px] text-zinc-500">Autonomous capture upon deal close</span>
                    </label>
                  </div>

                  <button
                    onClick={() => runSimulator()}
                    disabled={isSimRunning}
                    className="w-full btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    <Play className={`w-3.5 h-3.5 ${isSimRunning ? 'animate-spin' : ''}`} />
                    <span>{isSimRunning ? 'Agent Negotiating in Real Time...' : 'Launch Autonomous Buyer Agent'}</span>
                  </button>

                  {/* Live A2A Gateway Telemetry HUD */}
                  <div className="p-3.5 rounded bg-zinc-950 border border-white/[0.04] text-[11px] font-mono space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                        <Activity className={`w-3.5 h-3.5 ${telemetry.status === 'STREAMING' ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
                        <span>A2A Live Telemetry</span>
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border flex items-center gap-1.5 ${
                        telemetry.status === 'STREAMING' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        telemetry.status === 'BLOCKED' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                        telemetry.status === 'HITL_PAUSED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        telemetry.status === 'SETTLED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        'bg-zinc-800 text-zinc-400 border-zinc-700/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          telemetry.status === 'STREAMING' ? 'bg-emerald-400 animate-ping' :
                          telemetry.status === 'BLOCKED' ? 'bg-red-400' :
                          telemetry.status === 'HITL_PAUSED' ? 'bg-amber-400' :
                          telemetry.status === 'SETTLED' ? 'bg-emerald-400' : 'bg-zinc-500'
                        }`} />
                        {telemetry.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500">Negotiation Turn</span>
                      <span className="text-zinc-200 font-bold">
                        {telemetry.round > 0 ? `Round ${telemetry.round} / 8` : 'Idle (Ready)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500">Firewall Sentinel</span>
                      <span className={`font-bold ${
                        telemetry.firewallStatus === 'BREACH_INTERCEPTED' ? 'text-red-400' :
                        telemetry.firewallStatus === 'PASS' ? 'text-emerald-400' : 'text-zinc-400'
                      }`}>
                        {telemetry.firewallStatus === 'BREACH_INTERCEPTED' ? '🚨 Intercepted (< Floor)' :
                         telemetry.firewallStatus === 'PASS' ? 'Active (100% Margin Guard)' :
                         'Armed (Monitoring)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500">Settlement Rail</span>
                      <span className={`font-bold ${
                        telemetry.settlementRail === 'CAPTURED_RAZORPAY' ? 'text-emerald-400' :
                        telemetry.settlementRail === 'GOVERNANCE_GATE' ? 'text-amber-400' :
                        telemetry.settlementRail === 'PRE_AUTH' ? 'text-cyan-400' :
                        telemetry.settlementRail === 'AWAITING_PAYMENT' ? 'text-amber-300' : 'text-zinc-400'
                      }`}>
                        {telemetry.settlementRail === 'CAPTURED_RAZORPAY' ? 'Captured (Razorpay M2M)' :
                         telemetry.settlementRail === 'GOVERNANCE_GATE' ? 'Paused for Human Gate' :
                         telemetry.settlementRail === 'PRE_AUTH' ? 'Pre-Auth Armed' :
                         telemetry.settlementRail === 'AWAITING_PAYMENT' ? 'Proforma Issued' : 'Standby'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500">Gateway Latency</span>
                      <span className="text-emerald-400 font-bold">
                        {telemetry.latencyMs}ms <span className="text-zinc-600 font-normal">(HTTP/1.1)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Terminal Screen + Settlement Station */}
              <div className="lg:col-span-2 flex flex-col space-y-4">
                {/* Terminal Screen with Interactive Command Line */}
                <div className="rounded-lg bg-black border border-white/10 flex flex-col h-[560px] overflow-hidden shadow-2xl font-mono">
                  {/* Terminal Title Bar */}
                  <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between border-b border-white/[0.06] shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      <span className="text-[11px] text-zinc-400 ml-2 font-mono">
                        external-buyer-bot --persona={simPersona} --target=localhost:5000
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 hidden sm:inline">A2A HTTP Stream</span>
                      <button
                        onClick={() => setSimLogs([])}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Quick CLI Command Pills */}
                  <div className="bg-zinc-950 px-3 py-1.5 border-b border-white/[0.04] flex items-center gap-1.5 overflow-x-auto text-[10px] text-zinc-400 shrink-0">
                    <span className="text-zinc-500 text-[9px] uppercase font-bold">Quick Run:</span>
                    <button
                      onClick={() => { setSimPersona('reasonable'); runSimulator('reasonable'); }}
                      disabled={isSimRunning}
                      className="px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 cursor-pointer"
                    >
                      run --reasonable
                    </button>
                    <button
                      onClick={() => { setSimPersona('lowballer'); runSimulator('lowballer'); }}
                      disabled={isSimRunning}
                      className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 cursor-pointer"
                    >
                      run --lowballer (HITL)
                    </button>
                    <button
                      onClick={() => { setSimPersona('floor_tester'); runSimulator('floor_tester'); }}
                      disabled={isSimRunning}
                      className="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 cursor-pointer"
                    >
                      run --floor_tester (Firewall)
                    </button>
                    <button
                      onClick={() => { setSimPersona('impatient_enterprise'); runSimulator('impatient_enterprise'); }}
                      disabled={isSimRunning}
                      className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/[0.06] cursor-pointer"
                    >
                      run --impatient
                    </button>
                  </div>

                  {/* Terminal Logs Window (Black inside with contrast colored logs preserved!) */}
                  <div ref={terminalLogsContainerRef} className="flex-1 p-4 overflow-y-auto space-y-1.5 text-xs text-zinc-300 min-h-0 bg-black">
                    {simLogs.length === 0 && !isSimRunning && (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center">
                        <Terminal className="w-8 h-8 text-zinc-700 mb-2" />
                        <p className="text-zinc-400 font-bold">A2A Autonomous CLI Terminal</p>
                        <p className="text-[11px] mt-1">Type <span className="text-emerald-400 font-bold">run</span>, click a quick command above, or hit Launch to execute.</p>
                      </div>
                    )}

                    {simLogs.map((logItem, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-zinc-600 select-none text-[10px] shrink-0">{logItem.timestamp}</span>
                        <span className={getLogColorClass(logItem.type)}>{logItem.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Interactive CLI Input Field */}
                  <form onSubmit={handleTerminalSubmit} className="bg-zinc-950 border-t border-white/[0.06] px-3 py-2 flex items-center gap-2 shrink-0">
                    <span className="text-emerald-400 text-xs font-mono font-bold select-none">agent@parlay:~$</span>
                    <input
                      type="text"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      disabled={isSimRunning}
                      placeholder={isSimRunning ? 'Agent executing in real time...' : "Type 'run', 'help', 'catalog', or 'clear'..."}
                      className="flex-1 bg-transparent text-xs font-mono text-zinc-100 outline-none placeholder-zinc-600"
                    />
                    <button
                      type="submit"
                      disabled={isSimRunning || !terminalInput.trim()}
                      className="text-[10px] font-mono px-2.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 disabled:opacity-30 cursor-pointer"
                    >
                      Enter ↵
                    </button>
                  </form>
                </div>

                {/* Buyer Settlement Station (Appears right below terminal when Deal is Closed) */}
                {closedSession && (
                  <div className="p-4 rounded-lg bg-zinc-900 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4 font-mono shadow-2xl">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                          Consensus Reached
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-sm font-bold text-zinc-100">
                          {closedSession.product_name}
                        </span>
                        <span className="text-xs text-emerald-300 font-bold font-mono">
                          @ ₹{closedSession.final_price}/unit
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Order: {closedSession.quantity} units • Subtotal: ₹{Math.round(closedSession.final_price * closedSession.quantity).toLocaleString()} • Total: <span className="text-zinc-100 font-bold">₹{Math.round(closedSession.final_price * closedSession.quantity * 1.18).toLocaleString()}</span> (inc. 18% GST)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setIsInvoiceModalOpen(true)}
                        className="btn btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 text-zinc-200 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{closedSession.payment_status === 'paid' ? 'View Invoice & Receipt' : 'View Proforma Invoice'}</span>
                      </button>

                      {closedSession.payment_status !== 'paid' ? (
                        <>
                          <button
                            onClick={() => setIsInvoiceModalOpen(true)}
                            className="btn btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay with Razorpay</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                toast.loading('Executing autonomous mandate settlement...', { id: 'settle' });
                                const res = await axios.post('/agent/settle', {
                                  session_id: closedSession.session_id,
                                  max_authorized_budget: 999999
                                });
                                if (res.data.success) {
                                  toast.success('Invoice Settled & Captured Autonomously!', { id: 'settle' });
                                  setClosedSession(prev => ({
                                    ...prev,
                                    payment_status: 'paid',
                                    razorpay_payment_id: res.data.transaction_id,
                                    razorpay_order_id: res.data.razorpay_order_id
                                  }));
                                  fetchBuyerOrders();
                                }
                              } catch (e) {
                                toast.error('Settlement error', { id: 'settle' });
                              }
                            }}
                            className="btn btn-secondary py-2 px-3 text-xs font-bold flex items-center gap-1.5 text-amber-300 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Auto Settle (M2M)</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Payment Settled & Confirmed</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BUYER PROCUREMENT LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            {/* Header & Refresh */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg bg-zinc-900 border border-white/[0.06]">
              <div>
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>Buyer Procurement Audit Ledger</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                    Defensible Enterprise Records
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Complete historic audit trail of autonomous negotiations, deals closed, capital dispatched, and tax receipts.
                </p>
              </div>

              <button
                onClick={fetchBuyerOrders}
                disabled={ordersLoading}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-zinc-300 border-white/[0.06] hover:bg-white/5 cursor-pointer shrink-0 self-start md:self-auto"
              >
                <RotateCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Refresh Ledger</span>
              </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/[0.04] flex flex-col">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Total Deals Closed</span>
                <span className="text-xl font-bold text-zinc-100 font-mono mt-1">
                  {ordersSummary?.total_deals || 0}
                </span>
                <span className="text-[10px] text-emerald-400 mt-0.5">Autonomous B2B Contracts</span>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/[0.04] flex flex-col">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Capital Dispatched</span>
                <span className="text-xl font-bold text-emerald-400 font-mono mt-1">
                  ₹{(ordersSummary?.total_spend_inr || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-500 mt-0.5">Total settled with 18% GST</span>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/[0.04] flex flex-col">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Negotiated Savings</span>
                <span className="text-xl font-bold text-emerald-400 font-mono mt-1">
                  ₹{(ordersSummary?.total_savings_inr || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-300/80 mt-0.5">Achieved below Merchant List</span>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900 border border-white/[0.04] flex flex-col">
                <span className="text-[10px] uppercase font-mono text-zinc-500">Settlement Health</span>
                <span className="text-xl font-bold text-zinc-100 font-mono mt-1">
                  {ordersSummary?.paid_deals || 0} / {ordersSummary?.total_deals || 0}
                </span>
                <span className="text-[10px] text-emerald-400 mt-0.5">
                  {ordersSummary?.pending_payment ? `${ordersSummary.pending_payment} awaiting payment` : '100% Fully Settled'}
                </span>
              </div>
            </div>

            {/* Filter Pills & Agent Persona Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-zinc-950 border border-white/[0.04] font-mono text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'All Orders' },
                  { id: 'paid', label: 'Paid & Settled' },
                  { id: 'pending', label: 'Awaiting Payment' },
                  { id: 'quarantined', label: 'Firewall Blocked' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setLedgerFilter(f.id)}
                    className={`px-3 py-1 rounded transition-colors cursor-pointer text-xs ${
                      ledgerFilter === f.id
                        ? 'bg-emerald-500 text-zinc-950 font-bold'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 uppercase">Agent Persona:</span>
                <select
                  value={ledgerPersona}
                  onChange={e => setLedgerPersona(e.target.value)}
                  className="bg-zinc-900 border border-white/[0.06] rounded px-2.5 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">All Personas</option>
                  <option value="reasonable">Apex Global (Reasonable)</option>
                  <option value="lowballer">Titan Bulk (Lowballer)</option>
                  <option value="impatient_enterprise">Nexus FastTrack (Impatient)</option>
                  <option value="floor_tester">Spectre Arbitrage (Floor Tester)</option>
                </select>
              </div>
            </div>

            {/* Orders Feed */}
            {ordersLoading ? (
              <div className="p-12 text-center text-zinc-500 font-mono text-xs">
                <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                <span>Loading procurement records from ledger...</span>
              </div>
            ) : buyerOrders.length === 0 ? (
              <div className="p-12 rounded-lg bg-zinc-900 border border-dashed border-white/[0.08] text-center font-mono space-y-2">
                <History className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-sm text-zinc-300 font-bold">No Procurement Records Found</p>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Run an autonomous procurement negotiation using the Interactive Terminal Simulator or external CLI script to generate verifiable ledger entries.
                </p>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className="btn btn-primary text-xs py-1.5 px-3 mt-2 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Launch Terminal Simulator</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {buyerOrders.map(order => (
                  <div
                    key={order.session_id}
                    className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] hover:border-white/[0.12] transition-all font-mono shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Top Badges & IDs */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-100 font-sans">
                          {order.product_name || order.product_id}
                        </span>
                        {order.invoice_number && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {order.invoice_number}
                          </span>
                        )}
                        <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/[0.06]">
                          {order.buyer_agent_name}
                        </span>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                          order.status === 'blocked_by_firewall'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : order.payment_status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {order.status === 'blocked_by_firewall'
                            ? 'BLOCKED BY FIREWALL'
                            : order.payment_status === 'paid'
                            ? 'PAID & CAPTURED'
                            : 'PAYMENT DUE'}
                        </span>
                      </div>

                      {/* Financials & Savings */}
                      <div className="flex items-center gap-3 text-xs text-zinc-300 flex-wrap">
                        {order.status === 'blocked_by_firewall' ? (
                          <span className="text-red-300 text-[11px] font-mono">
                            Requested: {order.quantity} units • Transaction halted below supplier floor (₹{order.floor_price_snapshot || 950})
                          </span>
                        ) : (
                          <>
                            <span>
                              {order.quantity} units × ₹{order.final_price_inr || order.list_price_inr}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span>
                              Total: <strong className="text-zinc-100">₹{order.total_inr.toLocaleString()}</strong> (inc. 18% GST)
                            </span>
                            {order.savings_inr > 0 && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-emerald-400 text-[11px] font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  Saved ₹{order.savings_inr.toLocaleString()} ({order.savings_pct}% below List)
                                </span>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {/* Transaction Meta */}
                      <div className="text-[10px] text-zinc-500 flex items-center gap-3 flex-wrap">
                        <span>Ref: {order.session_id}</span>
                        {order.razorpay_payment_id && (
                          <>
                            <span>•</span>
                            <span>TX: {order.razorpay_payment_id}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{new Date(order.created_at).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {order.status === 'blocked_by_firewall' ? (
                        <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded border border-red-500/20 flex items-center gap-1.5 font-mono">
                          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                          <span>Margin Protected (No Invoice)</span>
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenLedgerDoc(order, 'invoice')}
                            className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-zinc-300 border-white/[0.08] hover:bg-white/5 cursor-pointer"
                            title="View Commercial Tax Invoice"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Tax Invoice</span>
                          </button>

                          <button
                            onClick={() => handleOpenLedgerDoc(order, 'receipt')}
                            className={`btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer ${
                              order.payment_status === 'paid'
                                ? 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10'
                                : 'text-zinc-600 border-white/5 opacity-50'
                            }`}
                            title={order.payment_status === 'paid' ? 'View Payment Receipt' : 'Receipt available once settled'}
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>

                          {order.status === 'deal_closed' && order.payment_status !== 'paid' && (
                            <>
                              <button
                                onClick={() => handleOpenLedgerDoc(order, 'invoice')}
                                className="btn btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay with Razorpay</span>
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    toast.loading('Executing autonomous mandate settlement...', { id: `settle-${order.session_id}` });
                                    const res = await axios.post('/agent/settle', {
                                      session_id: order.session_id,
                                      max_authorized_budget: order.final_price_inr || 999999
                                    });
                                    if (res.data.success) {
                                      toast.success('Invoice Settled & Captured Autonomously!', { id: `settle-${order.session_id}` });
                                      fetchBuyerOrders();
                                      fetchCustomerProfiles();
                                    }
                                  } catch (e) {
                                    toast.error(e.response?.data?.message || 'Settlement error', { id: `settle-${order.session_id}` });
                                  }
                                }}
                                className="btn btn-secondary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 text-amber-300 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                                title="Execute Autonomous Machine-to-Machine settlement via pre-authorized budget mandate"
                              >
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <span>Auto Settle (M2M)</span>
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: API SPECIFICATIONS */}
        {activeTab === 'docs' && (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06]">
              <h2 className="text-base font-bold text-zinc-100">Public A2A Gateway Endpoints</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Any external autonomous agent, script, or server can interact with Parlay using standard HTTP JSON APIs.
              </p>
            </div>

            {/* Endpoint 0: Catalog */}
            <div className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-bold border border-white/[0.06]">
                    GET
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-100">/api/agent/catalog</span>
                  <span className="text-xs text-zinc-500">- Machine-Readable Catalog Discovery</span>
                </div>
                <button
                  onClick={() => copyToClipboard('curl http://localhost:5000/api/agent/catalog', 'cat')}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'cat' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-zinc-500 font-bold block mb-1 uppercase tracking-wider text-[9px]">Query Parameters</span>
                  <p className="text-zinc-500 italic">None required. Returns active inventory with real-time stock and volume discount ladders.</p>
                </div>
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Response Format (200 OK)</span>
                  <p><span className="text-zinc-200">items[]:</span> array of products (sku, name, list_price_inr, ready_stock, volume_discount_tiers)</p>
                  <p><span className="text-zinc-200">gateway_endpoints:</span> map of public A2A URLs (rfq, negotiate, settle)</p>
                </div>
              </div>
            </div>

            {/* Endpoint 1: RFQ */}
            <div className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25">
                    POST
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-100">/api/agent/rfq</span>
                  <span className="text-xs text-zinc-500">- Submit Request For Quote</span>
                </div>
                <button
                  onClick={() => copyToClipboard(curlExampleRfq, 'rfq')}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'rfq' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-zinc-500 font-bold block mb-1 uppercase tracking-wider text-[9px]">Request Body Fields</span>
                  <p><span className="text-zinc-300">product_id</span> (string, req): Target SKU (e.g. SKU-LED-1001)</p>
                  <p><span className="text-zinc-300">quantity</span> (number, req): Number of units requested</p>
                  <p><span className="text-zinc-300">buyer_agent_name</span> (string, opt): Identification string</p>
                  <p><span className="text-zinc-300">buyer_persona</span> (string, opt): reasonable | lowballer | floor_tester</p>
                </div>
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Response Fields (201 Created)</span>
                  <p><span className="text-zinc-200">session_id:</span> Unique session identifier for subsequent turns</p>
                  <p><span className="text-zinc-200">merchant_opening_turn:</span> {`{ message, proposed_price_inr, policy_reason }`}</p>
                  <p><span className="text-zinc-200">max_rounds:</span> 8 (Maximum permitted bargaining turns)</p>
                </div>
              </div>

              <pre className="p-3 rounded bg-zinc-950 border border-white/[0.04] text-[11px] font-mono text-zinc-300 overflow-x-auto">
                {curlExampleRfq}
              </pre>
            </div>

            {/* Endpoint 2: Negotiate */}
            <div className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25">
                    POST
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-100">/api/agent/negotiate</span>
                  <span className="text-xs text-zinc-500">- Submit Counter-Bid (Firewall Protected)</span>
                </div>
                <button
                  onClick={() => copyToClipboard(curlExampleNegotiate, 'neg')}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'neg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-zinc-500 font-bold block mb-1 uppercase tracking-wider text-[9px]">Request Body Fields</span>
                  <p><span className="text-zinc-300">session_id</span> (string, req): Session ID returned from RFQ</p>
                  <p><span className="text-zinc-300">offered_price</span> (number, req): Unit price in INR offered</p>
                  <p><span className="text-zinc-300">message</span> (string, req): Conversational rationale</p>
                  <p><span className="text-zinc-300">action</span> (string, req): 'continue' | 'deal_closed' | 'no_deal'</p>
                </div>
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Firewall & Responses</span>
                  <p><span className="text-zinc-200">200 OK:</span> {`{ status: "ongoing", firewall_status: "PASS", merchant_response: { message, proposed_price_inr, action } }`}</p>
                  <p><span className="text-red-400">422 Unprocessable Entity:</span> FIREWALL_SECURITY_QUARANTINE (Bid strictly below floor boundary)</p>
                </div>
              </div>

              <pre className="p-3 rounded bg-zinc-950 border border-white/[0.04] text-[11px] font-mono text-zinc-300 overflow-x-auto">
                {curlExampleNegotiate}
              </pre>
            </div>

            {/* Endpoint 3: Settle */}
            <div className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/25">
                    POST
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-100">/api/agent/settle</span>
                  <span className="text-xs text-zinc-500">- Autonomous Bounded Settlement (Razorpay Order)</span>
                </div>
                <button
                  onClick={() => copyToClipboard(curlExampleSettle, 'set')}
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'set' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-zinc-500 font-bold block mb-1 uppercase tracking-wider text-[9px]">Request Body Fields</span>
                  <p><span className="text-zinc-300">session_id</span> (string, req): Settled negotiation session ID</p>
                  <p><span className="text-zinc-300">max_authorized_budget</span> (number, opt): Hard budget ceiling</p>
                </div>
                <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Settlement Output</span>
                  <p><span className="text-zinc-200">razorpay_order_id:</span> Real Razorpay financial order</p>
                  <p><span className="text-zinc-200">transaction_id:</span> M2M Pre-Authorized Mandate ID</p>
                  <p><span className="text-zinc-200">stock_allocated:</span> true (Atomic inventory deduction)</p>
                  <p><span className="text-zinc-200">receipt_audit:</span> HMAC-SHA256 verified tax invoice message</p>
                </div>
              </div>

              <pre className="p-3 rounded bg-zinc-950 border border-white/[0.04] text-[11px] font-mono text-zinc-300 overflow-x-auto">
                {curlExampleSettle}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 5: MCP TOOL SPEC */}
        {activeTab === 'mcp' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-zinc-900 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-100">Model Context Protocol (MCP) Tool Declaration</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Standard tool definition schema allowing external LLMs (Claude Desktop, Cursor, OpenAI Agents) to discover inventory and negotiate with Parlay.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(JSON.stringify({
                  name: "parlay_negotiate_and_procure",
                  description: "Discovers B2B merchant inventory, submits volume RFQ, negotiates bounded commercial terms with Parlay deterministic firewall, and executes Razorpay autonomous settlement.",
                  inputSchema: {
                    type: "object",
                    properties: {
                      sku: { type: "string", description: "Product SKU to procure" },
                      quantity: { type: "number", description: "Wholesale quantity needed" },
                      target_price_inr: { type: "number", description: "Target price desired" },
                      max_authorized_budget_inr: { type: "number", description: "Maximum authorized hard ceiling" }
                    },
                    required: ["sku", "quantity", "max_authorized_budget_inr"]
                  }
                }, null, 2), 'mcp')}
                className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                {copiedIndex === 'mcp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy MCP JSON</span>
              </button>
            </div>

            <pre className="p-4 rounded-lg bg-black border border-white/[0.06] text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
{JSON.stringify({
  name: "parlay_negotiate_and_procure",
  description: "Discovers B2B merchant inventory, submits volume RFQ, negotiates bounded commercial terms with Parlay deterministic firewall, and executes Razorpay autonomous settlement.",
  inputSchema: {
    type: "object",
    properties: {
      sku: { type: "string", description: "Product SKU to procure" },
      quantity: { type: "number", description: "Wholesale quantity needed" },
      target_price_inr: { type: "number", description: "Target price desired" },
      max_authorized_budget_inr: { type: "number", description: "Maximum authorized hard ceiling" }
    },
    required: ["sku", "quantity", "max_authorized_budget_inr"]
  }
}, null, 2)}
            </pre>
          </div>
        )}
      </main>

      {/* B2B Proforma / Receipt Modal for Buyer */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        session={closedSession}
        product={catalog?.items?.find(i => i.sku === closedSession?.product_id) || { name: closedSession?.product_name }}
        role="buyer"
        initialTab={invoiceInitialTab}
        onPaymentSuccess={(updated) => {
          setClosedSession(prev => ({
            ...prev,
            payment_status: 'paid',
            razorpay_payment_id: updated?.razorpay_payment_id || 'pay_confirmed'
          }));
          fetchBuyerOrders();
        }}
      />
    </div>
  );
}
