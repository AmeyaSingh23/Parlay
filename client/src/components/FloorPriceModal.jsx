import React, { useState } from 'react';
import { Zap, X, ShieldAlert, ArrowRight, Check } from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

export default function FloorPriceModal({ isOpen, onClose, products, onPriceUpdated }) {
  if (!isOpen) return null;

  const [selectedSku, setSelectedSku] = useState(products[0]?.product_id || '');
  const [newFloor, setNewFloor] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [loading, setLoading] = useState(false);

  const product = products.find(p => p.product_id === selectedSku) || products[0];

  const handleApplyUpdate = async (e) => {
    e.preventDefault();
    if (!newFloor) {
      toast.error('Please enter a new floor price');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/inventory/update-price', {
        product_id: selectedSku,
        floor_price: Number(newFloor),
        target_price: newTarget ? Number(newTarget) : undefined
      });

      toast.success(`Dynamic Floor updated to ₹${newFloor}! Live state mutated.`);
      if (onPriceUpdated) onPriceUpdated(res.data.product);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update floor price');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="glass-card max-w-md w-full p-6 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm font-['Plus_Jakarta_Sans']">
            <Zap className="w-4 h-4 fill-current" />
            <span>Scenario C: Dynamic Floor Price Mutation</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)] mt-3 leading-relaxed">
          Mutate the live floor and target price in the database on-screen between two negotiation runs to demonstrate dynamic state awareness.
        </p>

        <form onSubmit={handleApplyUpdate} className="flex flex-col gap-4 mt-4">
          {/* SKU Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
              Target Product SKU
            </label>
            <select
              className="input-field"
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
            >
              {products.map(p => (
                <option key={p.product_id} value={p.product_id} className="bg-[#0e121e]">
                  {p.name} (Current Floor: ₹{p.floor_price})
                </option>
              ))}
            </select>
          </div>

          {/* Current vs New comparison */}
          {product && (
            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] grid grid-cols-2 gap-3 text-center">
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] block font-mono">Current Floor</span>
                <span className="text-sm font-bold font-mono text-rose-300">₹{product.floor_price}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] block font-mono">Current Target</span>
                <span className="text-sm font-bold font-mono text-blue-300">₹{product.target_price}</span>
              </div>
            </div>
          )}

          {/* New Floor Price Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
              New Floor Price (₹)
            </label>
            <input
              type="number"
              required
              placeholder={`e.g. ${product ? product.floor_price + 100 : 950}`}
              className="input-field font-mono"
              value={newFloor}
              onChange={(e) => setNewFloor(e.target.value)}
            />
          </div>

          {/* New Target Price Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
              New Target Price (₹, optional)
            </label>
            <input
              type="number"
              placeholder={`e.g. ${product ? product.target_price + 100 : 1100}`}
              className="input-field font-mono"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1 text-xs bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold"
            >
              {loading ? 'Updating...' : 'Mutate Live Floor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
