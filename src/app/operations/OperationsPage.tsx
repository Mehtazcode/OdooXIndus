'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { opsApi, productsApi, warehousesApi, ApiError } from '@/lib/client';
import { AppShell } from '@/lib/shell';
import { AuthProvider } from '@/lib/auth-context';
import { Badge, Btn, Confirm, ToastContainer, EmptyState, Skeleton, ProgressSteps, Input, Select, Textarea } from '@/lib/ui';
import { useToast } from '@/lib/toast';
import clsx from 'clsx';

interface Props { opType: 'receipt' | 'delivery' | 'transfer' | 'adjustment'; }

const TYPE_CONFIG = {
  receipt:    { label:'Receipt',           icon:'📥', partner:'Supplier',  hasSource:false, hasDest:true  },
  delivery:   { label:'Delivery Order',    icon:'🚚', partner:'Customer',  hasSource:true,  hasDest:false },
  transfer:   { label:'Internal Transfer', icon:'🔁', partner:null,        hasSource:true,  hasDest:true  },
  adjustment: { label:'Adjustment',        icon:'⚖️', partner:null,        hasSource:false, hasDest:true  },
};

function emptyLine() { return { product_id:'', demand_qty:'', done_qty:'0', adj_reason:'physical_count' }; }
function emptyForm(type: string, locs: any[]) {
  const srcId = locs.find((l: any) => l.type === 'storage')?.id || '';
  const dstId = locs.find((l: any) => l.type === 'input' || l.type === 'storage')?.id || '';
  return {
    partner_name: '', scheduled_date: new Date().toISOString().slice(0,10),
    notes: '', source_location_id: srcId, dest_location_id: dstId,
    lines: [emptyLine()],
  };
}

function OperationsContent({ opType }: Props) {
  const cfg = TYPE_CONFIG[opType];
  const { toasts, toast, removeToast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [formOpen, setFormOpen]         = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [form, setForm]                 = useState<any>({});
  const [formErrors, setFormErrors]     = useState<Record<string,string>>({});
  const [saving, setSaving]             = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const { data: opsData, isLoading, mutate } = useSWR(
    ['operations', opType, statusFilter, search],
    () => opsApi.list({ type: opType, status: statusFilter, search }), { keepPreviousData: true });
  const { data: prodsData }  = useSWR('products-all', () => productsApi.list({ limit: 200 }));
  const { data: whData }     = useSWR('warehouses', () => warehousesApi.list());

  const ops      = opsData?.operations || [];
  const products = prodsData?.products || [];
  const allLocs  = (whData?.warehouses || []).flatMap((w: any) => (w.locations || []).map((l: any) => ({ ...l, warehouseName: w.name })));
  const realLocs = allLocs.filter((l: any) => l.type !== 'virtual');
  const storLocs = allLocs.filter((l: any) => l.type === 'storage' || l.type === 'input');

  const { data: editData } = useSWR(editId ? ['op-detail', editId] : null, () => opsApi.get(editId!));

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm(opType, realLocs));
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = async (id: string) => {
    setEditId(id);
    setFormOpen(true);
    setFormErrors({});
  };

  const currentOp = editId ? editData?.operation : null;
  const currentLines = editId ? (editData?.lines || []) : form.lines || [];
  const isReadOnly = currentOp && ['done','canceled'].includes(currentOp.status);

  const setLine = (i: number, key: string, val: string) => {
    setForm((f: any) => ({ ...f, lines: f.lines.map((l: any, idx: number) => idx === i ? { ...l, [key]: val } : l) }));
    // Auto-fill demand_qty for adjustments from stock
    if (key === 'product_id' && opType === 'adjustment' && val) {
      const prod = products.find((p: any) => p.id === val);
      setForm((f: any) => ({ ...f, lines: f.lines.map((l: any, idx: number) => idx === i ? { ...l, product_id: val, demand_qty: prod ? String(Number(prod.on_hand)) : '0' } : l) }));
    }
  };

  const validateForm = (lines: any[]) => {
    const e: Record<string,string> = {};
    if (cfg.partner && !form.partner_name?.trim()) e.partner_name = `${cfg.partner} name is required`;
    if (!form.scheduled_date) e.scheduled_date = 'Date is required';
    if (cfg.hasSource && !form.source_location_id) e.source_location_id = 'Source location required';
    if (!form.dest_location_id) e.dest_location_id = 'Destination required';
    if (opType === 'transfer' && form.source_location_id === form.dest_location_id) e.dest_location_id = 'Source and destination must differ';
    if (!lines.filter((l: any) => l.product_id).length) e.lines = 'Add at least one product line';
    const pids = lines.filter((l: any) => l.product_id).map((l: any) => l.product_id);
    if (new Set(pids).size !== pids.length) e.lines = 'Duplicate products in lines';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (confirm = false) => {
    const lines = (form.lines || []).filter((l: any) => l.product_id);
    if (!validateForm(lines)) return;
    setSaving(true);
    try {
      const payload = {
        type: opType, partner_name: form.partner_name || null,
        scheduled_date: form.scheduled_date, notes: form.notes || null,
        source_location_id: cfg.hasSource ? form.source_location_id : (opType === 'adjustment' ? form.dest_location_id : null),
        dest_location_id: form.dest_location_id,
        lines: lines.map((l: any) => ({
          product_id: l.product_id, demand_qty: Number(l.demand_qty) || 0,
          done_qty: Number(l.done_qty) || 0, adj_reason: l.adj_reason || null,
        })),
      };
      const res = await opsApi.create(payload);
      if (confirm) await opsApi.confirm(res.operation.id);
      toast(`${res.operation.reference} ${confirm ? 'confirmed' : 'saved as draft'}!`);
      setFormOpen(false);
      mutate();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setFormErrors(e.fields);
      else toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const doValidate = async (id: string, ref: string) => {
    try { await opsApi.validate(id); toast(`${ref} validated! Stock updated.`); mutate(); setFormOpen(false); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Validation failed', 'error'); }
  };

  const doCancel = async (id: string) => {
    try { await opsApi.cancel(id); toast('Operation canceled.', 'warn'); mutate(); setConfirmCancel(null); setFormOpen(false); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Cancel failed', 'error'); }
  };

  const getStepForDelivery = (status: string) => ({ draft:0, waiting:1, ready:2, done:3 }[status] || 0);

  if (formOpen) {
    const op = currentOp;
    const lines = editId ? currentLines : (form.lines || [emptyLine()]);
    const readOnly = isReadOnly;
    return (
      <>
        <ToastContainer toasts={toasts} remove={removeToast} />
        <Confirm open={!!confirmCancel} title="Cancel Operation" danger
          message="This will cancel the operation permanently. Stock will not be affected."
          onConfirm={() => doCancel(confirmCancel!)} onCancel={() => setConfirmCancel(null)} />

        <button onClick={() => setFormOpen(false)} className="text-xs text-slate-500 hover:text-slate-800 mb-3 flex items-center gap-1">← Back</button>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-base font-black text-slate-800">{op ? op.reference : `New ${cfg.label}`}</span>
              {op && <Badge value={op.status} />}
            </div>
            {op && !readOnly && (
              <div className="flex gap-2">
                <Btn variant="success" size="sm" onClick={() => doValidate(op.id, op.reference)}>✓ Validate</Btn>
                <Btn variant="ghost" size="sm" className="text-red-500" onClick={() => setConfirmCancel(op.id)}>Cancel Op</Btn>
              </div>
            )}
          </div>

          {opType === 'delivery' && op && (
            <ProgressSteps steps={['Pick Items','Pack Items','Validate']} current={getStepForDelivery(op.status)} />
          )}

          {/* Header Fields */}
          <div className={clsx('grid gap-2.5 mb-3', opType === 'transfer' ? 'grid-cols-3' : cfg.partner ? 'grid-cols-3' : 'grid-cols-2')}>
            {cfg.partner && (
              <div><label className="text-[11px] font-bold text-slate-500 block mb-1">{cfg.partner} Name *</label>
                <input disabled={!!readOnly} value={op ? op.partner_name||'' : form.partner_name||''} onChange={e => setForm((f: any) => ({...f, partner_name: e.target.value}))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50" placeholder={`e.g. ${opType==='receipt'?'Tata Steel Ltd':'L&T Construction'}`} />
                {formErrors.partner_name && <span className="text-[10px] text-red-500">{formErrors.partner_name}</span>}
              </div>
            )}
            {cfg.hasSource && (
              <div><label className="text-[11px] font-bold text-slate-500 block mb-1">{opType==='transfer'?'From Location':'Source Location'} *</label>
                <select disabled={!!readOnly} value={op ? op.source_location_id||'' : form.source_location_id||''} onChange={e => setForm((f: any) => ({...f, source_location_id: e.target.value}))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50">
                  {(opType==='delivery' ? storLocs : realLocs).map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>)}
                </select>
              </div>
            )}
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">{opType==='transfer'?'To Location':opType==='adjustment'?'Location':'Receiving Location'} *</label>
              <select disabled={!!readOnly} value={op ? op.dest_location_id||'' : form.dest_location_id||''} onChange={e => setForm((f: any) => ({...f, dest_location_id: e.target.value}))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50">
                {(opType==='adjustment' ? storLocs : realLocs).map((l: any) => <option key={l.id} value={l.id}>{l.name} ({l.warehouseName})</option>)}
              </select>
              {formErrors.dest_location_id && <span className="text-[10px] text-red-500">{formErrors.dest_location_id}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">Scheduled Date *</label>
              <input type="date" disabled={!!readOnly} value={op ? op.scheduled_date : form.scheduled_date}
                onChange={e => setForm((f: any) => ({...f, scheduled_date: e.target.value}))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
            </div>
            <div><label className="text-[11px] font-bold text-slate-500 block mb-1">Notes</label>
              <input disabled={!!readOnly} value={op ? op.notes||'' : form.notes||''} onChange={e => setForm((f: any) => ({...f, notes: e.target.value}))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-50" placeholder="Optional" />
            </div>
          </div>

          {/* Product Lines */}
          <div className="border-t border-slate-200 pt-3 mb-3">
            <div className="text-xs font-bold text-slate-700 mb-2">Product Lines</div>
            {formErrors.lines && <div className="text-[10px] text-red-500 mb-2">{formErrors.lines}</div>}
            <table className="w-full text-xs mb-2">
              <thead><tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-2 py-1.5 font-bold text-slate-400 uppercase text-[10px]">Product</th>
                <th className="text-left px-2 py-1.5 font-bold text-slate-400 uppercase text-[10px]">{opType==='adjustment'?'Theoretical Qty':'Demand Qty'}</th>
                <th className="text-left px-2 py-1.5 font-bold text-slate-400 uppercase text-[10px]">{opType==='adjustment'?'Counted Qty':'Done Qty'}</th>
                {opType === 'adjustment' && <th className="text-left px-2 py-1.5 font-bold text-slate-400 uppercase text-[10px]">Diff</th>}
                {opType === 'adjustment' && <th className="text-left px-2 py-1.5 font-bold text-slate-400 uppercase text-[10px]">Reason</th>}
                {!readOnly && <th className="px-2"></th>}
              </tr></thead>
              <tbody>
                {lines.map((l: any, i: number) => {
                  const diff = opType==='adjustment' && l.done_qty !== '' ? Number(l.done_qty) - Number(l.demand_qty) : null;
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-2 py-1.5">
                        <select disabled={!!readOnly} value={l.product_id} onChange={e => !readOnly && setLine(i, 'product_id', e.target.value)}
                          className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-blue-500 disabled:bg-slate-50">
                          <option value="">Select product…</option>
                          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.001" disabled={!!readOnly || opType==='adjustment'} value={l.demand_qty}
                          onChange={e => setLine(i, 'demand_qty', e.target.value)}
                          className="w-20 px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" step="0.001" disabled={!!readOnly} value={l.done_qty}
                          onChange={e => setLine(i, 'done_qty', e.target.value)}
                          style={{ borderColor: !readOnly && l.done_qty !== '' ? Number(l.done_qty) > 0 ? '#057A55' : '#E02424' : undefined }}
                          className="w-20 px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-blue-500 disabled:bg-slate-50" />
                      </td>
                      {opType==='adjustment' && (
                        <td className="px-2 py-1.5 font-bold text-xs" style={{ color: diff === null ? '#94A3B8' : diff > 0 ? '#057A55' : diff < 0 ? '#E02424' : '#94A3B8' }}>
                          {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
                        </td>
                      )}
                      {opType==='adjustment' && (
                        <td className="px-2 py-1.5">
                          <select disabled={!!readOnly} value={l.adj_reason||'physical_count'} onChange={e => setLine(i, 'adj_reason', e.target.value)}
                            className="w-28 px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none disabled:bg-slate-50">
                            <option value="physical_count">Physical Count</option>
                            <option value="damage">Damage</option>
                            <option value="theft">Theft</option>
                            <option value="expiry">Expiry</option>
                            <option value="error">Error</option>
                            <option value="other">Other</option>
                          </select>
                        </td>
                      )}
                      {!readOnly && (
                        <td className="px-2 py-1.5">
                          <button onClick={() => setForm((f: any) => ({...f, lines: f.lines.filter((_: any, idx: number) => idx !== i)}))}
                            className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!readOnly && (
              <button onClick={() => setForm((f: any) => ({...f, lines: [...(f.lines||[]), emptyLine()]}))}
                className="text-xs text-blue-600 font-semibold hover:text-blue-800">+ Add Line</button>
            )}
          </div>

          {!readOnly && (
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <Btn onClick={() => setFormOpen(false)}>Cancel</Btn>
              {!editId && <>
                <Btn onClick={() => save(false)} disabled={saving}>Save Draft</Btn>
                <Btn variant="primary" onClick={() => save(true)} disabled={saving}>Confirm</Btn>
              </>}
              {editId && op && op.status !== 'done' && (
                <Btn variant="success" onClick={() => doValidate(op.id, op.reference)} disabled={saving}>✓ Validate</Btn>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} remove={removeToast} />
      <Confirm open={!!confirmCancel} title="Cancel Operation" danger
        message="This will cancel the operation. Stock will not be affected."
        onConfirm={() => doCancel(confirmCancel!)} onCancel={() => setConfirmCancel(null)} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus-within:border-blue-400">
            <span className="text-slate-400 text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ref or partner…" className="text-xs outline-none bg-transparent w-40" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
            <option value="">All Status</option>
            <option value="draft">Draft</option><option value="waiting">Waiting</option>
            <option value="ready">Ready</option><option value="done">Done</option><option value="canceled">Canceled</option>
          </select>
        </div>
        <Btn variant="primary" onClick={openCreate}>+ New {cfg.label}</Btn>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Reference</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Status</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">{opType==='transfer'?'Route':opType==='adjustment'?'Location':cfg.partner}</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Lines</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Scheduled</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Created By</th>
            <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? Array.from({length:5}).map((_,i) => (
              <tr key={i} className="border-b border-slate-100">{Array.from({length:7}).map((_,j) => <td key={j} className="px-3 py-2"><Skeleton className="h-3 w-full" /></td>)}</tr>
            )) : ops.map((o: any) => (
              <tr key={o.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                <td className="px-3 py-2"><button onClick={() => openEdit(o.id)} className="text-blue-600 font-bold hover:underline">{o.reference}</button></td>
                <td className="px-3 py-2"><Badge value={o.status} /></td>
                <td className="px-3 py-2 text-slate-400">
                  {opType==='transfer' ? `${o.source_location_name} → ${o.dest_location_name}` : opType==='adjustment' ? o.dest_location_name : o.partner_name||'—'}
                </td>
                <td className="px-3 py-2 text-slate-400">{o.line_count} item{o.line_count!=1?'s':''}</td>
                <td className="px-3 py-2 text-slate-400">{o.scheduled_date}</td>
                <td className="px-3 py-2 text-slate-400">{o.created_by_name}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1.5">
                    {(o.status==='done'||o.status==='canceled')
                      ? <Btn size="xs" onClick={() => openEdit(o.id)}>View</Btn>
                      : <>
                          <Btn size="xs" onClick={() => openEdit(o.id)}>Edit</Btn>
                          <Btn size="xs" variant="success" onClick={() => doValidate(o.id, o.reference)}>✓ Validate</Btn>
                          <Btn size="xs" variant="ghost" className="text-red-500" onClick={() => setConfirmCancel(o.id)}>Cancel</Btn>
                        </>
                    }
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && ops.length === 0 && (
              <tr><td colSpan={7}><EmptyState icon={cfg.icon} title={`No ${cfg.label}s yet`} sub="Create your first one" action={<Btn variant="primary" onClick={openCreate}>+ New {cfg.label}</Btn>} /></td></tr>
            )}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-slate-200 flex justify-between text-[11px] text-slate-400 bg-slate-50">
          <span>{ops.length} operation{ops.length!==1?'s':''}</span>
        </div>
      </div>
    </>
  );
}

export function ReceiptsPage()    { return <AuthProvider><AppShell><OperationsContent opType="receipt"    /></AppShell></AuthProvider>; }
export function DeliveriesPage()  { return <AuthProvider><AppShell><OperationsContent opType="delivery"   /></AppShell></AuthProvider>; }
export function TransfersPage()   { return <AuthProvider><AppShell><OperationsContent opType="transfer"   /></AppShell></AuthProvider>; }
export function AdjustmentsPage() { return <AuthProvider><AppShell><OperationsContent opType="adjustment" /></AppShell></AuthProvider>; }
