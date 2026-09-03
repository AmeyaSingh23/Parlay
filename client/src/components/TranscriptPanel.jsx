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
  Store,
  Award
} from 'lucide-react';

const COMPANY_MAP = {
  reasonable: 'Apex Global Procurement',
  aggressive_lowballer: 'Titan Bulk Liquidators',
  lowballer: 'Titan Bulk Liquidators',
  impatient_enterprise: 'Nexus FastTrack Logistics',
  impatient: 'Nexus FastTrack Logistics',
  floor_tester: 'Spectre Automated Arbitrage',
  generous: 'Zenith Premium Capital'
};

const getCompanyName = (persona) => {
  return COMPANY_MAP[persona] || 'Enterprise Client';
};

const getTierBadge = (tier, trust = 50) => {
  const effectiveTier = tier || (
    (trust >= 80) ? 'VIP_PARTNER' :
    (trust >= 50) ? 'GROWTH_ACCOUNT' :
    (trust >= 30) ? 'WATCHLIST' : 'CHRONIC_LOWBALLER'
  );

  switch (effectiveTier) {
    case 'VIP_PARTNER':
      return {
        label: 'VIP Partner (+4% Elasticity)',
        className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      };
    case 'GROWTH_ACCOUNT':
      return {
        label: 'Growth Partner (+1.5% Elasticity)',
        className: 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
      };
    case 'WATCHLIST':
      return {
        label: 'Watchlist Account',
        className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
      };
    case 'CHRONIC_LOWBALLER':
      return {
        label: 'Lowballer Risk (0% Concession)',
        className: 'bg-red-500/15 text-red-300 border border-red-500/30'
      };
    default:
      return {
        label: 'Growth Partner (+1.5% Elasticity)',
        className: 'bg-zinc-800 text-zinc-300 border border-zinc-700/60'
      };
  }
};

export default function TranscriptPanel({
  session,
  messages,
  isNegotiating,
  onApproveHitl,
  onRejectHitl,
  onOpenInvoice
}) {
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
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
    <div className="panel-card flex flex-col h-full overflow-hidden bg-zinc-900">
      {/* Pinned Header */}
      <div className="p-3 pb-2.5 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-zinc-800 border border-white/[0.06] flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider font-mono">
                Live Negotiation Arena
              </h2>
              {session && getStatusBadge(session.status)}
            </div>
            <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[280px]">
              {session ? session.session_id : 'Select a product and persona to begin'}
            </p>
          </div>
        </div>

        {/* Round Counter */}
        {session && (
          <div className="text-right font-mono">
            <span className="text-[8px] uppercase text-zinc-500 block">Round</span>
            <span className="text-xs font-bold text-zinc-200">
              {session.rounds_count || 1} / 8
            </span>
          </div>
        )}
      </div>

      {/* Customer Memory & Reputation Dossier Bar */}
      {session && (
        <div className="px-3.5 py-2 bg-zinc-950/80 border-b border-white/[0.04] flex items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 min-w-0">
            <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold text-zinc-200 truncate">
              {getCompanyName(session.buyer_persona)}
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold shrink-0 ${getTierBadge(session.loyalty_tier_snapshot, session.trust_score_snapshot).className}`}>
              {getTierBadge(session.loyalty_tier_snapshot, session.trust_score_snapshot).label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[10px]">
            <span className="text-zinc-500">Trust Score:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-white/[0.04]">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    (session.trust_score_snapshot || 50) >= 80 ? 'bg-emerald-400' :
                    (session.trust_score_snapshot || 50) >= 50 ? 'bg-emerald-500/70' :
                    (session.trust_score_snapshot || 50) >= 30 ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, session.trust_score_snapshot || 50))}%` }}
                />
              </div>
              <span className={`font-bold font-mono ${
                (session.trust_score_snapshot || 50) >= 80 ? 'text-emerald-300' :
                (session.trust_score_snapshot || 50) >= 50 ? 'text-emerald-400' :
                (session.trust_score_snapshot || 50) >= 30 ? 'text-amber-300' : 'text-red-400'
              }`}>
                {session.trust_score_snapshot || 50}/100
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3 min-h-0 bg-[#09090b]">
        {(!messages || messages.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <div className="w-8 h-8 rounded bg-zinc-900 border border-white/[0.06] flex items-center justify-center mb-2">
              <ShieldCheck className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-xs font-bold text-zinc-300">Ready to Negotiate</p>
            <p className="text-[10px] text-zinc-500 max-w-xs mt-0.5">
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
              <div key={index} className="chat-bubble-animate my-1 p-2.5 rounded bg-red-950/25 border border-red-500/30">
                <div className="flex items-center gap-1.5 text-red-300 text-xs font-bold font-mono">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>FIREWALL INTERCEPTION LAYER</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono font-bold border border-red-500/30">
                    BLOCKED
                  </span>
                </div>
                <p className="text-[11px] text-red-200 mt-1">
                  {msg.message}
                </p>
                {msg.firewall_details?.live_floor && (
                  <div className="mt-1.5 text-[10px] font-mono text-red-300/90 bg-black/40 p-1.5 rounded border border-red-900/30">
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
                <div key={index} className="chat-bubble-animate my-1.5 p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/30 text-left">
                  <div className="flex items-center justify-between text-emerald-400 text-xs font-bold font-mono">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>OFFICIAL B2B PAYMENT RECEIPT DELIVERED</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono font-semibold border border-emerald-500/25">
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
              <div key={index} className="chat-bubble-animate my-0.5 p-2 rounded bg-zinc-900 border border-white/[0.04] text-center">
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block mb-0.5">
                  {isHuman ? 'Human Decision Record' : 'System Event'}
                </span>
                <p className="text-[11px] text-zinc-300 font-mono">{msg.message}</p>
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
                    <span className="font-bold text-emerald-400">
                      Merchant Agent (Parlay AI)
                    </span>
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[9px] font-bold">
                      <Store className="w-2.5 h-2.5" />
                    </div>
                  </>
                )}
                <span className="text-zinc-500">• R{msg.round || 1}</span>
              </div>

              {/* Distinct Message Box Coloring */}
              <div
                className={`p-3 rounded-lg border text-xs leading-relaxed ${
                  isBuyer
                    ? 'bg-zinc-900/90 border-amber-500/25 text-zinc-100 rounded-tl-xs'
                    : 'bg-emerald-950/20 border-emerald-500/25 text-zinc-100 rounded-tr-xs'
                }`}
              >
                <p className="leading-relaxed">{msg.message}</p>

                {/* Price Proposal Pill */}
                {msg.proposed_price !== null && msg.proposed_price !== undefined && (
                  <div className={`mt-2.5 pt-1.5 border-t flex items-center justify-between gap-2 text-[10px] font-mono ${
                    isBuyer ? 'border-amber-500/20' : 'border-emerald-500/20'
                  }`}>
                    <span className={`uppercase text-[9px] font-semibold ${isBuyer ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>
                      {isBuyer ? 'Offered Unit Rate:' : 'Counter Unit Rate:'}
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded ${
                      isBuyer
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      ₹{msg.proposed_price}/unit
                    </span>
                  </div>
                )}

                {/* Merchant Policy Reasoning & Firewall Audit Box */}
                {isMerchant && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex flex-col gap-1 text-[9px] font-mono">
                    <div className="flex items-center justify-between gap-1 text-emerald-400 font-semibold">
                      <span className="uppercase tracking-wider">Internal Policy Reason:</span>
                      {msg.firewall_result === 'pass' && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-300 font-semibold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/25">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          Firewall: PASS
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-300 leading-relaxed italic bg-black/30 p-1.5 rounded border border-emerald-500/10">
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
          <div className="chat-bubble-animate flex items-center gap-2 text-[10px] text-zinc-300 bg-zinc-900 border border-white/[0.06] py-1 px-2.5 rounded w-fit font-mono">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce" />
              <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.15s]" />
              <span className="w-1 h-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.3s]" />
            </div>
            <span>Evaluating pricing policy and validating live floor...</span>
          </div>
        )}
      </div>

      {/* Pinned HITL Review Banner */}
      {session?.status === 'pending_hitl' && (
        <div className="p-2.5 bg-amber-950/20 border-t border-amber-600/30 flex flex-col gap-1.5 shrink-0">
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
            {session.hitl_reason || 'Proposed price requires Merchant Manager sign-off.'}
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
        <div className="p-2.5 bg-zinc-900 border-t border-white/[0.06] flex items-center justify-between shrink-0 font-mono">
          <div>
            <span className="text-xs font-bold text-zinc-100 block">
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
