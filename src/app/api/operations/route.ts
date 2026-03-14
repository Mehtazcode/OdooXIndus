import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getUserFromRequest, requireAuth } from '@/lib/auth';
import { ok, err, handleApiError, OperationSchema, UpdateOperationSchema, PaginationSchema } from '@/lib/api';
import { z } from 'zod';

// GET /api/operations
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const url = new URL(req.url);
    const { page, limit } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const type       = url.searchParams.get('type') || '';
    const status     = url.searchParams.get('status') || '';
    const warehouseId = url.searchParams.get('warehouse_id') || '';
    const search     = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (type)   { conditions.push(`o.type = $${i++}`);   vals.push(type); }
    if (status) { conditions.push(`o.status = $${i++}`); vals.push(status); }
    if (search) { conditions.push(`o.reference ILIKE $${i} OR o.partner_name ILIKE $${i}`); vals.push(`%${search}%`); i++; }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT o.*,
        sl.name AS source_location_name, dl.name AS dest_location_name,
        sw.name AS source_warehouse_name, dw.name AS dest_warehouse_name,
        u.name AS created_by_name, v.name AS validated_by_name,
        COUNT(ol.id) AS line_count
      FROM operations o
      LEFT JOIN locations sl ON sl.id = o.source_location_id
      LEFT JOIN locations dl ON dl.id = o.dest_location_id
      LEFT JOIN warehouses sw ON sw.id = sl.warehouse_id
      LEFT JOIN warehouses dw ON dw.id = dl.warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      LEFT JOIN users v ON v.id = o.validated_by
      LEFT JOIN operation_lines ol ON ol.operation_id = o.id
      ${where}
      GROUP BY o.id, sl.name, dl.name, sw.name, dw.name, u.name, v.name
      ORDER BY o.created_at DESC
      LIMIT $${i} OFFSET $${i+1}`;
    vals.push(limit, offset);

    const [rows, countRes] = await Promise.all([
      query(sql, vals),
      query(`SELECT COUNT(*) FROM operations o ${where}`, vals.slice(0,-2)),
    ]);
    return ok({ operations: rows.rows, total: Number(countRes.rows[0].count), page, limit });
  } catch (e) { return handleApiError(e); }
}

// POST /api/operations
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const body = OperationSchema.parse(await req.json());

    // Validate location rules
    const errs = validateLocationRules(body.type, body.source_location_id, body.dest_location_id);
    if (errs) return err('VALIDATION_ERROR', errs, 422);

    // Check duplicate product lines
    const pids = body.lines.map(l => l.product_id);
    if (new Set(pids).size !== pids.length) return err('VALIDATION_ERROR', 'Duplicate products in lines', 422);

    const result = await withTransaction(async (client) => {
      // Get reference number (atomic via sequences table)
      const refRes = await client.query(`SELECT next_reference($1) AS ref`, [body.type]);
      const ref = refRes.rows[0].ref;

      const opRes = await client.query(
        `INSERT INTO operations (reference, type, status, source_location_id, dest_location_id, partner_name, scheduled_date, notes, created_by)
         VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8) RETURNING *`,
        [ref, body.type, body.source_location_id||null, body.dest_location_id,
         body.partner_name||null, body.scheduled_date, body.notes||null, user!.userId]
      );
      const op = opRes.rows[0];

      // Insert lines
      for (const line of body.lines) {
        if (body.type === 'adjustment' && !line.adj_reason)
          throw new Error('Adjustment reason required for each line');
        await client.query(
          `INSERT INTO operation_lines (operation_id, product_id, demand_qty, done_qty, adj_reason)
           VALUES ($1,$2,$3,$4,$5)`,
          [op.id, line.product_id, line.demand_qty, line.done_qty||0, line.adj_reason||null]
        );
      }
      return op;
    });

    return ok({ operation: result }, 201);
  } catch (e) { return handleApiError(e); }
}

function validateLocationRules(type: string, srcId: string|null|undefined, dstId: string): string|null {
  if (type === 'transfer' && srcId === dstId) return 'Source and destination locations must be different';
  if (type === 'receipt' && !dstId) return 'Receiving location is required for receipts';
  if ((type === 'delivery' || type === 'transfer') && !srcId) return 'Source location is required';
  return null;
}
