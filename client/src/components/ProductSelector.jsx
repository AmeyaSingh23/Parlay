import React from 'react';
import { Play, Layers, CheckCircle2 } from 'lucide-react';

export default function ProductSelector({
  products,
  selectedProduct,
  onSelectProduct,
  personas,
  selectedPersona,
  onSelectPersona,
  quantity,
  onChangeQuantity,
  onStartNegotiation,
  isNegotiating
}) {
  return (
    <div className="glass-card p-4 flex flex-col gap-3.5 h-full overflow-y-auto">
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
          <Layers className="w-4 h-4 text-blue-400" />
          Negotiation Setup
        </h2>
        <p className="text-[11px] text-[var(--text-muted)]">
          Target SKU & AI Buyer Persona
        </p>
      </div>

      {/* 1. Product SKU Selection */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Select Product SKU
        </label>
        <select
          className="input-field cursor-pointer text-xs"
          value={selectedProduct?.product_id || ''}
          onChange={(e) => {
            const found = products.find(p => p.product_id === e.target.value);
            if (found) onSelectProduct(found);
          }}
          disabled={isNegotiating}
        >
          {products.map(p => (
            <option key={p.product_id} value={p.product_id} className="bg-[#0e121e] text-white">
              {p.name} ({p.product_id}) — ₹{p.list_price} {p.negotiable ? '' : '[FIXED]'}
            </option>
          ))}
        </select>
      </div>

      {/* Product Live Pricing Policy Card */}
      {selectedProduct && (
        <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white truncate max-w-[180px]">
              {selectedProduct.name}
            </span>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${selectedProduct.negotiable ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
              {selectedProduct.negotiable ? 'Negotiable' : 'Fixed'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-[#090b10]/60 p-1.5 rounded">
              <span className="text-[9px] uppercase text-[var(--text-muted)] block font-mono">List</span>
              <span className="text-xs font-bold text-white font-mono">₹{selectedProduct.list_price}</span>
            </div>
            <div className="bg-blue-500/10 p-1.5 rounded border border-blue-500/20">
              <span className="text-[9px] uppercase text-blue-400 block font-mono">Target</span>
              <span className="text-xs font-bold text-blue-300 font-mono">₹{selectedProduct.target_price}</span>
            </div>
            <div className="bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
              <span className="text-[9px] uppercase text-rose-400 block font-mono">Floor</span>
              <span className="text-xs font-bold text-rose-300 font-mono">₹{selectedProduct.floor_price}</span>
            </div>
          </div>

          {/* Discount Ladder Preview */}
          {selectedProduct.discount_ladder && selectedProduct.discount_ladder.length > 0 && (
            <div className="text-[10px] text-[var(--text-muted)] bg-[#090b10]/40 p-1.5 rounded">
              <span className="font-semibold text-[var(--text-secondary)]">Tiers: </span>
              {selectedProduct.discount_ladder.map((t, idx) => (
                <span key={idx} className="font-mono text-slate-300">
                  {t.min_qty}+: ≤{t.max_discount_pct}%{idx < selectedProduct.discount_ladder.length - 1 ? ' | ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Order Quantity Input */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center text-[10px]">
          <label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Order Qty ({selectedProduct?.unit || 'units'})
          </label>
          <span className="font-mono text-[var(--text-muted)]">
            Stock: {selectedProduct?.stock_level || 0}
          </span>
        </div>
        <input
          type="number"
          min="1"
          max={selectedProduct?.stock_level || 1000}
          className="input-field font-mono text-xs py-1.5"
          value={quantity}
          onChange={(e) => onChangeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={isNegotiating}
        />
      </div>

      {/* 3. Simulated Buyer Persona Selection */}
      <div className="flex flex-col gap-1.5 flex-1">
        <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
          <span>AI Buyer Persona</span>
          <span className="text-[9px] text-blue-400 lowercase font-mono">4 scenarios</span>
        </label>

        <div className="flex flex-col gap-1.5">
          {Object.entries(personas || {}).map(([key, p]) => {
            const isSelected = selectedPersona === key;
            return (
              <div
                key={key}
                onClick={() => !isNegotiating && onSelectPersona(key)}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-500/15 border-blue-500/60 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                    : 'bg-[#0e121e]/60 border-[var(--border-subtle)] hover:border-slate-600 hover:bg-[#121626]'
                } ${isNegotiating ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                    {p.displayName}
                  </span>
                  {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-1 leading-snug">
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Negotiation Button */}
      <div className="pt-1 mt-auto">
        <button
          onClick={onStartNegotiation}
          disabled={isNegotiating || !selectedProduct}
          className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          {isNegotiating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Negotiating...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Live Negotiation</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
