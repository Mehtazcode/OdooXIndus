'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]     = useState('admin@coreinventory.local');
  const [pass,  setPass]      = useState('Admin@123');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !pass) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      await authApi.login({ email, password: pass });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1A3A6B] to-[#0F172A] flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl p-9 w-[380px] shadow-2xl">
        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-[#1A56DB] rounded-xl flex items-center justify-center text-xl font-black text-white mx-auto mb-3">CI</div>
          <div className="text-xl font-black text-slate-800">CoreInventory</div>
          <div className="text-xs text-slate-400 mt-1">Sign in to your account</div>
        </div>
        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="mb-2">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="text-right mb-5">
            <button type="button" onClick={() => router.push('/forgot-password')}
              className="text-[11px] text-blue-600 hover:underline">Forgot Password?</button>
          </div>
          {error && <div className="text-xs text-red-500 mb-3 p-2 bg-red-50 rounded-lg">{error}</div>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#1A56DB] text-white text-sm font-bold rounded-lg hover:bg-[#1240A0] disabled:opacity-50 transition-colors">
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
        <div className="text-center mt-4 text-xs text-slate-400">
          Don't have an account?{' '}
          <button onClick={() => router.push('/signup')} className="text-blue-600 hover:underline">Sign Up</button>
        </div>
        <div className="mt-5 p-3 bg-slate-50 rounded-lg text-[10.5px] text-slate-500">
          <b>Demo:</b> admin@coreinventory.local / Admin@123
        </div>
      </div>
    </div>
  );
}