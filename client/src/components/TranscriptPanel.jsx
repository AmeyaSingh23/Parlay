import React, { useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Store
} from 'lucide-react';

export default function TranscriptPanel({
  session,
  messages,
  isNegotiating,
  onApproveHitl,
  onRejectHitl,
  onOpenInvoice
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
    <div className="panel-card flex flex-col h-full overflow-hidden bg-[#141720]">
      {/* Pinned Header */}
      <div className="p-3 pb-2.5 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#141720]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-slate-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider font-mono">
                Live Negotiation Arena
              </h2>
              {session && getStatusBadge(session.status)}
            </div>
            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]">
              {session ? session.session_id : 'Select a product & persona to begin'}
            </p>
          </div>
        </div>

        {/* Round Counter */}
        {session && (
          <div className="text-right font-mono">
            <span className="text-[8px] uppercase text-slate-400 block">Round</span>
            <span className="text-xs font-bold text-slate-200">
              {session.rounds_count || 1} / 7
            </span>
          </div>
        )}
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 min-h-0 bg-[#0d0f14]">
        {(!messages || messages.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <div className="w-8 h-8 rounded bg-[#191c26] border border-white/5 flex items-center justify-center mb-2 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-300">Ready to Negotiate</p>
            <p className="text-[10px] text-slate-500 max-w-xs mt-0.5">
              Select an item on the left and click "Start Live Negotiation". Multi-agent dialogue and firewall checks will stream here.
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
              <div key={index} className="chat-bubble-animate my-1 p-2.5 rounded bg-rose-950/30 border border-rose-700/50 shadow-xs">
                <div className="flex items-center gap-1.5 text-rose-300 text-xs font-bold font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>FIREWALL INTERCEPTION LAYER</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
                    BLOCKED
                  </span>
                </div>
                <p className="text-[11px] text-rose-200 mt-1">
                  {msg.message}
                </p>
                {msg.firewall_details?.live_floor && (
                  <div className="mt-1.5 text-[10px] font-mono text-rose-300/80 bg-black/40 p-1.5 rounded border border-rose-800/30">
                    Live Floor: ₹{msg.firewall_details.live_floor} | Proposed: ₹{msg.proposed_price} (Disallowed)
                  </div>
                )}
              </div>
            );
          }

          if (isSystem || isHuman) {
            const isPaymentReceipt = msg.message.includes('PAYMENT CAPTURED') || msg.policy_reason === 'PAYMENT_CAPTURED_HMAC_VERIFIED';
            if (isPaymentReceipt) {
              return (
                <div key={index} className="chat-bubble-animate my-1.5 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 shadow-xs text-left">
                  <div className="flex items-center justify-between text-emerald-400 text-xs font-bold font-mono">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>OFFICIAL B2B PAYMENT RECEIPT DELIVERED</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                      HMAC VERIFIED
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200 mt-1 font-mono leading-relaxed">
                    {msg.message}
                  </p>
                </div>
              );
            }

            return (
              <div key={index} className="chat-bubble-animate my-0.5 p-2 rounded bg-[#191c26] border border-white/5 text-center shadow-xs">
                <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider block mb-0.5">
                  {isHuman ? 'Human Decision Record' : 'System Event'}
                </span>
                <p className="text-[11px] text-slate-300 font-mono">{msg.message}</p>
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
              {/* Distinct Sender Tag & Avatar */}
              <div className="flex items-center gap-1.5 mb-1 px-1 font-mono text-[10px]">
                {isBuyer ? (
                  <>
                    <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[9px] font-bold">
                      <User className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-bold text-amber-300">
                      Buyer Agent ({session?.buyer_persona || 'Simulated'})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-emerald-300">
                      Merchant Agent (Parlay AI)
                    </span>
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[9px] font-bold">
                      <Store className="w-2.5 h-2.5" />
                    </div>
                  </>
                )}
                <span className="text-slate-500">• R{msg.round || 1}</span>
              </div>

              {/* Distinct Message Box Coloring */}
              <div
                className={`p-3 rounded-lg border text-xs leading-relaxed shadow-sm ${
                  isBuyer
                    ? 'bg-[#1a1d28] border-amber-500/30 text-amber-50/95 rounded-tl-xs'
                    : 'bg-[#152220] border-emerald-500/30 text-emerald-50/95 rounded-tr-xs'
                }`}
              >
                <p className="leading-relaxed">{msg.message}</p>

                {/* Price Proposal Pill */}
                {msg.proposed_price !== null && msg.proposed_price !== undefined && (
                  <div className={`mt-2.5 pt-1.5 border-t flex items-center justify-between gap-2 text-[10px] font-mono ${
                    isBuyer ? 'border-amber-500/20' : 'border-emerald-500/20'
                  }`}>
                    <span className={`uppercase text-[9px] font-semibold ${isBuyer ? 'text-amber-300/80' : 'text-emerald-300/80'}`}>
                      {isBuyer ? 'Offered Unit Rate:' : 'Counter Unit Rate:'}
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded ${
                      isBuyer
                        ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
                    }`}>
                      ₹{msg.proposed_price}/unit
                    </span>
                  </div>
                )}

                {/* Merchant Policy Reasoning & Firewall Audit Box */}
                {isMerchant && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex flex-col gap-1 text-[9px] font-mono">
                    <div className="flex items-center justify-between gap-1 text-emerald-400/90 font-semibold">
                      <span className="uppercase tracking-wider">Internal Policy Reason:</span>
                      {msg.firewall_result === 'pass' && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-300 font-semibold bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Firewall: PASS
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-300/80 leading-relaxed italic bg-black/25 p-1.5 rounded border border-emerald-500/10">
                      {msg.policy_reason || 'Priced in accordance with catalog target and volume tier margins.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live typing indicator */}
        {isNegotiating && (
          <div className="chat-bubble-animate flex items-center gap-2 text-[10px] text-slate-300 bg-[#191c26] border border-white/5 py-1 px-2.5 rounded w-fit font-mono shadow-xs">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce [animation-delay:0.15s]" />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce [animation-delay:0.3s]" />
            </div>
            <span>Evaluating pricing policy & validating live floor...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Pinned HITL Review Banner */}
      {session?.status === 'pending_hitl' && (
        <div className="p-2.5 bg-amber-950/20 border-t border-amber-700/40 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-amber-400 text-xs font-bold font-mono">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>HUMAN-IN-THE-LOOP MERCHANT REVIEW REQUIRED</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-300">
              ₹{session.pending_proposed_price}/unit
            </span>
          </div>
          <p className="text-[10px] text-amber-200/90 leading-tight">
            {session.hitl_reason || 'Proposed price is near minimum floor boundary. Merchant Manager authorization required.'}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={() => onApproveHitl(session.session_id)}
              className="btn btn-success flex-1 py-1 text-xs font-bold"
            >
              <CheckCircle className="w-3 h-3" />
              <span>Approve Deal</span>
            </button>
            <button
              onClick={() => onRejectHitl(session.session_id)}
              className="btn btn-danger flex-1 py-1 text-xs font-bold"
            >
              <XCircle className="w-3 h-3" />
              <span>Reject (Protect Margin)</span>
            </button>
          </div>
        </div>
      )}

      {/* Pinned Closed Deal Card with Invoice Action */}
      {session?.status === 'deal_closed' && (
        <div className="p-2.5 bg-[#191c26] border-t border-white/[0.08] flex items-center justify-between shrink-0 font-mono shadow-xs">
          <div>
            <span className="text-xs font-bold text-white block">
              Deal Closed at ₹{session.final_price}/unit (Total: ₹{Math.round(session.final_price * session.quantity).toLocaleString()})
            </span>
            <span className="text-[10px] text-emerald-400 font-semibold">
              Razorpay Order: {session.razorpay_order_id || 'order_created'}
            </span>
          </div>
          <button
            onClick={onOpenInvoice}
            className="btn btn-primary py-1 px-2.5 text-[11px] font-mono flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            <span>Commercial Invoice</span>
          </button>
        </div>
      )}
    </div>
  );
}
