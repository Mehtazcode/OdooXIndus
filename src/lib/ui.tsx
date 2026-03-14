'use client';
import { ReactNode, useState } from 'react';
import clsx from 'clsx';

// ─── Badge ───────────────────────────────────────────────────
const statusColors: Record<string,string> = {
  draft:      'bg-slate-100 text-slate-600',
  waiting:    'bg-amber-50 text-amber-700',
  ready:      'bg-blue-50 text-blue-700',
  done:       'bg-emerald-50 text-emerald-700',
  canceled:   'bg-red-50 text-red-700',
  receipt:    'bg-violet-100 text-violet-700',
  delivery:   'bg-yellow-100 text-yellow-700',
  transfer:   'bg-sky-100 text-sky-700',
  adjustment: 'bg-pink-100 text-pink-700',
  ok:         'bg-emerald-50 text-emerald-700',
  low:        'bg-amber-50 text-amber-700',
  out:        'bg-red-50 text-red-700',
  manager:    'bg-violet-100 text-violet-700',
  staff:      'bg-slate-100 text-slate-600',
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap', statusColors[value] || 'bg-gray-100 text-gray-600')}>
      {label || value}
    </span>
  );
}

// ─── Button ──────────────────────────────────────────────────
type BtnVariant = 'primary'|'success'|'danger'|'outline'|'ghost';
const btnStyles: Record<BtnVariant,string> = {
  primary: 'bg-[#1A56DB] text-white border-[#1A56DB] hover:bg-[#1240A0]',
  success: 'bg-[#057A55] text-white border-[#057A55] hover:bg-[#046040]',
  danger:  'bg-[#E02424] text-white border-[#E02424] hover:bg-red-700',
  outline: 'bg-white text-[#1E293B] border-[#E2E8F0] hover:bg-slate-50',
  ghost:   'bg-transparent text-[#64748B] border-transparent hover:bg-slate-100',
};

export function Btn({
  children, variant='outline', size='md', onClick, disabled, className, type='button'
}: {
  children: ReactNode; variant?: BtnVariant; size?: 'sm'|'md'|'xs';
  onClick?: () => void; disabled?: boolean; className?: string; type?: 'button'|'submit';
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold border rounded-lg transition-all active:scale-[0.97] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
        btnStyles[variant],
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        className
      )}
    >{children}</button>
  );
}

// ─── Input ───────────────────────────────────────────────────
export function Input({ label, error, ...props }: any) {
  return (
    <div className="flex flex-col gap-1 mb-2.5">
      {label && <label className="text-[11px] font-bold text-slate-500">{label}</label>}
      <input className={clsx('px-2.5 py-1.5 text-xs border rounded-lg bg-white text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100', error ? 'border-red-400' : 'border-slate-200')} {...props} />
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

export function Select({ label, error, children, ...props }: any) {
  return (
    <div className="flex flex-col gap-1 mb-2.5">
      {label && <label className="text-[11px] font-bold text-slate-500">{label}</label>}
      <select className={clsx('px-2.5 py-1.5 text-xs border rounded-lg bg-white text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100', error ? 'border-red-400' : 'border-slate-200')} {...props}>{children}</select>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

export function Textarea({ label, error, ...props }: any) {
  return (
    <div className="flex flex-col gap-1 mb-2.5">
      {label && <label className="text-[11px] font-bold text-slate-500">{label}</label>}
      <textarea className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y" rows={2} {...props} />
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('bg-white border border-slate-200 rounded-xl p-4', className)}>{children}</div>;
}

// ─── Modal ───────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size='md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm'|'md'|'lg';
}) {
  if (!open) return null;
  const w = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl' }[size];
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={clsx('bg-white rounded-2xl shadow-2xl w-full', w)} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <span className="text-sm font-bold text-slate-800">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Drawer ──────────────────────────────────────────────────
export function Drawer({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/35 z-40 flex justify-end" onClick={onClose}>
      <div className="w-[400px] h-full bg-white flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <span className="text-sm font-bold text-slate-800">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────
export function Confirm({ open, title, message, onConfirm, onCancel, danger=true }: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl">
        <div className="text-sm font-bold text-slate-800 mb-2">{title}</div>
        <div className="text-xs text-slate-500 mb-5 leading-relaxed">{message}</div>
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
          <Btn variant={danger ? 'danger' : 'success'} onClick={onConfirm}>{danger ? 'Delete' : 'Confirm'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────
const toastColors: Record<string,string> = {
  success: 'bg-emerald-700 text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-blue-600 text-white',
  warn:    'bg-amber-600 text-white',
};

export function ToastContainer({ toasts, remove }: { toasts: any[]; remove: (id:string)=>void }) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} onClick={() => remove(t.id)}
          className={clsx('flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl min-w-[240px] pointer-events-auto cursor-pointer animate-[fadeIn_.2s_ease]', toastColors[t.type] || toastColors.success)}>
          <span>{t.type==='success'?'✓':t.type==='error'?'✕':t.type==='warn'?'⚠':'ℹ'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-slate-200 rounded', className)} />;
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({ icon, title, sub, action }: {
  icon: string; title: string; sub: string; action?: ReactNode;
}) {
  return (
    <div className="text-center py-10">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="text-sm font-bold text-slate-700 mb-1">{title}</div>
      <div className="text-xs text-slate-400 mb-4">{sub}</div>
      {action}
    </div>
  );
}

// ─── Stat Box ────────────────────────────────────────────────
export function StatBox({ value, label, color }: { value: any; label: string; color?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
      <div className={clsx('text-xl font-black', color || 'text-slate-800')}>{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────
export function KpiCard({ label, value, sub, color, onClick }: {
  label: string; value: any; sub: string; color?: string; onClick?: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden relative" onClick={onClick}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={clsx('text-2xl font-black', color || 'text-slate-800')}>{value}</div>
      <div className="text-[10px] text-slate-400 mt-1">{sub}</div>
    </div>
  );
}

// ─── Progress Steps ──────────────────────────────────────────
export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center mb-4">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center flex-1">
          <div className="flex items-center gap-1.5">
            <div className={clsx('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0',
              i < current ? 'bg-emerald-600 text-white' : i === current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400')}>
              {i < current ? '✓' : i+1}
            </div>
            <span className={clsx('text-[11px] font-semibold', i < current ? 'text-emerald-600' : i === current ? 'text-blue-600' : 'text-slate-400')}>{s}</span>
          </div>
          {i < steps.length-1 && <div className={clsx('flex-1 h-0.5 mx-2', i < current ? 'bg-emerald-500' : 'bg-slate-200')} />}
        </div>
      ))}
    </div>
  );
}
