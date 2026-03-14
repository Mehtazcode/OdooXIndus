'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { warehousesApi, ApiError } from '@/lib/client';
import { AppShell } from '@/lib/shell';
import { AuthProvider } from '@/lib/auth-context';
import { Btn, Drawer, Confirm, ToastContainer, Input, Select, Skeleton } from '@/lib/ui';
import { useToast } from '@/lib/toast';

function WarehousesContent() {
  const { toasts, toast, removeToast } = useToast();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId]         = useState<string|null>(null);
  const [locDrawer, setLocDrawer]   = useState<string|null>(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]     = useState({ name:'', short_code:'', address:'' });
  const [locForm, setLocForm] = useState({ name:'', type:'storage' });
  const [formErrors, setFormErrors] = useState<Record<string,string>>({});
  const [locErrors, setLocErrors]   = useState<Record<string,string>>({});

  const { data, isLoading, mutate } = useSWR('warehouses', () => warehousesApi.list());
  const warehouses = data?.warehouses || [];

  const openCreate = () => { setEditId(null); setForm({ name:'', short_code:'', address:'' }); setFormErrors({}); setDrawerOpen(true); };
  const openEdit   = (w: any) => { setEditId(w.id); setForm({ name:w.name, short_code:w.short_code, address:w.address||'' }); setFormErrors({}); setDrawerOpen(true); };

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.short_code.trim() || !/^[A-Z0-9]{2,5}$/.test(form.short_code.toUpperCase())) e.short_code = '2-5 uppercase letters/numbers only';
    setFormErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), short_code: form.short_code.toUpperCase(), address: form.address || null };
      if (editId) { await warehousesApi.update(editId, payload); toast('Warehouse updated!'); }
      else        { await warehousesApi.create(payload); toast('Warehouse created with 3 default locations!'); }
      setDrawerOpen(false); mutate();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setFormErrors(e.fields);
      else toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const addLocation = async (whId: string) => {
    const e: Record<string,string> = {};
    if (!locForm.name.trim()) e.name = 'Location name is required';
    if (!locForm.type) e.type = 'Type is required';
    setLocErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await warehousesApi.addLocation(whId, { name: locForm.name.trim(), type: locForm.type });
      toast(`Location "${locForm.name}" added!`);
      setLocDrawer(null); setLocForm({ name:'', type:'storage' }); mutate();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setLocErrors(e.fields);
      else toast(e instanceof ApiError ? e.message : 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const typeColors: Record<string,string> = { input:'bg-blue-50 text-blue-700', storage:'bg-slate-100 text-slate-600', output:'bg-amber-50 text-amber-700', virtual:'bg-purple-50 text-purple-700' };

  return (
    <>
      <ToastContainer toasts={toasts} remove={removeToast} />
      <div className="flex justify-end mb-3">
        <Btn variant="primary" onClick={openCreate}>+ New Warehouse</Btn>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4"><Skeleton className="h-5 w-48 mb-2" /><Skeleton className="h-4 w-32" /></div>)}</div>
      ) : warehouses.map((w: any) => (
        <div key={w.id} className="bg-white border border-slate-200 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center text-base">🏭</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-800">{w.name}</span>
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{w.short_code}</span>
                </div>
                <div className="text-[11px] text-slate-400">{w.address || 'No address'} · {(w.locations||[]).length} locations</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Btn size="sm" onClick={() => openEdit(w)}>✎ Edit</Btn>
              <Btn size="sm" variant="primary" onClick={() => { setLocDrawer(w.id); setLocForm({ name:'', type:'storage' }); setLocErrors({}); }}>+ Add Location</Btn>
            </div>
          </div>
          <div className="ml-4 border-l-2 border-slate-200 pl-4 space-y-1">
            {(w.locations||[]).map((l: any) => (
              <div key={l.id} className="flex items-center gap-2 py-1 text-xs text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                {l.name}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${typeColors[l.type]||'bg-slate-100 text-slate-500'}`}>{l.type}</span>
              </div>
            ))}
            {!(w.locations||[]).length && <div className="py-1 text-xs text-slate-400">No locations — add one above</div>}
          </div>
        </div>
      ))}

      {/* Warehouse Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editId ? 'Edit Warehouse' : 'New Warehouse'}>
        <Input label="Warehouse Name *" value={form.name} onChange={(e: any) => setForm(f => ({...f, name: e.target.value}))} error={formErrors.name} placeholder="Main Warehouse" />
        <Input label="Short Code * (2-5 chars)" value={form.short_code} onChange={(e: any) => setForm(f => ({...f, short_code: e.target.value.toUpperCase()}))} error={formErrors.short_code} placeholder="MWH" maxLength={5} />
        <div className="flex flex-col gap-1 mb-2.5">
          <label className="text-[11px] font-bold text-slate-500">Address</label>
          <textarea value={form.address} onChange={(e: any) => setForm(f => ({...f, address: e.target.value}))} rows={2} className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 resize-y" placeholder="Physical address (optional)" />
        </div>
        {!editId && <p className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2.5 mb-3">3 default locations will be created automatically: Receiving Zone, Main Storage, Dispatch Bay.</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Btn onClick={() => setDrawerOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Warehouse'}</Btn>
        </div>
      </Drawer>

      {/* Add Location Drawer */}
      <Drawer open={!!locDrawer} onClose={() => setLocDrawer(null)} title="Add Location">
        <Input label="Location Name *" value={locForm.name} onChange={(e: any) => setLocForm(f => ({...f, name: e.target.value}))} error={locErrors.name} placeholder="e.g. Shelf Row A" />
        <Select label="Location Type *" value={locForm.type} onChange={(e: any) => setLocForm(f => ({...f, type: e.target.value}))} error={locErrors.type}>
          <option value="input">Input (receiving zone)</option>
          <option value="storage">Storage (main stock area)</option>
          <option value="output">Output (dispatch/shipping)</option>
        </Select>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Btn onClick={() => setLocDrawer(null)}>Cancel</Btn>
          <Btn variant="primary" onClick={() => addLocation(locDrawer!)} disabled={saving}>{saving ? 'Adding…' : 'Add Location'}</Btn>
        </div>
      </Drawer>
    </>
  );
}

export default function WarehousesPage() {
  return <AuthProvider><AppShell><WarehousesContent /></AppShell></AuthProvider>;
}
