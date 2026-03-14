import { NextResponse } from 'next/server';
import { z } from 'zod';

// ─── Standard API response ───────────────────────────────────
export function ok(data: any, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(code: string, message: string, status: number, fields?: Record<string, string>) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(fields ? { fields } : {}) } },
    { status }
  );
}

export function handleApiError(e: unknown) {
  if (e instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    e.errors.forEach(er => { if (er.path.length) fields[er.path.join('.')] = er.message; });
    return err('VALIDATION_ERROR', 'Validation failed', 422, fields);
  }
  const msg = e instanceof Error ? e.message : 'Internal server error';
  // Postgres unique violation
  if ((e as any)?.code === '23505') return err('CONFLICT', 'A record with that value already exists', 409);
  // Postgres foreign key violation
  if ((e as any)?.code === '23503') return err('CONFLICT', 'Referenced record does not exist', 409);
  // Postgres check constraint
  if ((e as any)?.code === '23514') return err('VALIDATION_ERROR', `Constraint violation: ${msg}`, 422);
  // Auth errors
  if ((e as any)?.name === 'AuthError') return err('UNAUTHORIZED', msg, (e as any).status || 401);
  console.error('[API Error]', e);
  return err('INTERNAL', 'Internal server error', 500);
}

// ─── Zod schemas ─────────────────────────────────────────────
export const RegisterSchema = z.object({
  name:     z.string().min(2).max(120).trim(),
  email:    z.string().email().toLowerCase().trim(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  role:     z.enum(['manager', 'staff']).default('staff'),
});

export const LoginSchema = z.object({
  email:    z.string().email().toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const ProductSchema = z.object({
  name:        z.string().min(2).max(120).trim(),
  sku:         z.string().min(2).max(60).toUpperCase()
                 .regex(/^[A-Z0-9_\-]{2,60}$/, 'SKU: letters, numbers, hyphens, underscores only'),
  category_id: z.string().uuid('Invalid category'),
  uom:         z.string().min(1).max(30).trim(),
  description: z.string().max(1000).optional().nullable(),
  reorder_min: z.number().nonnegative().optional().nullable(),
  reorder_max: z.number().nonnegative().optional().nullable(),
  init_qty:    z.number().nonnegative().optional(),
  init_loc_id: z.string().uuid().optional(),
}).refine(d => !(d.reorder_min && d.reorder_max && d.reorder_max < d.reorder_min), {
  message: 'Reorder max must be ≥ reorder min', path: ['reorder_max'],
});

export const CategorySchema = z.object({
  name:        z.string().min(1).max(100).trim(),
  code:        z.string().max(20).toUpperCase().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const WarehouseSchema = z.object({
  name:       z.string().min(2).max(120).trim(),
  short_code: z.string().min(2).max(5).toUpperCase()
               .regex(/^[A-Z0-9]{2,5}$/, 'Code: 2-5 uppercase letters/numbers only'),
  address:    z.string().max(500).optional().nullable(),
});

export const LocationSchema = z.object({
  warehouse_id: z.string().uuid(),
  parent_id:    z.string().uuid().optional().nullable(),
  name:         z.string().min(1).max(120).trim(),
  type:         z.enum(['input', 'storage', 'output']),
});

export const OperationSchema = z.object({
  type:               z.enum(['receipt', 'delivery', 'transfer', 'adjustment']),
  source_location_id: z.string().uuid().optional().nullable(),
  dest_location_id:   z.string().uuid(),
  partner_name:       z.string().max(120).trim().optional().nullable(),
  scheduled_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes:              z.string().max(1000).optional().nullable(),
  lines: z.array(z.object({
    product_id:  z.string().uuid(),
    demand_qty:  z.number().nonnegative(),
    done_qty:    z.number().nonnegative().default(0),
    adj_reason:  z.enum(['physical_count','damage','theft','expiry','error','other']).optional().nullable(),
  })).min(1, 'At least one product line is required'),
});

export const UpdateOperationSchema = z.object({
  partner_name:       z.string().max(120).trim().optional().nullable(),
  scheduled_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:              z.string().max(1000).optional().nullable(),
  source_location_id: z.string().uuid().optional().nullable(),
  dest_location_id:   z.string().uuid().optional(),
  lines: z.array(z.object({
    id:          z.string().uuid().optional(),
    product_id:  z.string().uuid(),
    demand_qty:  z.number().nonnegative(),
    done_qty:    z.number().nonnegative().default(0),
    adj_reason:  z.enum(['physical_count','damage','theft','expiry','error','other']).optional().nullable(),
  })).optional(),
});

export const PaginationSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
