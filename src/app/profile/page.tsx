'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authApi, ApiError } from '@/lib/client';
import { AppShell } from '@/lib/shell';
import { AuthProvider } from '@/lib/auth-context';
import { Btn, ToastContainer, Input } from '@/lib/ui';
import { useToast } from '@/lib/toast';
import clsx from 'clsx';

function ProfileContent() {
  const { user, refresh } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [tab, setTab]   = useState('profile');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
  const [pwErrors, setPwErrors]     = useState<Record<string,string>>({});

  useEffect(() => { if (user) setForm({ name: user.name, email: user.email }); }, [user]);

  const saveProfile = async () => {
    const e: Record<string,string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    setFormErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await authApi.updateMe({ name: form.name.trim(), email: form.email.trim().toLowerCase() });
      await refresh();
      toast('Profile updated successfully!');
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFormErrors(err.fields);
      else toast(err instanceof ApiError ? err.message : 'Update failed', 'error');
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    const e: Record<string,string> = {};
    if (!pwForm.current_password) e.current_password = 'Current password is required';
    if (pwForm.new_password.length < 8) e.new_password = 'Must be at least 8 characters';
    if (!/[A-Z]/.test(pwForm.new_password)) e.new_password = 'Must contain at least one uppercase letter';
    if (!/[0-9]/.test(pwForm.new_password)) e.new_password = 'Must contain at least one number';
    if (pwForm.new_password !== pwForm.confirm) e.confirm = 'Passwords do not match';
    setPwErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await authApi.updateMe({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwForm({ current_password: '', new_password: '', confirm: '' });
      toast('Password changed successfully!');
    } catch (err) {
      if (err instanceof ApiError && err.fields) setPwErrors(err.fields);
      else toast(err instanceof ApiError ? err.message : 'Change failed', 'error');
    } finally { setSaving(false); }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2) || '?';

  return (
    <>
      <ToastContainer toasts={toasts} remove={removeToast} />
      <div className="flex border-b border-slate-200 mb-5">
        {['profile','password'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 text-xs font-semibold border-b-2 -mb-px capitalize transition-colors', tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700')}>
            {t === 'profile' ? 'My Profile' : 'Change Password'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-lg">
          <div className="flex items-center gap-3.5 pb-4 mb-4 border-b border-slate-200">
            <div className="w-12 h-12 rounded-full bg-[#1A56DB] flex items-center justify-center text-base font-black text-white">{initials}</div>
            <div>
              <div className="text-sm font-black text-slate-800">{user?.name}</div>
              <div className="text-xs text-slate-400 capitalize">{user?.role === 'manager' ? 'Inventory Manager' : 'Warehouse Staff'}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Full Name *" value={form.name} onChange={(e: any) => setForm(f => ({...f, name: e.target.value}))} error={formErrors.name} />
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">Role</label>
              <input disabled value={user?.role === 'manager' ? 'Manager' : 'Staff'} className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-400" />
            </div>
          </div>
          <Input label="Email Address *" type="email" value={form.email} onChange={(e: any) => setForm(f => ({...f, email: e.target.value}))} error={formErrors.email} />
          <Btn variant="primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-lg">
          <Input label="Current Password *" type="password" value={pwForm.current_password} onChange={(e: any) => setPwForm(f => ({...f, current_password: e.target.value}))} error={pwErrors.current_password} placeholder="Enter current password" />
          <Input label="New Password *" type="password" value={pwForm.new_password} onChange={(e: any) => setPwForm(f => ({...f, new_password: e.target.value}))} error={pwErrors.new_password} placeholder="Min 8 chars, 1 uppercase, 1 number" />
          <Input label="Confirm New Password *" type="password" value={pwForm.confirm} onChange={(e: any) => setPwForm(f => ({...f, confirm: e.target.value}))} error={pwErrors.confirm} placeholder="Repeat new password" />
          <Btn variant="primary" onClick={changePassword} disabled={saving}>{saving ? 'Updating…' : 'Update Password'}</Btn>
        </div>
      )}
    </>
  );
}

export default function ProfilePage() {
  return <AuthProvider><AppShell><ProfileContent /></AppShell></AuthProvider>;
}
