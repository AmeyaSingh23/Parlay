import React from 'react';
import { Link } from 'react-router-dom';
import { Sliders, Bot, ArrowUpRight, ShieldCheck, Box, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ProductSelector({
  products,
  selectedProduct,
  onSelectProduct,
  onOpenFloorModal
}) {
  const listPrice = selectedProduct?.list_price || 0;
  const targetPrice = selectedProduct?.target_price || 0;
  const floorPrice = selectedProduct?.floor_price || 0;
  const stockLevel = selectedProduct?.stock_level || 0;

  const targetMarginInr = targetPrice - floorPrice;
  const targetMarginPct = listPrice > 0 ? Math.round((targetMarginInr / listPrice) * 100) : 0;
  const totalValuation = listPrice * stockLevel;

  return (
    <div className="panel-card flex flex-col h-full overflow-hidden bg-[#141720]">
      {/* Pinned Header */}
      <div className="p-3 pb-2.5 border-b border-white/[0.08] shrink-0 bg-[#141720] flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Box className="w-3.5 h-3.5 text-indigo-400" />
            Commercial Policy Desk
          </h2>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Merchant inventory margins & live guardrails
          </p>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0 bg-[#141720]">
        {/* 1. Product SKU Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Active Catalog SKU
          </label>
          <select
            className="input-field cursor-pointer text-xs"
            value={selectedProduct?.product_id || ''}
            onChange={(e) => {
              const found = products.find(p => p.product_id === e.target.value);
              if (found) onSelectProduct(found);
            }}
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
          <div className="p-3 rounded-xl bg-[#191c26] border border-white/[0.08] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[180px]">
                {selectedProduct.name}
              </span>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                selectedProduct.negotiable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                {selectedProduct.negotiable ? 'Negotiable' : 'Fixed Price'}
              </span>
            </div>

            {/* Pricing Triad */}
            <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
              <div className="bg-[#0f1118] p-1.5 rounded border border-white/5">
                <span className="text-[8px] uppercase text-slate-400 block">List</span>
                <span className="text-xs font-bold text-slate-200">₹{selectedProduct.list_price}</span>
              </div>
              <div className="bg-[#0f1118] p-1.5 rounded border border-white/5">
                <span className="text-[8px] uppercase text-emerald-400 block">Target</span>
                <span className="text-xs font-bold text-emerald-300">₹{selectedProduct.target_price}</span>
              </div>
              <div className="bg-[#0f1118] p-1.5 rounded border border-rose-500/30 bg-rose-950/10">
                <span className="text-[8px] uppercase text-rose-400 block font-semibold">Live Floor</span>
                <span className="text-xs font-bold text-rose-300">₹{selectedProduct.floor_price}</span>
              </div>
            </div>

            {/* Inventory Valuation & Ready Units */}
            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-[#0f1118] border border-white/5 text-[10px] font-mono">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Ready Stock:</span>
                <span className="text-slate-200 font-bold">{stockLevel} {selectedProduct.unit || 'units'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Inventory Value:</span>
                <span className="text-slate-200 font-bold">₹{totalValuation.toLocaleString()}</span>
              </div>
            </div>

            {/* Discount Ladder Guidelines */}
            {selectedProduct.discount_ladder && selectedProduct.discount_ladder.length > 0 && (
              <div className="text-[10px] text-slate-400 bg-[#0f1118] p-2 rounded border border-white/5 font-mono space-y-1">
                <span className="text-slate-400 font-semibold block text-[9px] uppercase tracking-wider">Wholesale Volume Tiers:</span>
                <div className="space-y-0.5">
                  {selectedProduct.discount_ladder.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-300">{t.min_qty}+ units:</span>
                      <span className="text-emerald-400">up to {t.max_discount_pct}% off</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Action: Open Policy Editor */}
            {onOpenFloorModal && (
              <button
                type="button"
                onClick={onOpenFloorModal}
                className="w-full py-2 px-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer font-semibold mt-0.5"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Configure Pricing & Discount Ladder</span>
              </button>
            )}
          </div>
        )}

        {/* 2. Merchant Policy Guardrails & Firewall Health */}
        <div className="p-3 rounded-xl bg-[#161923] border border-white/[0.06] flex flex-col gap-2 font-mono text-[11px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Merchant Guardrails
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ACTIVE
            </span>
          </div>

          <div className="space-y-1.5 text-[10px] pt-0.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">Firewall Layer:</span>
              <span className="text-emerald-400 font-bold">Deterministic Code</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">HITL Approval Band:</span>
              <span className="text-amber-300 font-bold">≤ 8% above Floor</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">Settlement Engine:</span>
              <span className="text-sky-300 font-bold">Razorpay M2M Sandbox</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">Prompt Quarantine:</span>
              <span className="text-purple-300 font-bold">Adversarial Defense</span>
            </div>
          </div>
        </div>

        {/* 3. Link to External A2A Portal & Sandbox */}
        <Link
          to="/catalog"
          className="p-3 rounded-xl bg-gradient-to-r from-indigo-950/40 to-[#141722] border border-indigo-500/30 hover:border-indigo-500/60 text-indigo-300 flex items-center justify-between text-xs font-mono transition-all group shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="font-bold text-white text-[11px] leading-tight flex items-center gap-1.5">
                <span>A2A Buyer Sandbox</span>
                <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-500/30 text-indigo-200">Terminal</span>
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">Launch buyer bots & test APIs ↗</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
