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
        return <span className="badge badge-deal-closed">Closed</span>;
      case 'blocked_by_firewall':
        return <span className="badge badge-blocked">Blocked</span>;
      case 'pending_hitl':
        return <span className="badge badge-pending-hitl">HITL</span>;
      case 'ongoing':
        return <span className="badge badge-ongoing">Active</span>;
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
        <div>
          <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <FileText className="w-3.5 h-3.5 text-slate-700" />
            Audit Ledger
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            Defensible audit trail
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Refresh session history"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-2 overflow-x-auto text-[9px] border-b border-slate-200 shrink-0 font-mono bg-white">
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
            className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
              filter === tab.key
                ? 'bg-slate-900 text-white font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Audit List */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5 min-h-0 bg-[#fafafa]">
        {filtered.length === 0 && (
          <div className="text-center py-6 text-[10px] text-slate-500 font-mono">
            No sessions matching this filter.
          </div>
        )}

        {filtered.map(s => {
          const isSelected = currentSessionId === s.session_id;
          return (
            <div
              key={s.session_id}
              onClick={() => onSelectSession(s.session_id)}
              className={`p-2 rounded border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white border-slate-900 shadow-sm'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold text-slate-900 block truncate">
                    {s.product_name || s.product_id}
                  </span>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500 mt-0.5">
                    <span className="truncate">{s.buyer_persona}</span>
                    <span>•</span>
                    <span className="shrink-0">{s.quantity} qty</span>
                  </div>
                </div>
                <div className="shrink-0">{getStatusPill(s.status)}</div>
              </div>

              {/* Price Row */}
              <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                <div className="truncate">
                  {s.final_price ? (
                    <span className="text-emerald-700 font-bold">
                      ₹{s.final_price}/u (₹{Math.round(s.final_price * s.quantity).toLocaleString()})
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      Floor: ₹{s.floor_price_snapshot || '—'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 text-[9px] text-slate-600 shrink-0 ml-1">
                  <span>Inspect</span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </div>
              </div>

              {/* Inline HITL Buttons */}
              {s.status === 'pending_hitl' && (
                <div className="mt-1.5 pt-1.5 border-t border-amber-200 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onApproveHitl(s.session_id)}
                    className="btn btn-success py-0.5 px-2 text-[9px] flex-1 font-mono"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onRejectHitl(s.session_id)}
                    className="btn btn-danger py-0.5 px-2 text-[9px] flex-1 font-mono"
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
