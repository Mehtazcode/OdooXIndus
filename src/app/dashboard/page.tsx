'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { dashApi, opsApi, ApiError } from '@/lib/client';
import { AppShell } from '@/lib/shell';
import { AuthProvider } from '@/lib/auth-context';
import { KpiCard, Badge, Btn, ToastContainer } from '@/lib/ui';
import { useToast } from '@/lib/toast';

const fetcher = (key: string) => dashApi.kpis();

function DashboardContent() {
  const router = useRouter();
  const { toasts, toast, removeToast } = useToast();
  const [typeFilter, setTypeFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, mutate } = useSWR('dashboard', fetcher, { refreshInterval: 5000 });
  const kpis = data?.kpis;
  const ops  = data?.recent_operations || [];

  const filteredOps = ops.filter((o: any) =>
    (!typeFilter   || o.type   === typeFilter) &&
    (!statusFilter || o.status === statusFilter)
  );

  const doValidate = async (id: string, ref: string) => {
    try {
      await opsApi.validate(id);
      toast(`${ref} validated! Stock updated.`);
      mutate();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Validation failed', 'error');
    }
  };

  const typePage: Record<string,string> = {
    receipt:'receipts', delivery:'deliveries', transfer:'transfers', adjustment:'adjustments'
  };

  return (
    <>
      <ToastContainer toasts={toasts} remove={removeToast} />

      {(kpis?.low_stock_count > 0 || kpis?.out_of_stock_count > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-amber-800">
            ⚠️ {kpis.low_stock_count} products are low on stock · {kpis.out_of_stock_count} out of stock
          </span>
          <button onClick={() => router.push('/products?status=low')} className="text-xs text-blue-600 font-bold hover:underline">View Products →</button>
        </div>
      )}

      <div className="grid grid-cols-5 gap-2.5 mb-4">
        <KpiCard label="Total In Stock"    value={isLoading ? '…' : kpis?.total_in_stock     ?? 0} sub="Active products"  color="text-emerald-700" onClick={() => router.push('/products')} />
        <KpiCard label="Low Stock"         value={isLoading ? '…' : kpis?.low_stock_count    ?? 0} sub="Need reorder"     color="text-amber-700"   onClick={() => router.push('/products?status=low')} />
        <KpiCard label="Out of Stock"      value={isLoading ? '…' : kpis?.out_of_stock_count ?? 0} sub="Urgent action"    color="text-red-600"     onClick={() => router.push('/products?status=out')} />
        <KpiCard label="Pending Receipts"  value={isLoading ? '…' : kpis?.pending_receipts   ?? 0} sub="Awaiting arrival" color="text-blue-700"    onClick={() => router.push('/operations/receipts')} />
        <KpiCard label="Pending Deliveries" value={isLoading ? '…' : kpis?.pending_deliveries ?? 0} sub="Ready to ship"  color="text-blue-700"    onClick={() => router.push('/operations/deliveries')} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">Recent Activity</span>
          <div className="flex gap-2">
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
              <option value="">All Types</option>
              <option value="receipt">Receipts</option><option value="delivery">Deliveries</option>
              <option value="transfer">Transfers</option><option value="adjustment">Adjustments</option>
            </select>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none">
              <option value="">All Status</option>
              <option value="draft">Draft</option><option value="waiting">Waiting</option>
              <option value="ready">Ready</option><option value="done">Done</option><option value="canceled">Canceled</option>
            </select>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Reference</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Type</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Status</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Partner</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Date</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">By</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Action</th>
          </tr></thead>
          <tbody>
            {filteredOps.map((o: any) => (
              <tr key={o.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                <td className="px-3 py-2">
                  <button onClick={() => router.push(`/operations/${typePage[o.type]}`)} className="text-blue-600 font-bold hover:underline">{o.reference}</button>
                </td>
                <td className="px-3 py-2"><Badge value={o.type} /></td>
                <td className="px-3 py-2"><Badge value={o.status} /></td>
                <td className="px-3 py-2 text-slate-500">{o.partner_name || (o.type==='transfer' ? `${o.source_location_name} → ${o.dest_location_name}` : '—')}</td>
                <td className="px-3 py-2 text-slate-400">{o.scheduled_date}</td>
                <td className="px-3 py-2 text-slate-400">{o.created_by_name}</td>
                <td className="px-3 py-2">
                  {o.status === 'done' || o.status === 'canceled'
                    ? <Btn size="xs" onClick={() => router.push(`/operations/${typePage[o.type]}`)}>View</Btn>
                    : o.status === 'draft'
                    ? <Btn size="xs" onClick={() => router.push(`/operations/${typePage[o.type]}`)}>Edit</Btn>
                    : <Btn size="xs" variant="success" onClick={() => doValidate(o.id, o.reference)}>✓ Validate</Btn>
                  }
                </td>
              </tr>
            ))}
            {filteredOps.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No operations found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <AppShell><DashboardContent /></AppShell>
    </AuthProvider>
  );
}
