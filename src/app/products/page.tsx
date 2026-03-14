'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { productsApi, categoriesApi, warehousesApi, ApiError } from '@/lib/client';
import { AppShell } from '@/lib/shell';
import { AuthProvider } from '@/lib/auth-context';
import { Badge, Btn, Drawer, Confirm, ToastContainer, EmptyState, StatBox, Skeleton, Input, Select, Textarea } from '@/lib/ui';
import { useToast } from '@/lib/toast';
import clsx from 'clsx';

function stockStatus(p: any) {
  const oh = Number(p.on_hand);
  if (oh === 0) return 'out';
  if (p.reorder_min && oh <= Number(p.reorder_min)) return 'low';
  return 'ok';
}
const stockLabels: Record<string, string> = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' };

function ProductsContent() {
  const searchParams = useSearchParams();
  const { toasts, toast, removeToast } = useToast();

  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [detailId, setDetailId]     = useState<string | null>(null);
  const [detailTab, setDetailTab]   = useState('stock');
  const [confirmId, setConfirmId]   = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);

  const [form, setForm] = useState<any>({ name:'', sku:'', category_id:'', uom:'kg', description:'', reorder_min:'', reorder_max:'', init_qty:'', init_loc_id:'' });
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});

  const { data: prodsData, isLoading, mutate } = useSWR(['products', search, catFilter, statusFilter],
    () => productsApi.list({ search, category_id: catFilter, status: statusFilter }), { keepPreviousData: true });
  const { data: catsData }  = useSWR('categories', () => categoriesApi.list());
  const { data: whData }    = useSWR('warehouses', () => warehousesApi.list());
  const { data: detailData, isLoading: detailLoading } = useSWR(
    detailId ? ['product', detailId] : null, () => productsApi.get(detailId!));

  const products   = prodsData?.products || [];
  const categories = catsData?.categories || [];
  const allLocs    = (whData?.warehouses || []).flatMap((w: any) => (w.locations || []).map((l: any) => ({ ...l, warehouseName: w.name })));
  const storLocs   = allLocs.filter((l: any) => l.type === 'storage' || l.type === 'input');

  const openCreate = () => {
    setEditId(null);
    setForm({ name:'', sku:'', category_id: categories[0]?.id||'', uom:'kg', description:'', reorder_min:'', reorder_max:'', init_qty:'', init_loc_id: storLocs[0]?.id||'' });
    setFormErrors({});
    setDrawerOpen(true);
  };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({ name: p.name, sku: p.sku, category_id: p.category_id, uom: p.uom, description: p.description||'', reorder_min: p.reorder_min||'', reorder_max: p.reorder_max||'', init_qty:'', init_loc_id:'' });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.sku.trim()) e.sku = 'SKU is required';
    else if (!/^[A-Z0-9_\-]{2,60}$/.test(form.sku.toUpperCase())) e.sku = 'SKU: uppercase letters, numbers, hyphens, underscores only';
    if (!form.category_id) e.category_id = 'Category is required';
    if (!form.uom.trim()) e.uom = 'Unit of measure is required';
    if (form.reorder_min && isNaN(Number(form.reorder_min))) e.reorder_min = 'Must be a number';
    if (form.reorder_max && isNaN(Number(form.reorder_max))) e.reorder_max = 'Must be a number';
    if (form.reorder_min && form.reorder_max && Number(form.reorder_max) < Number(form.reorder_min)) e.reorder_max = 'Max must be ≥ Min';
    if (!editId && form.init_qty && isNaN(Number(form.init_qty))) e.init_qty = 'Must be a number';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), sku: form.sku.trim().toUpperCase(),
        category_id: form.category_id, uom: form.uom,
        description: form.description || null,
        reorder_min: form.reorder_min ? Number(form.reorder_min) : null,
        reorder_max: form.reorder_max ? Number(form.reorder_max) : null,
        ...((!editId && form.init_qty) ? { init_qty: Number(form.init_qty), init_loc_id: form.init_loc_id } : {}),
      };
      if (editId) { await productsApi.update(editId, payload); toast('Product updated!'); }
      else        { await productsApi.create(payload); toast('Product created!'); }
      setDrawerOpen(false);
      mutate();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setFormErrors(e.fields);
      else toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const deleteProduct = async (id: string) => {
    try { await productsApi.remove(id); toast('Product deactivated.', 'warn'); mutate(); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Delete failed', 'error'); }
    setConfirmId(null);
  };

  if (detailId) {
    const p = detailData?.product;
    const locs = detailData?.stock_by_location || [];
    const moves = detailData?.moves || [];
    return (
      <>
        <ToastContainer toasts={toasts} remove={removeToast} />
        <button onClick={() => { setDetailId(null); mutate(); }} className="text-xs text-slate-500 hover:text-slate-800 mb-3 flex items-center gap-1">← Back to Products</button>
        {detailLoading || !p ? (
          <div className="bg-white rounded-xl p-5 border border-slate-200"><Skeleton className="h-6 w-48 mb-3" /><Skeleton className="h-4 w-full" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base font-black text-slate-800">{p.name}</span>
                  <Badge value={stockStatus(p)} label={stockLabels[stockStatus(p)]} />
                  <Badge value={p.is_active ? 'active' : 'inactive'} label={p.is_active ? 'Active' : 'Inactive'} />
                </div>
                <div className="flex gap-2">
                  <span className="chip text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">{p.sku}</span>
                  <span className="chip text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{p.category_name}</span>
                  <span className="chip text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{p.uom}</span>
                </div>
              </div>
              <Btn size="sm" onClick={() => openEdit(p)}>✎ Edit</Btn>
            </div>
            <div className="grid grid-cols-4 gap-2.5 mb-4">
              <StatBox value={Number(p.on_hand)} label="On Hand" />
              <StatBox value={Number(p.reserved)} label="Reserved" color="text-blue-700" />
              <StatBox value={Math.max(0, Number(p.on_hand) - Number(p.reserved))} label="Available" color="text-emerald-700" />
              <StatBox value={p.reorder_min || '—'} label="Reorder Min" color="text-amber-700" />
            </div>
            <div className="flex border-b border-slate-200 mb-4">
              {['stock','moves'].map(t => (
                <button key={t} onClick={() => setDetailTab(t)}
                  className={clsx('px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors', detailTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700')}>
                  {t === 'stock' ? 'Stock by Location' : `Move History (${moves.length})`}
                </button>
              ))}
            </div>
            {detailTab === 'stock' ? (
              <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Location</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Warehouse</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">On Hand</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Reserved</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Available</th>
              </tr></thead><tbody>
                {locs.map((l: any) => (
                  <tr key={l.location_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{l.location_name}</td>
                    <td className="px-3 py-2 text-slate-400">{l.warehouse_name || '—'}</td>
                    <td className="px-3 py-2 font-bold">{Number(l.on_hand_qty)}</td>
                    <td className="px-3 py-2 text-blue-700">{Number(l.reserved_qty)}</td>
                    <td className="px-3 py-2 text-emerald-700">{Math.max(0, Number(l.on_hand_qty) - Number(l.reserved_qty))}</td>
                  </tr>
                ))}
                {locs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No stock at any location</td></tr>}
              </tbody></table>
            ) : (
              <table className="w-full text-xs"><thead><tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Date</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Type</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Reference</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">From</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">To</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">Qty</th>
                <th className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px]">By</th>
              </tr></thead><tbody>
                {moves.map((m: any) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400 text-[10px] whitespace-nowrap">{String(m.moved_at).slice(0,16)}</td>
                    <td className="px-3 py-2">{m.op_type ? <Badge value={m.op_type} /> : '—'}</td>
                    <td className="px-3 py-2 text-blue-600 font-bold">{m.reference || '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{m.from_name}</td>
                    <td className="px-3 py-2 text-slate-400">{m.to_name}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">+{Number(m.qty)} <span className="text-slate-400 font-normal">{p.uom}</span></td>
                    <td className="px-3 py-2 text-slate-400">{m.moved_by_name}</td>
                  </tr>
                ))}
                {moves.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No stock moves yet</td></tr>}
              </tbody></table>
            )}
          </div>
        )}
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Edit Product">
          {renderDrawerBody()}
        </Drawer>
      </>
    );
  }

  function renderDrawerBody() {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Product Name *" value={form.name} onChange={(e: any) => setForm((p: any) => ({...p, name: e.target.value}))} error={formErrors.name} placeholder="Steel Rods 12mm" />
          <Input label="SKU / Code *" value={form.sku} onChange={(e: any) => setForm((p: any) => ({...p, sku: e.target.value.toUpperCase()}))} error={formErrors.sku} placeholder="STL-ROD-001" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Category *" value={form.category_id} onChange={(e: any) => setForm((p: any) => ({...p, category_id: e.target.value}))} error={formErrors.category_id}>
            <option value="">Select…</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select label="Unit of Measure *" value={form.uom} onChange={(e: any) => setForm((p: any) => ({...p, uom: e.target.value}))} error={formErrors.uom}>
            {['kg','pcs','m','liters','rolls','boxes','sets','pairs'].map(u => <option key={u}>{u}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Reorder Min Qty" type="number" min="0" value={form.reorder_min} onChange={(e: any) => setForm((p: any) => ({...p, reorder_min: e.target.value}))} error={formErrors.reorder_min} placeholder="0" />
          <Input label="Reorder Max Qty" type="number" min="0" value={form.reorder_max} onChange={(e: any) => setForm((p: any) => ({...p, reorder_max: e.target.value}))} error={formErrors.reorder_max} placeholder="0" />
        </div>
        {!editId && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="Initial Stock Qty" type="number" min="0" value={form.init_qty} onChange={(e: any) => setForm((p: any) => ({...p, init_qty: e.target.value}))} error={formErrors.init_qty} placeholder="0 (optional)" />
            <Select label="Initial Location" value={form.init_loc_id} onChange={(e: any) => setForm((p: any) => ({...p, init_loc_id: e.target.value}))}>
              {storLocs.map((l: any) => <option key={l.id} value={l.id}>{l.name} — {l.warehouseName}</option>)}
            </Select>
          </div>
        )}
        <Textarea label="Description" value={form.description} onChange={(e: any) => setForm((p: any) => ({...p, description: e.target.value}))} placeholder="Optional product notes…" />
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 mt-2">
          <Btn onClick={() => setDrawerOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Product'}</Btn>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} remove={removeToast} />
      <Confirm open={!!confirmId} title="Deactivate Product" danger
        message="This will deactivate the product. Existing stock history is preserved."
        onConfirm={() => deleteProduct(confirmId!)} onCancel={() => setConfirmId(null)} />
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus-within:border-blue-400">
            <span className="text-slate-400 text-xs">🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or SKU…" className="text-xs outline-none bg-transparent text-slate-700 w-44" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
            <option value="">All Categories</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400">
            <option value="">All Status</option><option value="ok">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option>
          </select>
        </div>
        <Btn variant="primary" onClick={openCreate}>+ New Product</Btn>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            {['SKU','Name','Category','UoM','On Hand','Reserved','Available','Status',''].map(h => (
              <th key={h} className="text-left px-3 py-2 font-bold text-slate-400 uppercase text-[10px] whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading ? Array.from({length:6}).map((_,i) => (
              <tr key={i} className="border-b border-slate-100">
                {Array.from({length:9}).map((_,j) => <td key={j} className="px-3 py-2"><Skeleton className="h-3 w-full" /></td>)}
              </tr>
            )) : products.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => { setDetailId(p.id); setDetailTab('stock'); }}>
                <td className="px-3 py-2"><span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{p.sku}</span></td>
                <td className="px-3 py-2 font-semibold text-slate-800">{p.name}</td>
                <td className="px-3 py-2 text-slate-400">{p.category_name}</td>
                <td className="px-3 py-2 text-slate-400">{p.uom}</td>
                <td className="px-3 py-2 font-bold">{Number(p.on_hand)}</td>
                <td className="px-3 py-2 text-blue-700">{Number(p.reserved)}</td>
                <td className="px-3 py-2 text-emerald-700">{Math.max(0, Number(p.on_hand) - Number(p.reserved))}</td>
                <td className="px-3 py-2"><Badge value={stockStatus(p)} label={stockLabels[stockStatus(p)]} /></td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <Btn size="xs" onClick={() => openEdit(p)}>✎</Btn>
                    <Btn size="xs" variant="ghost" className="text-red-500" onClick={() => setConfirmId(p.id)}>✕</Btn>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && products.length === 0 && (
              <tr><td colSpan={9}><EmptyState icon="📦" title="No products found" sub="Try adjusting your search or filters" action={<Btn variant="primary" onClick={openCreate}>+ New Product</Btn>} /></td></tr>
            )}
          </tbody>
        </table>
        <div className="px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-400 bg-slate-50">
          <span>Showing {products.length} product{products.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editId ? 'Edit Product' : 'New Product'}>
        {renderDrawerBody()}
      </Drawer>
    </>
  );
}

export default function ProductsPage() {
  return <AuthProvider><AppShell><ProductsContent /></AppShell></AuthProvider>;
}
