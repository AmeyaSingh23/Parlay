import React, { useState } from 'react';
import { Play, Layers, Check, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [expandedPersonas, setExpandedPersonas] = useState({
    reasonable: true
  });

  const toggleExpand = (e, key) => {
    e.stopPropagation();
    setExpandedPersonas(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="panel-card flex flex-col h-full overflow-hidden bg-[#141720]">
      {/* Pinned Header */}
      <div className="p-3 pb-2.5 border-b border-white/[0.08] shrink-0 bg-[#141720]">
        <h2 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Negotiation Setup
        </h2>
        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
          Select target SKU & AI buyer persona
        </p>
      </div>

      {/* Scrollable Setup Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0 bg-[#141720]">
        {/* 1. Product SKU Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Catalog SKU
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
              <option key={p.product_id} value={p.product_id} className="bg-[#0f1118] text-slate-200">
                {p.name} ({p.product_id}) — ₹{p.list_price} {p.negotiable ? '' : '[FIXED]'}
              </option>
            ))}
          </select>
        </div>

        {/* Product Live Pricing Policy Card */}
        {selectedProduct && (
          <div className="p-2.5 rounded bg-[#191c26] border border-white/[0.06] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[180px]">
                {selectedProduct.name}
              </span>
              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${selectedProduct.negotiable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                {selectedProduct.negotiable ? 'Negotiable' : 'Fixed Price'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
              <div className="bg-[#0f1118] p-1 rounded border border-white/5">
                <span className="text-[8px] uppercase text-slate-400 block">List</span>
                <span className="text-[11px] font-bold text-slate-200">₹{selectedProduct.list_price}</span>
              </div>
              <div className="bg-[#0f1118] p-1 rounded border border-white/5">
                <span className="text-[8px] uppercase text-slate-400 block">Target</span>
                <span className="text-[11px] font-bold text-slate-100">₹{selectedProduct.target_price}</span>
              </div>
              <div className="bg-[#0f1118] p-1 rounded border border-rose-500/20">
                <span className="text-[8px] uppercase text-rose-400/90 block font-semibold">Floor</span>
                <span className="text-[11px] font-bold text-rose-300">₹{selectedProduct.floor_price}</span>
              </div>
            </div>

            {/* Discount Ladder */}
            {selectedProduct.discount_ladder && selectedProduct.discount_ladder.length > 0 && (
              <div className="text-[9px] text-slate-400 bg-[#0f1118] p-1.5 rounded border border-white/5 font-mono">
                <span className="text-slate-400 font-semibold">Tier Limits: </span>
                {selectedProduct.discount_ladder.map((t, idx) => (
                  <span key={idx} className="text-slate-300">
                    {t.min_qty}+: ≤{t.max_discount_pct}%{idx < selectedProduct.discount_ladder.length - 1 ? ' • ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. Order Quantity Input */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[9px] font-mono">
            <label className="font-semibold text-slate-400 uppercase tracking-wider">
              Order Quantity ({selectedProduct?.unit || 'units'})
            </label>
            <span className="text-slate-400">
              Stock: {selectedProduct?.stock_level || 0}
            </span>
          </div>
          <input
            type="number"
            min="1"
            max={selectedProduct?.stock_level || 1000}
            className="input-field font-mono text-xs py-1"
            value={quantity}
            onChange={(e) => onChangeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            disabled={isNegotiating}
          />
        </div>

        {/* 3. Collapsible Simulated Buyer Persona Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
            <span>Buyer Agent Persona</span>
            <span className="text-slate-400">4 Scenarios (Click to Expand)</span>
          </label>

          <div className="flex flex-col gap-1.5">
            {Object.entries(personas || {}).map(([key, p]) => {
              const isSelected = selectedPersona === key;
              const isExpanded = expandedPersonas[key];

              return (
                <div
                  key={key}
                  onClick={() => !isNegotiating && onSelectPersona(key)}
                  className={`p-2 rounded border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1f2433] border-white/20 shadow-xs'
                      : 'bg-[#191c26] border-white/[0.06] hover:bg-[#1f2330] hover:border-white/10'
                  } ${isNegotiating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                      {p.displayName}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                      <button
                        type="button"
                        onClick={(e) => toggleExpand(e, key)}
                        className={`p-0.5 rounded hover:bg-white/10 transition-colors ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}
                        title={isExpanded ? 'Collapse' : 'Expand full description'}
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Full Description */}
                  <div className={`mt-1 text-[10px] leading-relaxed transition-all ${
                    isSelected ? 'text-slate-200' : 'text-slate-400'
                  }`}>
                    {isExpanded ? (
                      <div className="flex flex-col gap-1 pt-0.5">
                        <p>{p.description}</p>
                        <div className="p-1.5 rounded text-[9px] font-mono bg-[#0f1118] text-slate-300 border border-white/5">
                          <p><span className="font-semibold text-slate-200">Strategy:</span> {p.opening_strategy}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="line-clamp-1">{p.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Permanently Pinned Solid Primary CTA Button */}
      <div className="p-3 border-t border-white/[0.08] bg-[#141720] shrink-0">
        <button
          onClick={onStartNegotiation}
          disabled={isNegotiating || !selectedProduct}
          className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
        >
          {isNegotiating ? (
            <>
              <div className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
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
