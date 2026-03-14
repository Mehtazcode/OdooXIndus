import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getUserFromRequest, requireAuth, requireManager } from '@/lib/auth';
import { ok, err, handleApiError, ProductSchema, PaginationSchema } from '@/lib/api';
import { z } from 'zod';

// GET /api/products
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const url = new URL(req.url);
    const { page, limit } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const offset = (page - 1) * limit;
    const search      = url.searchParams.get('search') || '';
    const categoryId  = url.searchParams.get('category_id') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const warehouseId = url.searchParams.get('warehouse_id') || '';

    let conditions = ['p.is_active = TRUE'];
    const vals: any[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i})`);
      vals.push(`%${search}%`); i++;
    }
    if (categoryId) {
      conditions.push(`p.category_id = $${i++}`);
      vals.push(categoryId);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT
        p.id, p.name, p.sku, p.uom, p.reorder_min, p.reorder_max, p.is_active,
        c.id AS category_id, c.name AS category_name,
        COALESCE(SUM(sq.on_hand_qty), 0) AS on_hand,
        COALESCE(SUM(sq.reserved_qty), 0) AS reserved,
        COALESCE(SUM(sq.on_hand_qty), 0) - COALESCE(SUM(sq.reserved_qty), 0) AS available
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock_quants sq ON sq.product_id = p.id
        ${warehouseId ? `AND sq.location_id IN (SELECT id FROM locations WHERE warehouse_id = '${warehouseId}')` : ''}
      ${where}
      GROUP BY p.id, c.id, c.name
      ORDER BY p.name
      LIMIT $${i} OFFSET $${i+1}`;

    vals.push(limit, offset);
    const countSql = `SELECT COUNT(*) FROM products p ${where.replace(/LIMIT.*/, '')}`;
    const [rows, countRes] = await Promise.all([
      query(sql, vals),
      query(countSql, vals.slice(0, -2)),
    ]);

    // Apply stock status filter client-side (after aggregation)
    let products = rows.rows.map(p => ({
      ...p,
      stock_status: Number(p.on_hand) === 0 ? 'out' :
        (p.reorder_min && Number(p.on_hand) <= Number(p.reorder_min)) ? 'low' : 'ok'
    }));
    if (statusFilter) products = products.filter(p => p.stock_status === statusFilter);

    return ok({ products, total: Number(countRes.rows[0].count), page, limit });
  } catch (e) { return handleApiError(e); }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireManager(user);
    const body = ProductSchema.parse(await req.json());

    // Check SKU uniqueness
    const dup = await query('SELECT id FROM products WHERE sku = $1', [body.sku.toUpperCase()]);
    if (dup.rows.length) return err('CONFLICT', 'SKU already exists', 409, { sku: 'SKU already in use' });

    const result = await withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO products (name, sku, category_id, uom, description, reorder_min, reorder_max)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [body.name, body.sku, body.category_id, body.uom, body.description||null, body.reorder_min||null, body.reorder_max||null]
      );
      const prod = res.rows[0];

      // Create initial stock if provided
      if (body.init_qty && body.init_qty > 0 && body.init_loc_id) {
        await client.query(
          `INSERT INTO stock_quants (product_id, location_id, on_hand_qty) VALUES ($1,$2,$3)
           ON CONFLICT (product_id, location_id) DO UPDATE SET on_hand_qty = stock_quants.on_hand_qty + $3`,
          [prod.id, body.init_loc_id, body.init_qty]
        );
        const adjLoc = await client.query(`SELECT id FROM locations WHERE name='Inventory Adjustment' AND type='virtual'`);
        await client.query(
          `INSERT INTO stock_moves (product_id, from_location_id, to_location_id, qty, moved_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [prod.id, adjLoc.rows[0]?.id, body.init_loc_id, body.init_qty, user!.userId]
        );
      }
      return prod;
    });

    return ok({ product: result }, 201);
  } catch (e) { return handleApiError(e); }
}
