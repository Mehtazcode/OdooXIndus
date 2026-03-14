import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest, requireAuth, requireManager } from '@/lib/auth';
import { ok, err, handleApiError, ProductSchema } from '@/lib/api';
import { z } from 'zod';

// GET /api/products/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);

    const prod = await query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [params.id]
    );
    if (!prod.rows[0]) return err('NOT_FOUND', 'Product not found', 404);

    // Stock by location
    const stockByLoc = await query(
      `SELECT sq.*, l.name AS location_name, l.type AS location_type,
              w.name AS warehouse_name, w.id AS warehouse_id
       FROM stock_quants sq
       JOIN locations l ON l.id = sq.location_id
       LEFT JOIN warehouses w ON w.id = l.warehouse_id
       WHERE sq.product_id = $1 AND sq.on_hand_qty > 0
       ORDER BY w.name, l.name`,
      [params.id]
    );

    // Move history
    const moves = await query(
      `SELECT sm.*, fl.name AS from_name, tl.name AS to_name,
              o.reference, o.type AS op_type, u.name AS moved_by_name
       FROM stock_moves sm
       LEFT JOIN locations fl ON fl.id = sm.from_location_id
       LEFT JOIN locations tl ON tl.id = sm.to_location_id
       LEFT JOIN operations o ON o.id = sm.operation_id
       LEFT JOIN users u ON u.id = sm.moved_by
       WHERE sm.product_id = $1
       ORDER BY sm.moved_at DESC LIMIT 50`,
      [params.id]
    );

    return ok({ product: prod.rows[0], stock_by_location: stockByLoc.rows, moves: moves.rows });
  } catch (e) { return handleApiError(e); }
}

// PUT /api/products/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireManager(user);
    const body = ProductSchema.omit({ init_qty: true, init_loc_id: true }).parse(await req.json());

    const dup = await query('SELECT id FROM products WHERE sku = $1 AND id != $2', [body.sku, params.id]);
    if (dup.rows.length) return err('CONFLICT', 'SKU already exists', 409, { sku: 'SKU already in use' });

    const res = await query(
      `UPDATE products SET name=$1, sku=$2, category_id=$3, uom=$4, description=$5,
       reorder_min=$6, reorder_max=$7 WHERE id=$8 RETURNING *`,
      [body.name, body.sku, body.category_id, body.uom, body.description||null,
       body.reorder_min||null, body.reorder_max||null, params.id]
    );
    if (!res.rows[0]) return err('NOT_FOUND', 'Product not found', 404);
    return ok({ product: res.rows[0] });
  } catch (e) { return handleApiError(e); }
}

// DELETE /api/products/[id] (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireManager(user);
    const res = await query(
      `UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id`,
      [params.id]
    );
    if (!res.rows[0]) return err('NOT_FOUND', 'Product not found', 404);
    return ok({ message: 'Product deactivated' });
  } catch (e) { return handleApiError(e); }
}
