'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { stockApi, ApiError } from '@/lib/client';
import { AppShell } from '@/lib/shell';
import { AuthProvider } from '@/lib/auth-context';
import { Badge, Btn, ToastContainer, Skeleton } from '@/lib/ui';
import { useToast } from '@/lib/toast';

function HistoryContent() {
  const { toasts, toast, removeToast } = useToast();
  const [search, setSearch]     = useState('');
  const [typeFilter, setType]   = useState('');
  const [fromDate, setFrom]     = useState('');
  const [toDate, setTo]         = useState('');
  const [page, setPage]         = useState(1);

  const { data, isLoading } = useSWR(
    ['stock-moves', search, typeFilter, fromDate, toDate, page],
    () => stockApi.moves({ search, type: typeFilter, from_date: fromDate, to_date: toDate, page, limit: 50 }),
    { keepPreviousData: true }
  );

  const moves = data?.moves || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const doExport = () => {
    stockApi.export({ search, type: typeFilter, from_date: fromDate, to_date: toDate });
    toast('CSV download started!');
  };

  return (
    <>
      <ToastContainer toasts={toasts} remove={removeToast} />
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus-within:border-blue-400">
            <span className="text-slate-400 text-xs">🔍</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search ref or product…" className="text-xs outline-none bg-transparent w-40" />
          </div>
          <select value={typeFilter} onChange={e => { setType(e.target.value); setPage(1); }} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
            <option value="">All Types</option>
            <option value="receipt">Receipts</option><option value="delivery">Deliveries</option>
            <option value="transfer">Transfers</option><option value="adjustment">Adjustments</option>
          </select>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-semibold">FROM</span>
            <input type="date" value={fromDate} onChange={e => { setFrom(e.target.value); setPage(1); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-semibold">TO</span>
            <input type="date" value={toDate} onChange={e => { setTo(e.target.value); setPage(1); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
          </div>
        </div>
        <Btn variant="outline" onClick={doExport}>⬇ Export CSV</Btn>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            {['Date & Time','Reference','Type','Product','SKU','From','To','Qty','By'].map(h => (
              <th key={h} className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px] whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading ? Array.from({length:8}).map((_,i) => (
              <tr key={i} className="border-b border-slate-100">{Array.from({length:9}).map((_,j) => <td key={j} className="px-3 py-2"><Skeleton className="h-3 w-full" /></td>)}</tr>
            )) : moves.map((m: any) => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                <td className="px-3 py-2 text-slate-400 text-[10px] whitespace-nowrap">{String(m.moved_at).slice(0,16)}</td>
                <td className="px-3 py-2 text-blue-600 font-bold">{m.reference || '—'}</td>
                <td className="px-3 py-2">{m.op_type ? <Badge value={m.op_type} /> : '—'}</td>
                <td className="px-3 py-2 font-semibold">{m.product_name}</td>
                <td className="px-3 py-2"><span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full">{m.sku}</span></td>
                <td className="px-3 py-2 text-slate-400 text-[11px]">{m.from_location}</td>
                <td className="px-3 py-2 text-slate-400 text-[11px]">{m.to_location}</td>
                <td className="px-3 py-2"><span className="font-bold text-emerald-700">+{Number(m.qty)}</span> <span className="text-slate-400">{m.uom}</span></td>
                <td className="px-3 py-2 text-slate-400">{m.moved_by_name}</td>
              </tr>
            ))}
            {!isLoading && moves.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-400">
                <div className="text-3xl mb-2">📋</div>
                <div className="font-semibold text-slate-600 mb-1">No stock moves yet</div>
                <div className="text-xs">Validate an operation to see entries here</div>
              </td></tr>
            )}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-slate-200 flex justify-between items-center bg-slate-50">
          <span className="text-[11px] text-slate-400">Showing {moves.length} of {total} total moves</span>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <Btn size="xs" disabled={page <= 1} onClick={() => setPage(p => p-1)}>← Prev</Btn>
              {Array.from({length: Math.min(totalPages, 7)}).map((_,i) => (
                <Btn key={i} size="xs" variant={page === i+1 ? 'primary' : 'outline'} onClick={() => setPage(i+1)}>{i+1}</Btn>
              ))}
              <Btn size="xs" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next →</Btn>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function HistoryPage() {
  return <AuthProvider><AppShell><HistoryContent /></AppShell></AuthProvider>;
}
