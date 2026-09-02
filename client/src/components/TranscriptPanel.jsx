import React, { useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Bot,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText
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
    <div className="panel-card flex flex-col h-full overflow-hidden bg-white">
      {/* Pinned Header */}
      <div className="p-3 pb-2.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center border border-slate-200">
            <Bot className="w-3.5 h-3.5 text-slate-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider font-mono">
                Live Negotiation Arena
              </h2>
              {session && getStatusBadge(session.status)}
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate max-w-[280px]">
              {session ? session.session_id : 'Select a product & persona to begin'}
            </p>
          </div>
        </div>

        {/* Round Counter */}
        {session && (
          <div className="text-right font-mono">
            <span className="text-[8px] uppercase text-slate-400 block">Round</span>
            <span className="text-xs font-bold text-slate-800">
              {session.rounds_count || 1} / 7
            </span>
          </div>
        )}
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5 min-h-0 bg-[#fafafa]">
        {(!messages || messages.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center mb-2 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-xs font-bold text-slate-800">Ready to Negotiate</p>
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
              <div key={index} className="chat-bubble-animate my-1 p-2.5 rounded bg-rose-50 border border-rose-200 shadow-xs">
                <div className="flex items-center gap-1.5 text-rose-800 text-xs font-bold font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>FIREWALL INTERCEPTION LAYER</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-mono font-bold border border-rose-300">
                    BLOCKED
                  </span>
                </div>
                <p className="text-[11px] text-rose-900 mt-1">
                  {msg.message}
                </p>
                {msg.firewall_details?.live_floor && (
                  <div className="mt-1.5 text-[10px] font-mono text-rose-700 bg-white p-1.5 rounded border border-rose-200">
                    Live Floor: ₹{msg.firewall_details.live_floor} | Proposed: ₹{msg.proposed_price} (Disallowed)
                  </div>
                )}
              </div>
            );
          }

          if (isSystem || isHuman) {
            return (
              <div key={index} className="chat-bubble-animate my-0.5 p-2 rounded bg-white border border-slate-200 text-center shadow-xs">
                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider block mb-0.5">
                  {isHuman ? 'Human Decision Record' : 'System Event'}
                </span>
                <p className="text-[11px] text-slate-800 font-mono">{msg.message}</p>
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
              {/* Sender Tag */}
              <div className="flex items-center gap-1 mb-0.5 px-1 font-mono text-[9px]">
                <span className={`font-semibold ${isBuyer ? 'text-slate-600' : 'text-slate-900'}`}>
                  {isBuyer ? `Buyer (${session?.buyer_persona || 'Simulated'})` : 'Merchant Agent (Parlay)'}
                </span>
                <span className="text-slate-400">• R{msg.round || 1}</span>
              </div>

              {/* Message Box */}
              <div
                className={`p-2.5 rounded border text-xs leading-relaxed shadow-xs ${
                  isBuyer
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-900 border-slate-900 text-white'
                }`}
              >
                <p>{msg.message}</p>

                {/* Price Proposal Pill */}
                {msg.proposed_price !== null && msg.proposed_price !== undefined && (
                  <div className={`mt-2 pt-1.5 border-t flex items-center justify-between gap-2 text-[10px] font-mono ${
                    isBuyer ? 'border-slate-100' : 'border-slate-800'
                  }`}>
                    <span className={`uppercase text-[9px] ${isBuyer ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isBuyer ? 'Offered Unit Price:' : 'Proposed Unit Price:'}
                    </span>
                    <span className={`font-bold px-1.5 py-0.2 rounded ${
                      isBuyer ? 'bg-slate-100 text-slate-900 border border-slate-200' : 'bg-slate-800 text-white border border-slate-700'
                    }`}>
                      ₹{msg.proposed_price}
                    </span>
                  </div>
                )}

                {/* Merchant Policy Reason */}
                {isMerchant && (
                  <div className="mt-1.5 pt-1 border-t border-slate-800 text-[9px] text-slate-400 flex items-center justify-between gap-2 font-mono">
                    <span className="italic truncate max-w-[200px]" title={msg.policy_reason}>
                      {msg.policy_reason}
                    </span>
                    {msg.firewall_result === 'pass' && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-400 shrink-0">
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

        {/* Live typing indicator */}
        {isNegotiating && (
          <div className="chat-bubble-animate flex items-center gap-2 text-[10px] text-slate-600 bg-white border border-slate-200 py-1 px-2.5 rounded w-fit font-mono shadow-xs">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-slate-600 animate-bounce" />
              <span className="w-1 h-1 rounded-full bg-slate-600 animate-bounce [animation-delay:0.15s]" />
              <span className="w-1 h-1 rounded-full bg-slate-600 animate-bounce [animation-delay:0.3s]" />
            </div>
            <span>Evaluating pricing policy & validating live floor...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Pinned HITL Review Banner */}
      {session?.status === 'pending_hitl' && (
        <div className="p-2.5 bg-amber-50 border-t border-amber-200 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-amber-900 text-xs font-bold font-mono">
              <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
              <span>HUMAN-IN-THE-LOOP MERCHANT REVIEW REQUIRED</span>
            </div>
            <span className="text-xs font-mono font-bold text-amber-900">
              ₹{session.pending_proposed_price}/unit
            </span>
          </div>
          <p className="text-[10px] text-amber-800 leading-tight">
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
        <div className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 font-mono shadow-xs">
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              Deal Closed at ₹{session.final_price}/unit (Total: ₹{Math.round(session.final_price * session.quantity).toLocaleString()})
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold">
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
