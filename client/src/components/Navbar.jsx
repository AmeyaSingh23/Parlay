import React from 'react';
import { ShieldCheck, Sliders, LogOut, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketStatus } from '../context/SocketContext';

export default function Navbar({ onOpenFloorModal }) {
  const { user, logout } = useAuth();
  const socketConnected = useSocketStatus();

  return (
    <header className="border-b border-white/[0.08] bg-[#0d0f14] px-5 py-2.5 shrink-0">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-100 font-['Plus_Jakarta_Sans']">
                Parlay
              </span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                Track 01
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              B2B Pricing Agent & Deterministic Code Firewall
            </p>
          </div>
        </div>

        {/* Status Indicators & Live Actions */}
        <div className="flex items-center gap-2.5">
          {/* Socket Connection status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#191c26] border border-white/5 text-[10px] font-mono">
            <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="text-slate-300">
              {socketConnected ? 'WebSocket Active' : 'Connecting...'}
            </span>
          </div>

          {/* Razorpay Test Mode Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#191c26] border border-white/5 text-[10px] text-slate-300 font-mono">
            <CreditCard className="w-3 h-3 text-slate-400" />
            <span>Razorpay Sandbox</span>
          </div>

          {/* Floor Mutator Tool Button */}
          <button
            onClick={onOpenFloorModal}
            className="btn btn-secondary text-[10px] font-mono py-1 px-2.5 flex items-center gap-1 text-slate-200 border-white/10 hover:bg-white/5"
            title="Adjust live floor price in MongoDB"
          >
            <Sliders className="w-3 h-3 text-slate-300" />
            <span>Adjust Price Floor</span>
          </button>

          {/* User Profile / Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-semibold text-slate-200 leading-none">{user.name || 'Merchant Admin'}</p>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{user.email || 'merchant@parlay.ai'}</p>
              </div>
              <button
                onClick={logout}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
