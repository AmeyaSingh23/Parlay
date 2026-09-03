import React, { useState, useEffect } from 'react';
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
  Play,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Code,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import InvoiceModal from '../components/InvoiceModal';

export default function AgentCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'docs' | 'simulator' | 'mcp'
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Simulator state
  const [simPersona, setSimPersona] = useState('reasonable');
  const [simSku, setSimSku] = useState('SKU-LED-1001');
  const [simQty, setSimQty] = useState(50);
  const [autoSettle, setAutoSettle] = useState(true);
  const [closedSession, setClosedSession] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [simLogs, setSimLogs] = useState([]);

  useEffect(() => {
    fetchCatalog();
  }, []);

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

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const [terminalInput, setTerminalInput] = useState('');

  // Run in-browser A2A Simulation
  const runSimulator = async (overridePersona = null) => {
    const activePersona = overridePersona || simPersona;
    setIsSimRunning(true);
    setSimLogs([]);

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

      log(`[STEP 1] Dispatching RFQ for ${simQty} units of ${simSku} (${entityName})...`, 'blue');
      const rfqRes = await axios.post('/agent/rfq', {
        product_id: simSku,
        quantity: Number(simQty),
        buyer_agent_name: entityName,
        buyer_persona: activePersona
      });

      const session = rfqRes.data;
      log(`✔ RFQ Accepted! Session ID: ${session.session_id}`, 'green');
      log(`Merchant Opening Offer: ₹${session.merchant_opening_turn.proposed_price_inr}/unit`, 'magenta');
      log(`"${session.merchant_opening_turn.message}"`, 'dim');

      let currentRound = 1;
      let isClosed = false;
      const targetItem = catalog?.items?.find(i => i.sku === simSku);
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
      while (currentRound <= 8 && !isClosed) {
        currentRound++;
        await new Promise(r => setTimeout(r, 1200));

        log(`\n--- ROUND ${currentRound} OF 8 ---`, 'bright');
        log(`[Buyer Bot Bid]: Submitting counter-offer of ₹${myBid}/unit (Budget: ₹${myBudget})`, 'blue');

        try {
          const negRes = await axios.post('/agent/negotiate', {
            session_id: session.session_id,
            offered_price: myBid,
            message: `We appreciate your opening quote. For our commitment of ${simQty} units, our procurement mandate authorizes ₹${myBid}/unit. Can you adjust to this volume rate?`,
            action: 'continue'
          });

          const data = negRes.data;
          if (data.firewall_status === 'INTERCEPTED_AND_WARNED') {
            log(`⚠️ [FIREWALL ALERT]: Commercial policy warned below-floor proposal.`, 'yellow');
          }

          const mResp = data.merchant_response;
          if (mResp) {
            log(`[Merchant Counter]: ₹${mResp.proposed_price_inr}/unit`, 'magenta');
            log(`"${mResp.message}"`, 'dim');
            log(`Policy Rationale: ${mResp.policy_reason}`, 'dim');

            if (mResp.action === 'deal_closed' || (mResp.proposed_price_inr && mResp.proposed_price_inr <= myBudget)) {
              const finalPrice = mResp.proposed_price_inr || myBid;
              log(`\n🤝 MUTUAL AGREEMENT REACHED at ₹${finalPrice}/unit!`, 'green');

              await axios.post('/agent/negotiate', {
                session_id: session.session_id,
                offered_price: finalPrice,
                message: `Agreed. We accept ₹${finalPrice}/unit for ${simQty} units. Proforma commercial invoice confirmed.`,
                action: 'deal_closed'
              });

              isClosed = true;

              const dealProduct = catalog?.items?.find(i => i.sku === simSku);
              const closedSessionData = {
                session_id: session.session_id,
                product_id: simSku,
                product_name: dealProduct?.name || 'Bulk Industrial Goods',
                quantity: Number(simQty),
                final_price: finalPrice,
                status: 'deal_closed',
                payment_status: 'pending',
                razorpay_order_id: `order_${session.session_id.substring(8, 22)}`
              };
              setClosedSession(closedSessionData);

              const invNumber = `INV-PAR-${session.session_id.substring(4, 12).toUpperCase()}`;
              const subtotalAmt = Math.round(finalPrice * Number(simQty));
              const totalWithGst = Math.round(subtotalAmt * 1.18);
              log(`\n📄 [STEP 2] Merchant Issued Commercial Proforma Invoice: ${invNumber}`, 'cyan');
              log(`Subtotal: ₹${subtotalAmt.toLocaleString()} + 18% GST (₹${(totalWithGst - subtotalAmt).toLocaleString()}) = ₹${totalWithGst.toLocaleString()}`, 'dim');

              // 3. Settlement
              if (autoSettle) {
                await new Promise(r => setTimeout(r, 1000));
                log(`\n⚡ [STEP 3] Executing Autonomous Bounded Settlement (POST /api/agent/settle)...`, 'cyan');
                const settleRes = await axios.post('/agent/settle', {
                  session_id: session.session_id,
                  max_authorized_budget: myBudget
                });

                if (settleRes.data.success) {
                  log(`🎉 SETTLEMENT CAPTURED & CONFIRMED!`, 'green');
                  log(`Transaction ID: ${settleRes.data.transaction_id}`, 'bright');
                  log(`Razorpay Order ID: ${settleRes.data.razorpay_order_id}`, 'bright');
                  log(`Final Order: ${simQty} units @ ₹${settleRes.data.final_price_per_unit_inr}/unit = ₹${settleRes.data.total_with_gst_inr.toLocaleString()} (inc. 18% GST)`, 'bright');
                  log(`Audit Receipt: ${settleRes.data.receipt_audit}`, 'green');

                  setClosedSession(prev => ({
                    ...prev,
                    payment_status: 'paid',
                    razorpay_payment_id: settleRes.data.transaction_id,
                    razorpay_order_id: settleRes.data.razorpay_order_id
                  }));
                }
              } else {
                log(`\n💳 DEAL CLOSED — Proforma Issued!`, 'yellow');
                log(`Awaiting Buyer Payment: Use the "Pay with Razorpay" or "Auto Settle" buttons below.`, 'bright');
              }
              break;
            }

            // Adjust bid
            if (activePersona === 'floor_tester') {
              myBid += 20;
            } else {
              myBid = Math.min(myBudget, myBid + Math.round((mResp.proposed_price_inr - myBid) * 0.45));
            }
          }
        } catch (negErr) {
          if (negErr.response?.status === 422) {
            log(`🚨 [FIREWALL INTERCEPTION]: ${negErr.response.data.message || 'Bid rejected below floor'}`, 'red');
            log(`🛑 Session quarantined by deterministic firewall defense!`, 'red');
            break;
          } else {
            log(`Error: ${negErr.message}`, 'red');
            break;
          }
        }
      }
    } catch (err) {
      log(`Simulation Error: ${err.message}`, 'red');
    } finally {
      setIsSimRunning(false);
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
    const cmd = terminalInput.trim().toLowerCase();
    setTerminalInput('');

    if (!cmd) return;

    if (cmd === 'clear') {
      setSimLogs([]);
      return;
    }

    if (cmd === 'help') {
      setSimLogs(prev => [
        ...prev,
        { text: 'Available CLI Commands:', type: 'bright', timestamp: new Date().toLocaleTimeString() },
        { text: '  run                           - Execute procurement bot with current settings', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --persona=floor_tester    - Test adversarial firewall security quarantine', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --persona=lowballer       - Test aggressive haggle & HITL escalation', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --persona=reasonable      - Test fair SME bulk procurement and settlement', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  run --persona=impatient       - Test fast-closing enterprise buyer', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  catalog                       - Display active warehouse catalog & stock', type: 'cyan', timestamp: new Date().toLocaleTimeString() },
        { text: '  clear                         - Clear terminal output', type: 'cyan', timestamp: new Date().toLocaleTimeString() }
      ]);
      return;
    }

    if (cmd === 'catalog') {
      setSimLogs(prev => [
        ...prev,
        { text: '--- ACTIVE WAREHOUSE INVENTORY ---', type: 'bright', timestamp: new Date().toLocaleTimeString() },
        ...(catalog?.items?.map(it => ({
          text: `  [${it.sku}] ${it.name} | List: ₹${it.list_price_inr} | Stock: ${it.ready_stock} units`,
          type: 'dim',
          timestamp: new Date().toLocaleTimeString()
        })) || [])
      ]);
      return;
    }

    if (cmd.startsWith('run')) {
      let targetPersona = simPersona;
      if (cmd.includes('floor_tester')) targetPersona = 'floor_tester';
      else if (cmd.includes('lowballer')) targetPersona = 'lowballer';
      else if (cmd.includes('impatient')) targetPersona = 'impatient_enterprise';
      else if (cmd.includes('reasonable')) targetPersona = 'reasonable';

      setSimPersona(targetPersona);
      runSimulator(targetPersona);
      return;
    }

    setSimLogs(prev => [
      ...prev,
      { text: `Command not recognized: "${cmd}". Type "help" for a list of commands.`, type: 'red', timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  return (
    <div className="h-screen w-screen bg-[#0d0f14] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-[#12151e] px-6 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-1.5 text-xs font-mono"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Merchant Arena</span>
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Parlay A2A Public Gateway</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                    Agent-Readable Protocol v1.0
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gateway Live: /api/agent/*</span>
            </div>
            <a
              href="http://localhost:5000/api/agent/catalog"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary text-xs py-1 px-3 flex items-center gap-1.5 text-slate-300 border-white/10 hover:bg-white/5"
            >
              <span>Raw JSON Endpoint</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-white/[0.06] bg-[#0f1118] px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'catalog'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Agent-Readable Inventory ({catalog?.items?.length || 0} SKUs)</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'simulator'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Interactive A2A Terminal Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'docs'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4 text-sky-400" />
            <span>API Gateway Specifications & cURL</span>
          </button>

          <button
            onClick={() => setActiveTab('mcp')}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'mcp'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-4 h-4 text-amber-400" />
            <span>MCP Tool Definition</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-6 overflow-y-auto">
        {/* TAB 1: CATALOG VIEW */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[#131620] border border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Live Warehouse Catalog Schema</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Autonomous agents query this endpoint to discover SKUs, real-time ready stock, and volume discount brackets.
                </p>
              </div>
              <div className="font-mono text-xs text-indigo-300 bg-indigo-950/40 px-3 py-1.5 rounded border border-indigo-500/20">
                GET /api/agent/catalog
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-500 font-mono text-xs">Loading Catalog Schema...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalog?.items?.map((item) => (
                  <div
                    key={item.sku}
                    className="p-4 rounded-xl bg-[#131722] border border-white/10 flex flex-col justify-between hover:border-indigo-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                          {item.sku}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          item.ready_stock > 50 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                        }`}>
                          {item.ready_stock} {item.unit} in stock
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-white">{item.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">List Price (Anchor):</span>
                        <span className="text-sm font-bold text-white font-mono">₹{item.list_price_inr}</span>
                      </div>

                      {item.volume_discount_tiers?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                            Volume Discount Tiers:
                          </span>
                          <div className="space-y-1">
                            {item.volume_discount_tiers.map((tier, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px] font-mono bg-black/30 px-2 py-0.5 rounded">
                                <span className="text-slate-300">{tier.min_quantity}+ units</span>
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
            <div className="p-5 rounded-xl bg-[#131620] border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>External Agent Configuration</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dispatch an external AI procurement bot over real HTTP requests directly to the Parlay gateway. Watch the live negotiation unfold below.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Select Buyer Bot Persona:</label>
                  <select
                    value={simPersona}
                    onChange={(e) => setSimPersona(e.target.value)}
                    disabled={isSimRunning}
                    className="w-full bg-[#1b1f2e] border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                  >
                    <option value="reasonable">Reasonable SME Procurement Bot (Fair Haggler)</option>
                    <option value="lowballer">Aggressive Lowballer (Tests Margin Limits & HITL)</option>
                    <option value="impatient_enterprise">Impatient Enterprise Buyer (Time-Critical / Fast Closer)</option>
                    <option value="floor_tester">Adversarial Floor Tester (Attacks Firewall)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Target Product SKU:</label>
                  <select
                    value={simSku}
                    onChange={(e) => setSimSku(e.target.value)}
                    disabled={isSimRunning}
                    className="w-full bg-[#1b1f2e] border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                  >
                    {catalog?.items?.map((it) => (
                      <option key={it.sku} value={it.sku}>
                        {it.name} (₹{it.list_price_inr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Order Quantity (Units):</label>
                  <input
                    type="number"
                    value={simQty}
                    onChange={(e) => setSimQty(e.target.value)}
                    disabled={isSimRunning}
                    className="w-full bg-[#1b1f2e] border border-white/10 rounded-lg p-2 text-xs text-white font-mono"
                  />
                </div>

                {/* Autonomous M2M Settlement Toggle */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono">
                  <input
                    type="checkbox"
                    id="autoSettleCheck"
                    checked={autoSettle}
                    onChange={(e) => setAutoSettle(e.target.checked)}
                    disabled={isSimRunning}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                  <label htmlFor="autoSettleCheck" className="text-slate-300 cursor-pointer select-none">
                    <span className="font-bold text-white block text-[10px]">Instant M2M Settlement</span>
                    <span className="text-[9px] text-slate-400">Autonomous capture upon deal close</span>
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

                {/* Gateway Telemetry HUD */}
                <div className="p-3.5 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono space-y-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">A2A Gateway Telemetry</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ONLINE</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Security Engine</span>
                    <span className="text-emerald-400 font-bold">Deterministic Firewall</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Settlement Rail</span>
                    <span className="text-sky-300 font-bold">Razorpay Test Sandbox</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">Prompt Defense</span>
                    <span className="text-purple-300 font-bold">Adversarial Quarantine</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-500">A2A Protocol</span>
                    <span className="text-indigo-300 font-bold">REST / MCP Tool v1.0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal Screen with Interactive Command Line */}
            <div className="lg:col-span-2 rounded-xl bg-black border border-white/15 flex flex-col h-[560px] overflow-hidden shadow-2xl font-mono">
              {/* Terminal Title Bar */}
              <div className="bg-[#191c26] px-4 py-2 flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-[11px] text-slate-400 ml-2 font-mono">
                    external-buyer-bot --persona={simPersona} --target=localhost:5000
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 hidden sm:inline">A2A HTTP Stream</span>
                  <button
                    onClick={() => setSimLogs([])}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Quick CLI Command Pills */}
              <div className="bg-[#11131a] px-3 py-1.5 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto text-[10px] text-slate-400 shrink-0">
                <span className="text-slate-500 text-[9px] uppercase font-bold">Quick Run:</span>
                <button
                  onClick={() => { setSimPersona('reasonable'); runSimulator('reasonable'); }}
                  disabled={isSimRunning}
                  className="px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 cursor-pointer"
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
                  className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 cursor-pointer"
                >
                  run --floor_tester (Firewall)
                </button>
                <button
                  onClick={() => { setSimPersona('impatient_enterprise'); runSimulator('impatient_enterprise'); }}
                  disabled={isSimRunning}
                  className="px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 cursor-pointer"
                >
                  run --impatient
                </button>
              </div>

              {/* Terminal Logs Window */}
              <div className="flex-1 p-4 overflow-y-auto space-y-1.5 text-xs text-slate-300 min-h-0">
                {simLogs.length === 0 && !isSimRunning && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center">
                    <Terminal className="w-8 h-8 text-slate-700 mb-2" />
                    <p className="text-slate-400 font-bold">A2A Autonomous CLI Terminal</p>
                    <p className="text-[11px] mt-1">Type <span className="text-indigo-400 font-bold">run</span>, click a quick command above, or hit Launch to execute.</p>
                  </div>
                )}

                {simLogs.map((logItem, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-slate-600 select-none text-[10px] shrink-0">{logItem.timestamp}</span>
                    <span className={getLogColorClass(logItem.type)}>{logItem.text}</span>
                  </div>
                ))}
              </div>

              {/* Interactive CLI Input Field */}
              <form onSubmit={handleTerminalSubmit} className="bg-[#141722] border-t border-white/10 px-3 py-2 flex items-center gap-2 shrink-0">
                <span className="text-emerald-400 text-xs font-mono font-bold select-none">agent@parlay:~$</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  disabled={isSimRunning}
                  placeholder={isSimRunning ? 'Agent executing in real time...' : "Type 'run', 'help', 'catalog', or 'clear'..."}
                  className="flex-1 bg-transparent text-xs font-mono text-white outline-none placeholder-slate-600"
                />
                <button
                  type="submit"
                  disabled={isSimRunning || !terminalInput.trim()}
                  className="text-[10px] font-mono px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 disabled:opacity-30 cursor-pointer"
                >
                  Enter ↵
                </button>
              </form>
            </div>
          </div>

          {/* Buyer Settlement Station (Appears when Deal is Closed) */}
          {closedSession && (
            <div className="mt-4 p-4 rounded-xl bg-[#151824] border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4 font-mono shadow-2xl">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-white">
                    {closedSession.product_name} — Deal Closed at ₹{closedSession.final_price}/unit
                  </span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded font-bold ${
                    closedSession.payment_status === 'paid'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {closedSession.payment_status === 'paid' ? 'PAID & CAPTURED' : 'PAYMENT DUE (UNPAID)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Order: {closedSession.quantity} units • Negotiated Subtotal: ₹{Math.round(closedSession.final_price * closedSession.quantity).toLocaleString()} • Total: ₹{Math.round(closedSession.final_price * closedSession.quantity * 1.18).toLocaleString()} (inc. 18% GST)
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsInvoiceModalOpen(true)}
                  className="btn btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 text-slate-200 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
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
        )}

        {/* TAB 3: API SPECIFICATIONS */}
        {activeTab === 'docs' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[#131620] border border-white/10">
              <h2 className="text-base font-bold text-white">Public A2A Gateway Endpoints</h2>
              <p className="text-xs text-slate-400 mt-1">
                Any external autonomous agent, script, or server can interact with Parlay using standard HTTP JSON APIs.
              </p>
            </div>


            {/* Endpoint 0: Catalog */}
            <div className="p-4 rounded-xl bg-[#131722] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    GET
                  </span>
                  <span className="text-xs font-mono font-bold text-white">/api/agent/catalog</span>
                  <span className="text-xs text-slate-400">— Machine-Readable Catalog Discovery</span>
                </div>
                <button
                  onClick={() => copyToClipboard('curl http://localhost:5000/api/agent/catalog', 'cat')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'cat' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Query Parameters</span>
                  <p className="text-slate-500 italic">None required. Returns active inventory with real-time stock and volume discount ladders.</p>
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Response Format (200 OK)</span>
                  <p><span className="text-white">items[]:</span> array of products (sku, name, list_price_inr, ready_stock, volume_discount_tiers)</p>
                  <p><span className="text-white">gateway_endpoints:</span> map of public A2A URLs (rfq, negotiate, settle)</p>
                </div>
              </div>
            </div>

            {/* Endpoint 1: RFQ */}
            <div className="p-4 rounded-xl bg-[#131722] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    POST
                  </span>
                  <span className="text-xs font-mono font-bold text-white">/api/agent/rfq</span>
                  <span className="text-xs text-slate-400">— Submit Request For Quote</span>
                </div>
                <button
                  onClick={() => copyToClipboard(curlExampleRfq, 'rfq')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'rfq' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Request Body Fields</span>
                  <p><span className="text-sky-300">product_id</span> (string, req): Target SKU (e.g. SKU-LED-1001)</p>
                  <p><span className="text-sky-300">quantity</span> (number, req): Number of units requested</p>
                  <p><span className="text-sky-300">buyer_agent_name</span> (string, opt): Identification string</p>
                  <p><span className="text-sky-300">buyer_persona</span> (string, opt): reasonable | lowballer | floor_tester</p>
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Response Fields (201 Created)</span>
                  <p><span className="text-white">session_id:</span> Unique session identifier for subsequent turns</p>
                  <p><span className="text-white">merchant_opening_turn:</span> {`{ message, proposed_price_inr, policy_reason }`}</p>
                  <p><span className="text-white">max_rounds:</span> 8 (Maximum permitted bargaining turns)</p>
                </div>
              </div>

              <pre className="p-3 rounded-lg bg-black/60 border border-white/5 text-[11px] font-mono text-slate-300 overflow-x-auto">
                {curlExampleRfq}
              </pre>
            </div>

            {/* Endpoint 2: Negotiate */}
            <div className="p-4 rounded-xl bg-[#131722] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                    POST
                  </span>
                  <span className="text-xs font-mono font-bold text-white">/api/agent/negotiate</span>
                  <span className="text-xs text-slate-400">— Submit Counter-Bid (Protected by Deterministic Firewall)</span>
                </div>
                <button
                  onClick={() => copyToClipboard(curlExampleNegotiate, 'neg')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'neg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Request Body Fields</span>
                  <p><span className="text-sky-300">session_id</span> (string, req): Session ID returned from RFQ</p>
                  <p><span className="text-sky-300">offered_price</span> (number, req): Unit price in INR offered</p>
                  <p><span className="text-sky-300">message</span> (string, req): Conversational rationale</p>
                  <p><span className="text-sky-300">action</span> (string, req): 'continue' | 'deal_closed' | 'no_deal'</p>
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Firewall & Responses</span>
                  <p><span className="text-white">200 OK:</span> {`{ status: "ongoing", firewall_status: "PASS", merchant_response: { message, proposed_price_inr, action } }`}</p>
                  <p><span className="text-rose-400">422 Unprocessable Entity:</span> FIREWALL_SECURITY_QUARANTINE (Bid strictly below floor boundary)</p>
                </div>
              </div>

              <pre className="p-3 rounded-lg bg-black/60 border border-white/5 text-[11px] font-mono text-slate-300 overflow-x-auto">
                {curlExampleNegotiate}
              </pre>
            </div>

            {/* Endpoint 3: Settle */}
            <div className="p-4 rounded-xl bg-[#131722] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                    POST
                  </span>
                  <span className="text-xs font-mono font-bold text-white">/api/agent/settle</span>
                  <span className="text-xs text-slate-400">— Autonomous Bounded Settlement (Razorpay Order)</span>
                </div>
                <button
                  onClick={() => copyToClipboard(curlExampleSettle, 'set')}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
                >
                  {copiedIndex === 'set' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy cURL</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Request Body Fields</span>
                  <p><span className="text-sky-300">session_id</span> (string, req): Settled negotiation session ID</p>
                  <p><span className="text-sky-300">max_authorized_budget</span> (number, opt): Hard budget ceiling</p>
                </div>
                <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                  <span className="text-emerald-400 font-bold block mb-1 uppercase tracking-wider text-[9px]">Settlement Output</span>
                  <p><span className="text-white">razorpay_order_id:</span> Real Razorpay financial order</p>
                  <p><span className="text-white">transaction_id:</span> M2M Pre-Authorized Mandate ID</p>
                  <p><span className="text-white">stock_allocated:</span> true (Atomic inventory deduction)</p>
                  <p><span className="text-white">receipt_audit:</span> HMAC-SHA256 verified tax invoice message</p>
                </div>
              </div>

              <pre className="p-3 rounded-lg bg-black/60 border border-white/5 text-[11px] font-mono text-slate-300 overflow-x-auto">
                {curlExampleSettle}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: MCP TOOL SPEC */}
        {activeTab === 'mcp' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#131620] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white">Model Context Protocol (MCP) Tool Declaration</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Standard tool definition schema allowing external LLMs (Anthropic Claude Desktop, Cursor, OpenAI Agents) to discover inventory and negotiate with Parlay.
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
                className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                {copiedIndex === 'mcp' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy MCP JSON</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-black border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
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
        onPaymentSuccess={(updated) => {
          setClosedSession(prev => ({
            ...prev,
            payment_status: 'paid',
            razorpay_payment_id: updated?.razorpay_payment_id || 'pay_confirmed'
          }));
        }}
      />
    </div>
  );
}
