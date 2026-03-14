'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, ApiError } from '@/lib/client';

export default function SignupPage() {
  const router = useRouter();
  const [f, setF] = useState({ name:'', email:'', password:'', confirm:'', role:'staff' });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string,string> = {};
    if (!f.name.trim() || f.name.trim().length < 2)   e.name     = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))  e.email    = 'Enter a valid email address';
    if (f.password.length < 8)                         e.password = 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(f.password))                     e.password = 'Must contain at least one uppercase letter';
    if (!/[0-9]/.test(f.password))                     e.password = 'Must contain at least one number';
    if (f.password !== f.confirm)                      e.confirm  = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.register({ name: f.name, email: f.email, password: f.password, role: f.role });
      router.push('/login?registered=1');
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else setErrors({ form: err instanceof ApiError ? err.message : 'Registration failed' });
    } finally { setLoading(false); }
  };

  const field = (key: keyof typeof f) => ({
    value: f[key],
    onChange: (e: any) => setF(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1A3A6B] to-[#0F172A] flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl p-8 w-[420px] shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-11 h-11 bg-[#1A56DB] rounded-xl flex items-center justify-center text-lg font-black text-white mx-auto mb-3">CI</div>
          <div className="text-lg font-black text-slate-800">Create Account</div>
        </div>
        <form onSubmit={submit}>
          {errors.form && <div className="text-xs text-red-500 mb-3 p-2 bg-red-50 rounded-lg">{errors.form}</div>}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">Full Name *</label>
              <input {...field('name')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="Rahul Sharma" />
              {errors.name && <span className="text-[10px] text-red-500">{errors.name}</span>}</div>
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">Role</label>
              <select {...field('role')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500">
                <option value="staff">Staff</option><option value="manager">Manager</option>
              </select></div>
          </div>
          <div className="mt-2"><label className="text-[11px] font-bold text-slate-500 block mb-1">Email Address *</label>
            <input type="email" {...field('email')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500" />
            {errors.email && <span className="text-[10px] text-red-500">{errors.email}</span>}</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">Password *</label>
              <input type="password" {...field('password')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="Min 8 chars" />
              {errors.password && <span className="text-[10px] text-red-500">{errors.password}</span>}</div>
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">Confirm *</label>
              <input type="password" {...field('confirm')} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500" placeholder="Repeat" />
              {errors.confirm && <span className="text-[10px] text-red-500">{errors.confirm}</span>}</div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full mt-5 py-2.5 bg-[#1A56DB] text-white text-sm font-bold rounded-lg hover:bg-[#1240A0] disabled:opacity-50 transition-colors">
            {loading ? 'Creating…' : 'Create Account →'}
          </button>
        </form>
        <div className="text-center mt-3 text-xs text-slate-400">
          Already have an account? <button onClick={()=>router.push('/login')} className="text-blue-600 hover:underline">Sign In</button>
        </div>
      </div>
    </div>
  );
}
