import React from 'react';
import { ShieldCheck, Sliders, LogOut, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketStatus } from '../context/SocketContext';

export default function Navbar({ onOpenFloorModal }) {
  const { user, logout } = useAuth();
  const socketConnected = useSocketStatus();

  return (
    <header className="border-b border-slate-200 bg-white px-5 py-2.5 shrink-0 shadow-xs">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-slate-900 font-['Plus_Jakarta_Sans']">
                Parlay
              </span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                Track 01
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              B2B Pricing Agent & Deterministic Code Firewall
            </p>
          </div>
        </div>

        {/* Status Indicators & Live Actions */}
        <div className="flex items-center gap-2.5">
          {/* Socket Connection status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-[10px] font-mono">
            <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-slate-700">
              {socketConnected ? 'WebSocket Active' : 'Connecting...'}
            </span>
          </div>

          {/* Razorpay Test Mode Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-700 font-mono">
            <CreditCard className="w-3 h-3 text-slate-500" />
            <span>Razorpay Sandbox</span>
          </div>

          {/* Floor Mutator Tool Button */}
          <button
            onClick={onOpenFloorModal}
            className="btn btn-secondary text-[10px] font-mono py-1 px-2.5 flex items-center gap-1 text-slate-800 border-slate-300 hover:bg-slate-50"
            title="Adjust live floor price in MongoDB"
          >
            <Sliders className="w-3 h-3 text-slate-700" />
            <span>Adjust Price Floor</span>
          </button>

          {/* User Profile / Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-semibold text-slate-900 leading-none">{user.name || 'Merchant Admin'}</p>
                <p className="text-[9px] text-slate-500 font-mono mt-0.5">{user.email || 'merchant@parlay.ai'}</p>
              </div>
              <button
                onClick={logout}
                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
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
