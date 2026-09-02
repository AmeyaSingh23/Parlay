import React, { useState } from 'react';
import {
  FileText,
  ChevronRight,
  RefreshCw
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
        return <span className="badge badge-deal-closed text-[9px]">Closed</span>;
      case 'blocked_by_firewall':
        return <span className="badge badge-blocked text-[9px]">Blocked</span>;
      case 'pending_hitl':
        return <span className="badge badge-pending-hitl text-[9px]">HITL</span>;
      case 'ongoing':
        return <span className="badge badge-ongoing text-[9px]">Active</span>;
      case 'no_deal':
        return <span className="badge badge-no-deal text-[9px]">No Deal</span>;
      default:
        return <span className="badge badge-no-deal text-[9px]">{status}</span>;
    }
  };

  return (
    <div className="glass-card p-4 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border-subtle)] shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
            <FileText className="w-4 h-4 text-purple-400" />
            Audit Log
          </h2>
          <p className="text-[11px] text-[var(--text-muted)]">
            Defensible audit trail
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)] transition-colors"
          title="Refresh session history"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 py-2 overflow-x-auto text-[11px] border-b border-[var(--border-subtle)] shrink-0">
        {[
          { key: 'all', label: 'All' },
          { key: 'deal_closed', label: 'Deals' },
          { key: 'pending_hitl', label: 'HITL' },
          { key: 'blocked_by_firewall', label: 'Blocked' },
          { key: 'no_deal', label: 'No Deal' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-all ${
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
      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1.5 min-h-0">
        {filtered.length === 0 && (
          <div className="text-center py-6 text-[11px] text-[var(--text-muted)]">
            No negotiation sessions matching this filter.
          </div>
        )}

        {filtered.map(s => {
          const isSelected = currentSessionId === s.session_id;
          return (
            <div
              key={s.session_id}
              onClick={() => onSelectSession(s.session_id)}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                  : 'bg-[#0e121e]/40 border-[var(--border-subtle)] hover:bg-[#121626] hover:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-white block truncate">
                    {s.product_name || s.product_id}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
                    <span className="truncate">{s.buyer_persona}</span>
                    <span>•</span>
                    <span className="shrink-0">{s.quantity} qty</span>
                  </div>
                </div>
                <div className="shrink-0">{getStatusPill(s.status)}</div>
              </div>

              {/* Pricing breakdown */}
              <div className="mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
                <div className="truncate">
                  {s.final_price ? (
                    <span className="font-mono text-emerald-400 font-bold">
                      ₹{s.final_price}/u (₹{Math.round(s.final_price * s.quantity)})
                    </span>
                  ) : (
                    <span className="font-mono text-[var(--text-muted)] text-[10px]">
                      Floor: ₹{s.floor_price_snapshot || '—'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 text-[10px] text-blue-400 font-medium shrink-0 ml-1">
                  <span>Audit</span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </div>
              </div>

              {/* Inline HITL decision buttons for pending sessions */}
              {s.status === 'pending_hitl' && (
                <div className="mt-1.5 pt-1.5 border-t border-amber-500/30 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onApproveHitl(s.session_id)}
                    className="btn btn-success py-0.5 px-2 text-[10px] flex-1"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onRejectHitl(s.session_id)}
                    className="btn btn-danger py-0.5 px-2 text-[10px] flex-1"
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
