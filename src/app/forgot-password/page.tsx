'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/client';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep]           = useState<'email'|'otp'|'done'>('email');
  const [email, setEmail]         = useState('');
  const [otp, setOtp]             = useState('');
  const [newPw, setNewPw]         = useState('');
  const [devOtp, setDevOtp]       = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email.'); return; }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      if (res.dev_otp) setDevOtp(res.dev_otp);
      setStep('otp');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const resetPw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('OTP must be 6 digits.'); return; }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(newPw)) { setError('Password must contain at least one uppercase letter.'); return; }
    if (!/[0-9]/.test(newPw)) { setError('Password must contain at least one number.'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword({ email, otp, new_password: newPw });
      setStep('done');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Reset failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1A3A6B] to-[#0F172A] flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl p-8 w-[380px] shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-11 h-11 bg-[#1A56DB] rounded-xl flex items-center justify-center text-lg font-black text-white mx-auto mb-3">CI</div>
          <div className="text-lg font-black text-slate-800">
            {step === 'email' ? 'Forgot Password' : step === 'otp' ? 'Enter OTP' : 'Password Reset!'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {step === 'email' ? "Enter your email to receive a reset OTP" : step === 'otp' ? `OTP sent to ${email}` : 'Your password has been reset successfully'}
          </div>
        </div>

        {step === 'email' && (
          <form onSubmit={sendOtp}>
            <div className="mb-4"><label className="text-[11px] font-bold text-slate-500 block mb-1">Email Address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500" /></div>
            {error && <div className="text-xs text-red-500 mb-3 p-2 bg-red-50 rounded-lg">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#1A56DB] text-white text-sm font-bold rounded-lg hover:bg-[#1240A0] disabled:opacity-50">{loading ? 'Sending…' : 'Send OTP →'}</button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={resetPw}>
            {devOtp && <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800"><b>Dev OTP:</b> {devOtp}</div>}
            <div className="mb-3"><label className="text-[11px] font-bold text-slate-500 block mb-1">6-Digit OTP</label>
              <input type="text" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} className="w-full px-3 py-2 text-lg font-mono text-center border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 tracking-[0.4em]" placeholder="000000" /></div>
            <div className="mb-4"><label className="text-[11px] font-bold text-slate-500 block mb-1">New Password</label>
              <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="Min 8 chars, 1 uppercase, 1 number" /></div>
            {error && <div className="text-xs text-red-500 mb-3 p-2 bg-red-50 rounded-lg">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-[#1A56DB] text-white text-sm font-bold rounded-lg hover:bg-[#1240A0] disabled:opacity-50">{loading ? 'Resetting…' : 'Reset Password →'}</button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <button onClick={() => router.push('/login')} className="w-full py-2.5 bg-[#1A56DB] text-white text-sm font-bold rounded-lg hover:bg-[#1240A0]">Back to Login →</button>
          </div>
        )}

        <div className="text-center mt-4">
          <button onClick={() => router.push('/login')} className="text-xs text-slate-400 hover:text-slate-600">← Back to Login</button>
        </div>
      </div>
    </div>
  );
}
