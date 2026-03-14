'use client';
import { ReactNode, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { label:'Dashboard',           href:'/dashboard',                  icon:'▦', section:'main' },
  { label:'Products',            href:'/products',                   icon:'⬡', section:'main' },
  { label:'Receipts',            href:'/operations/receipts',        icon:'↓', section:'ops' },
  { label:'Delivery Orders',     href:'/operations/deliveries',      icon:'↑', section:'ops' },
  { label:'Internal Transfers',  href:'/operations/transfers',       icon:'⇄', section:'ops' },
  { label:'Adjustments',         href:'/operations/adjustments',     icon:'⚖', section:'ops' },
  { label:'Move History',        href:'/operations/history',         icon:'≡', section:'ops' },
  { label:'Warehouses',          href:'/warehouses',                 icon:'⌂', section:'settings' },
  { label:'My Profile',          href:'/profile',                    icon:'○', section:'settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2) || '?';

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-56 min-w-[224px] bg-[#0F172A] flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#1A56DB] rounded-lg flex items-center justify-center text-xs font-black text-white">CI</div>
          <div>
            <div className="text-white text-sm font-bold">CoreInventory</div>
            <div className="text-slate-600 text-[10px]">v1.0 · PostgreSQL</div>
          </div>
        </div>

        <nav className="flex-1 py-2">
          {['main','ops','settings'].map(section => {
            const items = NAV.filter(n => n.section === section);
            const labels: Record<string,string> = { main:'Main', ops:'Operations', settings:'Settings' };
            return (
              <div key={section} className="mb-1">
                <div className="px-3.5 py-1.5 text-[9.5px] font-bold text-slate-600 uppercase tracking-[0.8px]">{labels[section]}</div>
                {items.map(item => (
                  <Link key={item.href} href={item.href}
                    className={clsx('flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-lg text-[12.5px] transition-all mb-0.5',
                      pathname.startsWith(item.href) && item.href !== '/dashboard' || pathname === item.href
                        ? 'bg-[#1E3A5F] text-white font-semibold'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}>
                    <span className="text-[13px]">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-800 mb-1" onClick={() => router.push('/profile')}>
            <div className="w-7 h-7 rounded-full bg-[#1A56DB] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{initials}</div>
            <div>
              <div className="text-slate-300 text-xs font-semibold truncate max-w-[120px]">{user?.name}</div>
              <div className="text-slate-500 text-[10px] capitalize">{user?.role}</div>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-red-400 hover:bg-slate-800 text-xs font-semibold transition-all">
            ⇤ Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-bold text-slate-800">
            {NAV.find(n => pathname === n.href || (pathname.startsWith(n.href) && n.href !== '/dashboard'))?.label || 'CoreInventory'}
          </div>
          <div className="flex items-center gap-2.5">
            <select className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400">
              <option>All Warehouses</option>
            </select>
            <div className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer hover:bg-slate-50 relative text-sm">
              🔔<div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"/>
            </div>
            <div className="w-7 h-7 rounded-full bg-[#1A56DB] flex items-center justify-center text-[10px] font-bold text-white cursor-pointer" onClick={() => router.push('/profile')}>{initials}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  );
}
