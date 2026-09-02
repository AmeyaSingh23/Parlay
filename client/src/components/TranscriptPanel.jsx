import React, { useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  CreditCard,
  Sparkles
} from 'lucide-react';

export default function TranscriptPanel({
  session,
  messages,
  isNegotiating,
  onApproveHitl,
  onRejectHitl
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isNegotiating]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'deal_closed':
        return <span className="badge badge-deal-closed">Deal Closed</span>;
      case 'blocked_by_firewall':
        return <span className="badge badge-blocked">Firewall Blocked</span>;
      case 'pending_hitl':
        return <span className="badge badge-pending-hitl">Pending HITL Approval</span>;
      case 'ongoing':
        return <span className="badge badge-ongoing">Negotiating</span>;
      case 'no_deal':
        return <span className="badge badge-no-deal">No Deal</span>;
      default:
        return <span className="badge badge-no-deal">{status}</span>;
    }
  };

  return (
    <div className="glass-card p-4 flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white font-['Plus_Jakarta_Sans']">Live Arena</h2>
              {session && getStatusBadge(session.status)}
            </div>
            <p className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-[240px]">
              {session ? session.session_id : 'Select a product & persona to begin'}
            </p>
          </div>
        </div>

        {/* Live Round Counter */}
        {session && (
          <div className="text-right">
            <span className="text-[9px] uppercase text-[var(--text-muted)] block font-mono">Round</span>
            <span className="text-xs font-bold text-blue-400 font-mono">
              {session.rounds_count || 1} / 7
            </span>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-3 px-1 flex flex-col gap-3 min-h-0">
        {(!messages || messages.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)]">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mb-2">
              <ShieldCheck className="w-6 h-6 text-blue-400/50" />
            </div>
            <p className="text-xs font-medium text-slate-300">Ready to Negotiate</p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-xs mt-0.5 leading-snug">
              Select an item on the left and click "Start Live Negotiation". Turn-by-turn dialogue and firewall checks stream here in real time.
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isBuyer = msg.sender === 'buyer';
          const isMerchant = msg.sender === 'merchant';
          const isFirewall = msg.sender === 'firewall';
          const isSystem = msg.sender === 'system';
          const isHuman = msg.sender === 'human';

          if (isFirewall) {
            return (
              <div key={index} className="chat-bubble-animate my-1 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold font-mono">
                  <ShieldAlert className="w-4 h-4 animate-bounce" />
                  <span>FIREWALL INTERCEPTION LAYER</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    BLOCKED
                  </span>
                </div>
                <p className="text-xs text-rose-200 mt-1.5 leading-relaxed">
                  {msg.message}
                </p>
                {msg.firewall_details?.live_floor && (
                  <div className="mt-2 text-[10px] font-mono text-rose-300/80 bg-[#090b10]/60 p-1.5 rounded">
                    Live Floor: ₹{msg.firewall_details.live_floor} | Proposed: ₹{msg.proposed_price} (Disallowed)
                  </div>
                )}
              </div>
            );
          }

          if (isSystem || isHuman) {
            return (
              <div key={index} className="chat-bubble-animate my-1 p-2.5 rounded-lg bg-[#0e121e] border border-blue-500/30 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-blue-300">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span>{isHuman ? 'HUMAN DECISION RECORD' : 'SYSTEM AUDIT EVENT'}</span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{msg.message}</p>
              </div>
            );
          }

          return (
            <div
              key={index}
              className={`chat-bubble-animate flex flex-col max-w-[85%] ${
                isBuyer ? 'self-start items-start' : 'self-end items-end'
              }`}
            >
              {/* Sender Label & Avatar */}
              <div className="flex items-center gap-1 mb-1 px-1">
                {isBuyer ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[8px] font-bold">
                      B
                    </div>
                    <span className="text-[10px] font-semibold text-cyan-400">
                      Buyer Agent ({session?.buyer_persona || 'Simulated'})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-semibold text-blue-400">
                      Merchant Agent (Parlay AI)
                    </span>
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[8px] font-bold">
                      M
                    </div>
                  </>
                )}
                <span className="text-[9px] text-[var(--text-muted)] font-mono ml-1">
                  R{msg.round || 1}
                </span>
              </div>

              {/* Bubble Body */}
              <div
                className={`p-3 rounded-xl border text-xs leading-relaxed ${
                  isBuyer
                    ? 'bg-[#121829] border-cyan-500/20 text-slate-100 rounded-tl-sm'
                    : 'bg-gradient-to-br from-[#1a233d] to-[#121829] border-blue-500/30 text-white rounded-tr-sm shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                }`}
              >
                <p className="text-xs leading-relaxed">{msg.message}</p>

                {/* Price Proposal Badge */}
                {msg.proposed_price !== null && msg.proposed_price !== undefined && (
                  <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                      {isBuyer ? 'Offered Unit Rate:' : 'Proposed Unit Rate:'}
                    </span>
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      ₹{msg.proposed_price}
                    </span>
                  </div>
                )}

                {/* Merchant Policy Explanation & Firewall Pass Result */}
                {isMerchant && (
                  <div className="mt-1.5 text-[9px] text-[var(--text-muted)] flex items-center justify-between gap-2 pt-1">
                    <span className="italic truncate max-w-[200px]" title={msg.policy_reason}>
                      {msg.policy_reason}
                    </span>
                    {msg.firewall_result === 'pass' && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-400 font-mono font-semibold shrink-0">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Firewall: PASS
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live typing animation */}
        {isNegotiating && (
          <div className="chat-bubble-animate flex items-center gap-2 text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 py-1.5 px-3 rounded-full w-fit">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>Evaluating pricing policy & validating live floor...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Human In The Loop (HITL) Action Banner */}
      {session?.status === 'pending_hitl' && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 mt-2 flex flex-col gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
              <AlertCircle className="w-4 h-4 animate-pulse" />
              <span>HUMAN-IN-THE-LOOP MERCHANT REVIEW REQUIRED</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-300">
              ₹{session.pending_proposed_price}/unit
            </span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            {session.hitl_reason || 'Proposed price is near minimum floor boundary. Merchant Manager authorization required to proceed.'}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onApproveHitl(session.session_id)}
              className="btn btn-success flex-1 py-1.5 text-xs font-bold"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approve & Authorize</span>
            </button>
            <button
              onClick={() => onRejectHitl(session.session_id)}
              className="btn btn-danger flex-1 py-1.5 text-xs font-bold"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject (Protect Margin)</span>
            </button>
          </div>
        </div>
      )}

      {/* Closed Deal Razorpay Card */}
      {session?.status === 'deal_closed' && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mt-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                Deal Closed at ₹{session.final_price}/unit (Total: ₹{Math.round(session.final_price * session.quantity)})
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                Razorpay Order ID: {session.razorpay_order_id || 'order_test_created'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-mono font-bold">
            <CreditCard className="w-3 h-3" />
            <span>Ready</span>
          </div>
        </div>
      )}
    </div>
  );
}
