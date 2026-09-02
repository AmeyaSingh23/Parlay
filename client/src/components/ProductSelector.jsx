import React, { useState } from 'react';
import { Play, Shield, TrendingDown, Layers, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

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
  const currentPersona = personas?.[selectedPersona] || null;

  return (
    <div className="glass-card p-5 flex flex-col gap-5 h-full">
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          Negotiation Setup
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Select target catalog SKU and AI buyer persona
        </p>
      </div>

      {/* 1. Product SKU Selection */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Select Product
        </label>
        <select
          className="input-field cursor-pointer"
          value={selectedProduct?.product_id || ''}
          onChange={(e) => {
            const found = products.find(p => p.product_id === e.target.value);
            if (found) onSelectProduct(found);
          }}
          disabled={isNegotiating}
        >
          {products.map(p => (
            <option key={p.product_id} value={p.product_id} className="bg-[#0e121e] text-white">
              {p.name} ({p.product_id}) — List: ₹{p.list_price} {p.negotiable ? '' : '[FIXED]'}
            </option>
          ))}
        </select>
      </div>

      {/* Product Live Pricing Policy Card */}
      {selectedProduct && (
        <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white truncate max-w-[200px]">
              {selectedProduct.name}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${selectedProduct.negotiable ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
              {selectedProduct.negotiable ? 'Negotiable' : 'Fixed Price'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[var(--border-subtle)]">
            <div className="bg-[#090b10]/60 p-2 rounded-lg">
              <span className="text-[10px] uppercase text-[var(--text-muted)] block font-mono">List</span>
              <span className="text-xs font-bold text-white font-mono">₹{selectedProduct.list_price}</span>
            </div>
            <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
              <span className="text-[10px] uppercase text-blue-400 block font-mono">Target</span>
              <span className="text-xs font-bold text-blue-300 font-mono">₹{selectedProduct.target_price}</span>
            </div>
            <div className="bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
              <span className="text-[10px] uppercase text-rose-400 block font-mono">Floor</span>
              <span className="text-xs font-bold text-rose-300 font-mono">₹{selectedProduct.floor_price}</span>
            </div>
          </div>

          {/* Discount Ladder Preview */}
          {selectedProduct.discount_ladder && selectedProduct.discount_ladder.length > 0 && (
            <div className="text-[11px] text-[var(--text-muted)] bg-[#090b10]/40 p-2 rounded-lg">
              <span className="font-semibold text-[var(--text-secondary)]">Discount Tiers: </span>
              {selectedProduct.discount_ladder.map((t, idx) => (
                <span key={idx} className="font-mono text-slate-300">
                  {t.min_qty}+ units: ≤{t.max_discount_pct}%{idx < selectedProduct.discount_ladder.length - 1 ? ' | ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Order Quantity Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Order Quantity ({selectedProduct?.unit || 'units'})
          </label>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Stock: {selectedProduct?.stock_level || 0}
          </span>
        </div>
        <input
          type="number"
          min="1"
          max={selectedProduct?.stock_level || 1000}
          className="input-field font-mono"
          value={quantity}
          onChange={(e) => onChangeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={isNegotiating}
        />
      </div>

      {/* 3. Simulated Buyer Persona Selection (4 Scenarios) */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
          <span>AI Buyer Persona</span>
          <span className="text-[10px] text-blue-400 lowercase font-mono">4 demo scenarios</span>
        </label>

        <div className="grid grid-cols-1 gap-2">
          {Object.entries(personas || {}).map(([key, p]) => {
            const isSelected = selectedPersona === key;
            return (
              <div
                key={key}
                onClick={() => !isNegotiating && onSelectPersona(key)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-500/15 border-blue-500/60 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                    : 'bg-[#0e121e]/60 border-[var(--border-subtle)] hover:border-slate-600 hover:bg-[#121626]'
                } ${isNegotiating ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                    {p.displayName}
                  </span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed line-clamp-2">
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start Negotiation Button */}
      <div className="mt-auto pt-2">
        <button
          onClick={onStartNegotiation}
          disabled={isNegotiating || !selectedProduct}
          className="btn btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
        >
          {isNegotiating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Negotiation in Progress...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Start Live Negotiation</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
