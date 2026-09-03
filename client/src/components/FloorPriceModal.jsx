import React, { useState, useEffect } from 'react';
import { X, Sliders, ArrowRight, ShieldAlert, Check, Layers } from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function FloorPriceModal({ isOpen, onClose, products, onPriceUpdated }) {
  if (!isOpen) return null;

  const [selectedSku, setSelectedSku] = useState(products[0]?.product_id || '');
  const [listPrice, setListPrice] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [floorPrice, setFloorPrice] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(true);
  const [discountLadder, setDiscountLadder] = useState([
    { min_qty: 20, max_discount_pct: 10 },
    { min_qty: 50, max_discount_pct: 20 },
    { min_qty: 100, max_discount_pct: 29 }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const currentProduct = products.find(p => p.product_id === selectedSku);

  // Sync state whenever selectedSku or currentProduct changes
  useEffect(() => {
    if (currentProduct) {
      setListPrice(currentProduct.list_price || '');
      setTargetPrice(currentProduct.target_price || '');
      setFloorPrice(currentProduct.floor_price || '');
      setIsNegotiable(currentProduct.negotiable !== false);
      if (currentProduct.discount_ladder?.length > 0) {
        setDiscountLadder(currentProduct.discount_ladder.map(d => ({
          min_qty: d.min_qty,
          max_discount_pct: d.max_discount_pct || d.discount_pct || 0
        })));
      }
    }
  }, [selectedSku, currentProduct]);

  const handleTierChange = (index, field, value) => {
    const updated = [...discountLadder];
    updated[index] = { ...updated[index], [field]: Number(value) };
    setDiscountLadder(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!floorPrice || isNaN(Number(floorPrice)) || Number(floorPrice) <= 0) {
      toast.error('Please enter a valid numeric floor price');
      return;
    }
    if (targetPrice && Number(targetPrice) < Number(floorPrice)) {
      toast.error('Target Price must be greater than or equal to Floor Price');
      return;
    }
    if (listPrice && Number(listPrice) < Number(targetPrice)) {
      toast.error('List Price must be greater than or equal to Target Price');
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post('/inventory/update-price', {
        product_id: selectedSku,
        floor_price: Number(floorPrice),
        target_price: Number(targetPrice),
        list_price: Number(listPrice),
        negotiable: isNegotiable,
        discount_ladder: discountLadder
      });

      toast.success(`Commercial pricing updated for ${currentProduct?.name || selectedSku}!`);
      if (onPriceUpdated) {
        onPriceUpdated(res.data.product);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update pricing');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 font-sans">
      <div className="bg-[#141720] border border-white/10 rounded-xl max-w-lg w-full p-5 shadow-2xl flex flex-col gap-4 text-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Commercial Pricing & Policy Manager
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Live inventory rates, margins & firewall boundaries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explain Box */}
        <div className="p-2.5 rounded bg-[#191c26] border border-white/5 text-[11px] text-slate-300 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            Modifying pricing updates MongoDB immediately. The <span className="text-white font-bold font-mono">Deterministic Firewall</span> dynamically enforces the new floor boundary on the very next counter-bid.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-mono text-xs">
          {/* SKU Selector */}
          <div>
            <label className="text-[9px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
              Select Product SKU
            </label>
            <select
              className="input-field cursor-pointer text-xs"
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
            >
              {products.map(p => (
                <option key={p.product_id} value={p.product_id} className="bg-[#0f1118] text-slate-200">
                  {p.name} ({p.product_id})
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Triad: List, Target, Floor */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label className="text-[9px] text-slate-400 block uppercase font-semibold mb-1">
                List Price (₹)
              </label>
              <input
                type="number"
                className="input-field py-1 text-xs"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-[9px] text-emerald-400 block uppercase font-semibold mb-1">
                Target Margin (₹)
              </label>
              <input
                type="number"
                className="input-field py-1 text-xs text-emerald-300"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-[9px] text-rose-400 block uppercase font-semibold mb-1">
                Live Floor (₹)
              </label>
              <input
                type="number"
                className="input-field py-1 text-xs text-rose-300 border-rose-500/40"
                value={floorPrice}
                onChange={(e) => setFloorPrice(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Negotiable Toggle */}
          <div className="flex items-center justify-between p-2 rounded bg-[#0f1118] border border-white/5 mt-1">
            <div>
              <span className="text-[10px] text-white font-bold block">Allow Autonomous Bargaining</span>
              <span className="text-[9px] text-slate-400">If disabled, item is sold strictly at List Price ₹{listPrice}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsNegotiable(!isNegotiable)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                isNegotiable ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700/40 text-slate-400 border border-white/10'
              }`}
            >
              {isNegotiable ? 'Negotiable (ON)' : 'Fixed Price (OFF)'}
            </button>
          </div>

          {/* Discount Ladder Editor */}
          <div className="mt-1">
            <div className="flex items-center gap-1 mb-1.5">
              <Layers className="w-3 h-3 text-indigo-400" />
              <label className="text-[9px] font-semibold text-slate-300 uppercase tracking-wider">
                Volume Discount Ladder Guidelines
              </label>
            </div>
            <div className="space-y-1.5 p-2 rounded bg-[#0f1118] border border-white/5">
              {discountLadder.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-500 text-[10px] w-12">Tier {idx + 1}:</span>
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number"
                      className="input-field py-0.5 text-center text-xs w-16"
                      value={tier.min_qty}
                      onChange={(e) => handleTierChange(idx, 'min_qty', e.target.value)}
                    />
                    <span className="text-slate-400 text-[10px]">+ units →</span>
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="number"
                      className="input-field py-0.5 text-center text-xs w-16 text-emerald-400"
                      value={tier.max_discount_pct}
                      onChange={(e) => handleTierChange(idx, 'max_discount_pct', e.target.value)}
                    />
                    <span className="text-slate-400 text-[10px]">% max off</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    (~₹{Math.round(Number(listPrice || 0) * (1 - (tier.max_discount_pct / 100)))})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1 py-2 text-xs text-slate-200 font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 font-mono"
            >
              <span>{isLoading ? 'Saving...' : 'Save Commercial Policy'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
