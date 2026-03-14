'use client';

const BASE = '/api';

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    credentials: 'include',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json?.error?.message || 'Request failed', res.status, json?.error?.fields);
  return json.data;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string,string>) {
    super(message); this.name = 'ApiError';
  }
}

// ─── Auth ────────────────────────────────────────────────────
export const authApi = {
  login:          (b: any) => apiFetch('/auth/login',           { method:'POST', body: JSON.stringify(b) }),
  register:       (b: any) => apiFetch('/auth/register',        { method:'POST', body: JSON.stringify(b) }),
  logout:         ()       => apiFetch('/auth/logout',          { method:'POST' }),
  me:             ()       => apiFetch('/auth/me'),
  updateMe:       (b: any) => apiFetch('/auth/me',              { method:'PATCH', body: JSON.stringify(b) }),
  forgotPassword: (b: any) => apiFetch('/auth/forgot-password', { method:'POST', body: JSON.stringify(b) }),
  resetPassword:  (b: any) => apiFetch('/auth/reset-password',  { method:'POST', body: JSON.stringify(b) }),
};

// ─── Products ────────────────────────────────────────────────
export const productsApi = {
  list:   (p?: Record<string,any>) => apiFetch('/products?' + new URLSearchParams(clean(p)).toString()),
  get:    (id: string)             => apiFetch(`/products/${id}`),
  create: (b: any)                 => apiFetch('/products',     { method:'POST', body: JSON.stringify(b) }),
  update: (id: string, b: any)     => apiFetch(`/products/${id}`,{ method:'PUT',  body: JSON.stringify(b) }),
  remove: (id: string)             => apiFetch(`/products/${id}`,{ method:'DELETE' }),
};

// ─── Categories ──────────────────────────────────────────────
export const categoriesApi = {
  list:   ()       => apiFetch('/categories'),
  create: (b: any) => apiFetch('/categories', { method:'POST', body: JSON.stringify(b) }),
};

// ─── Operations ──────────────────────────────────────────────
export const opsApi = {
  list:     (p?: Record<string,any>)       => apiFetch('/operations?' + new URLSearchParams(clean(p)).toString()),
  get:      (id: string)                   => apiFetch(`/operations/${id}`),
  create:   (b: any)                       => apiFetch('/operations',               { method:'POST', body: JSON.stringify(b) }),
  update:   (id: string, b: any)           => apiFetch(`/operations/${id}`,          { method:'PUT',  body: JSON.stringify(b) }),
  confirm:  (id: string)                   => apiFetch(`/operations/${id}/confirm`,  { method:'POST' }),
  validate: (id: string)                   => apiFetch(`/operations/${id}/validate`, { method:'POST' }),
  cancel:   (id: string)                   => apiFetch(`/operations/${id}/cancel`,   { method:'POST' }),
};

// ─── Stock / History ─────────────────────────────────────────
export const stockApi = {
  moves:  (p?: Record<string,any>) => apiFetch('/stock?' + new URLSearchParams(clean(p)).toString()),
  export: (p?: Record<string,any>) => window.open(BASE + '/stock?' + new URLSearchParams({ ...clean(p), export:'csv' }).toString()),
};

// ─── Dashboard ───────────────────────────────────────────────
export const dashApi = {
  kpis: (p?: Record<string,any>) => apiFetch('/dashboard?' + new URLSearchParams(clean(p)).toString()),
};

// ─── Warehouses ──────────────────────────────────────────────
export const warehousesApi = {
  list:        ()                         => apiFetch('/warehouses'),
  create:      (b: any)                   => apiFetch('/warehouses',              { method:'POST', body: JSON.stringify(b) }),
  update:      (id: string, b: any)       => apiFetch(`/warehouses/${id}`,        { method:'PUT',  body: JSON.stringify(b) }),
  addLocation: (whId: string, b: any)     => apiFetch(`/warehouses/${whId}/locations`, { method:'POST', body: JSON.stringify(b) }),
};

function clean(p?: Record<string,any>): Record<string,string> {
  if (!p) return {};
  return Object.fromEntries(Object.entries(p).filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k,v]) => [k, String(v)]));
}
