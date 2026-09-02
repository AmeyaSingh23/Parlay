import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in both email and password');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        await register(name || 'Merchant Admin', email, password);
        toast.success('Account created! Welcome to Parlay.');
      } else {
        await login(email, password);
        toast.success('Signed in successfully!');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('merchant@parlay.ai');
    setPassword('password123');
    setIsRegister(false);
    toast.success('Demo merchant credentials filled!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8fafc] font-sans">
      <div className="w-full max-w-sm panel-card p-6 shadow-md bg-white border border-slate-200 flex flex-col gap-4">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center mb-2 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans']">
            Parlay Merchant Portal
          </h1>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            B2B Pricing Agent & Deterministic Code Firewall
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Create Account */}
        <div className="grid grid-cols-2 p-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`py-1 rounded transition-colors ${
              !isRegister ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`py-1 rounded transition-colors ${
              isRegister ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-mono text-xs">
          {isRegister && (
            <div>
              <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                Company / Merchant Name
              </label>
              <input
                type="text"
                placeholder="e.g. Apex Industrial Supplies"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="merchant@parlay.ai"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1 mt-1 shadow-sm font-sans"
          >
            <span>{isLoading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* 1-Click Demo Credential Helper */}
        <div className="pt-2 border-t border-slate-200 text-center">
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-[10px] text-slate-500 hover:text-slate-900 font-mono transition-colors"
          >
            Quick Fill Demo Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
