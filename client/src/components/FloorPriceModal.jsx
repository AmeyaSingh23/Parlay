import React, { useState } from 'react';
import { X, Sliders, ArrowRight, ShieldAlert } from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function FloorPriceModal({ isOpen, onClose, products, onPriceUpdated }) {
  if (!isOpen) return null;

  const [selectedSku, setSelectedSku] = useState(products[0]?.product_id || '');
  const [newFloorPrice, setNewFloorPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentProduct = products.find(p => p.product_id === selectedSku);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newFloorPrice || isNaN(Number(newFloorPrice))) {
      toast.error('Please enter a valid numeric price');
      return;
    }

    setIsLoading(true);
    try {
      const res = await axios.post('/inventory/update-price', {
        product_id: selectedSku,
        floor_price: Number(newFloorPrice)
      });

      toast.success(`Live floor price updated to ₹${newFloorPrice}!`);
      if (onPriceUpdated) {
        onPriceUpdated(res.data.product);
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update floor price');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 shadow-xl flex flex-col gap-4 text-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Sliders className="w-3.5 h-3.5 text-slate-800" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Adjust Product Price Floor
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                Live inventory floor override (Scenario C)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explain Box */}
        <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            Mutating the floor price updates MongoDB live. The <span className="text-slate-900 font-bold font-mono">Deterministic Firewall</span> immediately enforces the new floor boundary on the very next turn without prompting or retraining the LLM.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-mono text-xs">
          <div>
            <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
              Select Product SKU
            </label>
            <select
              className="input-field cursor-pointer"
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
            >
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} (Current Floor: ₹{p.floor_price})
                </option>
              ))}
            </select>
          </div>

          {currentProduct && (
            <div className="grid grid-cols-2 gap-2 p-2 rounded bg-slate-50 border border-slate-200 text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-semibold">List Price</span>
                <span className="font-bold text-slate-900">₹{currentProduct.list_price}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase font-semibold">Current Floor</span>
                <span className="font-bold text-rose-700">₹{currentProduct.floor_price}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
              New Floor Price (₹ INR)
            </label>
            <input
              type="number"
              placeholder={`e.g. ${currentProduct ? currentProduct.floor_price + 50 : 800}`}
              className="input-field py-1.5"
              value={newFloorPrice}
              onChange={(e) => setNewFloorPrice(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1 py-2 text-xs text-slate-700 font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 font-mono"
            >
              <span>{isLoading ? 'Updating...' : 'Save New Floor'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
