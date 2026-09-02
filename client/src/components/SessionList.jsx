import React, { useState } from 'react';
import {
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export default function SessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onRefresh,
  onApproveHitl,
  onRejectHitl
}) {
  const [filter, setFilter] = useState('all');

  const filtered = (sessions || []).filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  });

  const getStatusPill = (status) => {
    switch (status) {
      case 'deal_closed':
        return <span className="badge badge-deal-closed">Closed</span>;
      case 'blocked_by_firewall':
        return <span className="badge badge-blocked">Blocked</span>;
      case 'pending_hitl':
        return <span className="badge badge-pending-hitl">Pending HITL</span>;
      case 'ongoing':
        return <span className="badge badge-ongoing">Active</span>;
      case 'no_deal':
        return <span className="badge badge-no-deal">No Deal</span>;
      default:
        return <span className="badge badge-no-deal">{status}</span>;
    }
  };

  return (
    <div className="glass-card p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            Audit Log & Sessions
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Full defensible audit trail of every money-adjacent decision
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)] transition-colors"
          title="Refresh session history"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 py-3 overflow-x-auto text-xs border-b border-[var(--border-subtle)]">
        {[
          { key: 'all', label: 'All' },
          { key: 'deal_closed', label: 'Closed Deals' },
          { key: 'pending_hitl', label: 'Pending HITL' },
          { key: 'blocked_by_firewall', label: 'Firewall Blocked' },
          { key: 'no_deal', label: 'No Deal' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filter === tab.key
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-[var(--text-muted)] hover:text-slate-200 hover:bg-[#121626]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Session Items List */}
      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-[var(--text-muted)]">
            No negotiation sessions matching this filter.
          </div>
        )}

        {filtered.map(s => {
          const isSelected = currentSessionId === s.session_id;
          return (
            <div
              key={s.session_id}
              onClick={() => onSelectSession(s.session_id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                  : 'bg-[#0e121e]/40 border-[var(--border-subtle)] hover:bg-[#121626] hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-white block">
                    {s.product_name || s.product_id}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-[var(--text-muted)]">
                    <span>{s.buyer_persona}</span>
                    <span>•</span>
                    <span>{s.quantity} units</span>
                  </div>
                </div>
                {getStatusPill(s.status)}
              </div>

              {/* Pricing breakdown */}
              <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                <div>
                  {s.final_price ? (
                    <span className="font-mono text-emerald-400 font-bold">
                      ₹{s.final_price}/unit (Total ₹{Math.round(s.final_price * s.quantity)})
                    </span>
                  ) : (
                    <span className="font-mono text-[var(--text-muted)] text-[11px]">
                      Floor: ₹{s.floor_price_snapshot || '—'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-blue-400 font-medium">
                  <span>Inspect Audit</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>

              {/* Inline HITL decision buttons for pending sessions */}
              {s.status === 'pending_hitl' && (
                <div className="mt-2.5 pt-2 border-t border-amber-500/30 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onApproveHitl(s.session_id)}
                    className="btn btn-success py-1 px-2.5 text-[11px] flex-1"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onRejectHitl(s.session_id)}
                    className="btn btn-danger py-1 px-2.5 text-[11px] flex-1"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
