import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#09090b] text-zinc-100">
      <div className="w-full max-w-sm p-6 shadow-2xl bg-zinc-900 border border-white/[0.06] rounded-xl flex flex-col gap-4">
        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center mb-2">
            <ShieldCheck className="w-5 h-5 text-zinc-950" />
          </div>
          <h1 className="text-base font-bold text-zinc-50 tracking-tight">
            Parlay Merchant Portal
          </h1>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
            Autonomous Agentic Commerce
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-0.5 rounded-lg bg-zinc-950 border border-white/[0.06] text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setIsRegister(false)}
            className={`py-1.5 rounded-md transition-colors ${
              !isRegister ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(true)}
            className={`py-1.5 rounded-md transition-colors ${
              isRegister ? 'bg-emerald-500 text-zinc-950 font-bold' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 font-mono text-xs">
          {isRegister && (
            <div>
              <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
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
            <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
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
            <label className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                className="input-field pr-8"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1 mt-1 cursor-pointer"
          >
            <span>{isLoading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Demo Credential Helper */}
        <div className="pt-2 border-t border-white/[0.06] text-center">
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-[10px] text-zinc-500 hover:text-emerald-400 font-mono transition-colors cursor-pointer"
          >
            Quick Fill Demo Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
