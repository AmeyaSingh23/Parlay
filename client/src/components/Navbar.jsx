import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sliders, LogOut, CreditCard, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketStatus } from '../context/SocketContext';

export default function Navbar({ onOpenFloorModal }) {
  const { user, logout } = useAuth();
  const socketConnected = useSocketStatus();

  return (
    <header className="border-b border-white/[0.06] bg-[#09090b] px-5 py-2.5 shrink-0">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-zinc-950" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-zinc-50">
              Parlay
            </span>
            <p className="text-[10px] text-zinc-500 font-mono">
              Autonomous Agentic Commerce
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2.5">
          {/* Socket Connection status */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-white/[0.06] text-[10px] font-mono">
            <div className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-zinc-400">
              {socketConnected ? 'WebSocket Active' : 'Connecting...'}
            </span>
          </div>

          {/* Razorpay Test Mode Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-white/[0.06] text-[10px] text-zinc-400 font-mono">
            <CreditCard className="w-3 h-3 text-zinc-500" />
            <span>Razorpay Sandbox</span>
          </div>

          {/* Commercial Pricing Manager Button */}
          <button
            onClick={onOpenFloorModal}
            className="btn btn-secondary text-[10px] font-mono py-1 px-2.5 flex items-center gap-1 text-zinc-300 border-white/[0.06] hover:bg-white/5"
            title="Configure List, Target, Floor Prices and Discount Ladders in MongoDB"
          >
            <Sliders className="w-3 h-3 text-zinc-400" />
            <span>Manage Pricing</span>
          </button>

          {/* Agent Catalog Link */}
          <Link
            to="/catalog"
            className="btn btn-secondary text-[10px] font-mono py-1 px-2.5 flex items-center gap-1.5 text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.06] hover:bg-emerald-500/10"
            title="Agent-Readable Catalog and A2A Gateway Hub"
          >
            <Bot className="w-3 h-3 text-emerald-400" />
            <span>Agent Catalog</span>
          </Link>

          {/* User Profile / Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-semibold text-zinc-200 leading-none">{user.name || 'Merchant Admin'}</p>
                <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{user.email || 'merchant@parlay.ai'}</p>
              </div>
              <button
                onClick={logout}
                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-white/5 transition-colors"
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
