import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, User, ArrowRight, Sparkles, KeyRound } from 'lucide-react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const endpoint = isRegister ? '/users/register' : '/users/login';
    const payload = isRegister ? { name, email, password } : { email, password };

    try {
      const res = await axios.post(endpoint, payload);
      login(res.data);
      toast.success(isRegister ? `Account created! Welcome, ${res.data.name}` : `Welcome back, ${res.data.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || (isRegister ? 'Registration failed' : 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setEmail('merchant@parlay.ai');
    setPassword('password123');
    setIsRegister(false);
    toast('Demo credentials populated', { icon: '🔑', duration: 2500 });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#090b10]">
      <div className="glass-card max-w-md w-full p-8 relative overflow-hidden border-blue-500/20">
        {/* Glow Effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="text-center mb-6 relative">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(59,130,246,0.4)] mb-3">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-['Plus_Jakarta_Sans']">
            Parlay
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            B2B Autonomous Pricing Agent & Deterministic Firewall
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] font-mono text-blue-300">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span>Track 01: Agentic Commerce</span>
          </div>
        </div>

        {/* Tab Toggle: Login vs Register */}
        <div className="flex rounded-lg bg-[#0e121e] p-1 mb-5 border border-white/5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              !isRegister ? 'bg-blue-600 text-white shadow' : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-1.5 rounded-md transition-all ${
              isRegister ? 'bg-blue-600 text-white shadow' : 'text-[var(--text-muted)] hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 relative">
          {isRegister && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  className="input-field pl-9 text-xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="merchant@parlay.ai"
                className="input-field pl-9 text-xs"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                className="input-field pl-9 text-xs"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Quick Demo Fill Helper */}
          <div className="flex items-center justify-between text-[11px] pt-1">
            <button
              type="button"
              onClick={handleQuickDemoFill}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono transition-colors"
            >
              <KeyRound className="w-3 h-3" />
              <span>Fill Demo Credentials</span>
            </button>
            <span className="text-[var(--text-muted)] font-mono text-[10px]">
              merchant@parlay.ai
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-2.5 mt-2 text-xs font-bold flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Processing...' : isRegister ? 'Create Merchant Account' : 'Sign In to Arena'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
