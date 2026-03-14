import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest, requireAuth, requireManager } from '@/lib/auth';
import { ok, err, handleApiError, WarehouseSchema, LocationSchema } from '@/lib/api';

// GET /api/warehouses
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const res = await query(
      `SELECT w.*,
         json_agg(json_build_object(
           'id', l.id, 'name', l.name, 'type', l.type, 'is_active', l.is_active
         ) ORDER BY l.name) FILTER (WHERE l.id IS NOT NULL) AS locations
       FROM warehouses w
       LEFT JOIN locations l ON l.warehouse_id = w.id AND l.is_active = TRUE AND l.type != 'virtual'
       WHERE w.is_active = TRUE
       GROUP BY w.id
       ORDER BY w.name`
    );
    return ok({ warehouses: res.rows });
  } catch (e) { return handleApiError(e); }
}

// POST /api/warehouses
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireManager(user);
    const body = WarehouseSchema.parse(await req.json());

    const dup = await query('SELECT id FROM warehouses WHERE short_code = $1', [body.short_code]);
    if (dup.rows.length) return err('CONFLICT', 'Short code already in use', 409, { short_code: 'Short code already used' });

    const res = await query(
      `INSERT INTO warehouses (name, short_code, address) VALUES ($1,$2,$3) RETURNING *`,
      [body.name, body.short_code, body.address || null]
    );
    const wh = res.rows[0];

    // Auto-create default locations
    await query(
      `INSERT INTO locations (warehouse_id, name, type) VALUES
       ($1, 'Receiving Zone', 'input'),
       ($1, 'Main Storage', 'storage'),
       ($1, 'Dispatch Bay', 'output')`,
      [wh.id]
    );
    return ok({ warehouse: wh }, 201);
  } catch (e) { return handleApiError(e); }
}

// PUT /api/warehouses/[id]
export async function updateWarehouse(req: NextRequest, id: string) {
  try {
    const user = getUserFromRequest(req);
    requireManager(user);
    const body = WarehouseSchema.parse(await req.json());
    const dup = await query('SELECT id FROM warehouses WHERE short_code = $1 AND id != $2', [body.short_code, id]);
    if (dup.rows.length) return err('CONFLICT', 'Short code already in use', 409, { short_code: 'Short code taken' });
    const res = await query(
      `UPDATE warehouses SET name=$1, short_code=$2, address=$3 WHERE id=$4 RETURNING *`,
      [body.name, body.short_code, body.address || null, id]
    );
    if (!res.rows[0]) return err('NOT_FOUND', 'Warehouse not found', 404);
    return ok({ warehouse: res.rows[0] });
  } catch (e) { return handleApiError(e); }
}

// GET /api/warehouses/[id]/locations
export async function getLocations(req: NextRequest, warehouseId: string) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const res = await query(
      `SELECT l.*, w.name AS warehouse_name
       FROM locations l
       LEFT JOIN warehouses w ON w.id = l.warehouse_id
       WHERE l.warehouse_id = $1 AND l.is_active = TRUE
       ORDER BY l.type, l.name`,
      [warehouseId]
    );
    return ok({ locations: res.rows });
  } catch (e) { return handleApiError(e); }
}

// POST /api/warehouses/[id]/locations
export async function addLocation(req: NextRequest, warehouseId: string) {
  try {
    const user = getUserFromRequest(req);
    requireManager(user);
    const body = LocationSchema.omit({ warehouse_id: true }).parse(await req.json());
    const dup = await query(
      'SELECT id FROM locations WHERE warehouse_id = $1 AND name = $2',
      [warehouseId, body.name]
    );
    if (dup.rows.length) return err('CONFLICT', 'Location name already exists in this warehouse', 409, { name: 'Name already used' });
    const res = await query(
      `INSERT INTO locations (warehouse_id, parent_id, name, type) VALUES ($1,$2,$3,$4) RETURNING *`,
      [warehouseId, body.parent_id || null, body.name, body.type]
    );
    return ok({ location: res.rows[0] }, 201);
  } catch (e) { return handleApiError(e); }
}
