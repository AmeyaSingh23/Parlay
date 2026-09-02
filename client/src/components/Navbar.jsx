import React from 'react';
import { ShieldCheck, Zap, LogOut, Radio, CreditCard, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketStatus } from '../context/SocketContext';

export default function Navbar({ onOpenFloorModal }) {
  const { user, logout } = useAuth();
  const socketConnected = useSocketStatus();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[#090b10]/80 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white font-['Plus_Jakarta_Sans']">
                Parlay
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Track 01
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Firewall-Bounded B2B Negotiation Agent
            </p>
          </div>
        </div>

        {/* Status Indicators & Live Badges */}
        <div className="flex items-center gap-4">
          {/* Socket Connection status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs">
            <Radio className={`w-3.5 h-3.5 ${socketConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
            <span className="text-[var(--text-secondary)]">
              {socketConnected ? 'Live Socket: Connected' : 'Socket Reconnecting...'}
            </span>
          </div>

          {/* Razorpay Test Mode Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 font-mono">
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
            <span>Razorpay Test Mode</span>
          </div>

          {/* Floor Mutator Demo Button */}
          <button
            onClick={onOpenFloorModal}
            className="btn btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-1.5 text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
            title="Mutate product floor price live to demo Scenario C"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulate Price Shift</span>
          </button>

          {/* User Profile / Logout */}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-[var(--border-subtle)]">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-white">{user.name || 'Merchant Admin'}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{user.email || 'merchant@parlay.ai'}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
