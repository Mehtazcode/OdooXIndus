import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getUserFromRequest, requireAuth } from '@/lib/auth';
import { ok, err, handleApiError, UpdateOperationSchema } from '@/lib/api';

// GET /api/operations/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const op = await query(
      `SELECT o.*,
        sl.name AS source_location_name, dl.name AS dest_location_name,
        sw.name AS source_warehouse_name, dw.name AS dest_warehouse_name,
        u.name AS created_by_name, v.name AS validated_by_name
       FROM operations o
       LEFT JOIN locations sl ON sl.id = o.source_location_id
       LEFT JOIN locations dl ON dl.id = o.dest_location_id
       LEFT JOIN warehouses sw ON sw.id = sl.warehouse_id
       LEFT JOIN warehouses dw ON dw.id = dl.warehouse_id
       LEFT JOIN users u ON u.id = o.created_by
       LEFT JOIN users v ON v.id = o.validated_by
       WHERE o.id = $1`,
      [params.id]
    );
    if (!op.rows[0]) return err('NOT_FOUND', 'Operation not found', 404);

    const lines = await query(
      `SELECT ol.*, p.name AS product_name, p.sku, p.uom,
              sq.on_hand_qty, sq.reserved_qty
       FROM operation_lines ol
       JOIN products p ON p.id = ol.product_id
       LEFT JOIN stock_quants sq ON sq.product_id = ol.product_id
         AND sq.location_id = $2
       WHERE ol.operation_id = $1
       ORDER BY ol.created_at`,
      [params.id, op.rows[0].source_location_id || op.rows[0].dest_location_id]
    );
    return ok({ operation: op.rows[0], lines: lines.rows });
  } catch (e) { return handleApiError(e); }
}

// PUT /api/operations/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const body = UpdateOperationSchema.parse(await req.json());

    const existing = await query('SELECT status, type FROM operations WHERE id = $1', [params.id]);
    if (!existing.rows[0]) return err('NOT_FOUND', 'Operation not found', 404);
    if (['done','canceled'].includes(existing.rows[0].status))
      return err('CONFLICT', 'Cannot edit a completed or canceled operation', 409);

    await withTransaction(async (client) => {
      const updates: string[] = [];
      const vals: any[] = [];
      let i = 1;
      if (body.partner_name !== undefined) { updates.push(`partner_name = $${i++}`); vals.push(body.partner_name); }
      if (body.scheduled_date)             { updates.push(`scheduled_date = $${i++}`); vals.push(body.scheduled_date); }
      if (body.notes !== undefined)        { updates.push(`notes = $${i++}`); vals.push(body.notes); }
      if (body.source_location_id !== undefined) { updates.push(`source_location_id = $${i++}`); vals.push(body.source_location_id); }
      if (body.dest_location_id)           { updates.push(`dest_location_id = $${i++}`); vals.push(body.dest_location_id); }
      if (updates.length) {
        vals.push(params.id);
        await client.query(`UPDATE operations SET ${updates.join(',')} WHERE id = $${i}`, vals);
      }
      if (body.lines) {
        await client.query('DELETE FROM operation_lines WHERE operation_id = $1', [params.id]);
        for (const line of body.lines) {
          await client.query(
            `INSERT INTO operation_lines (operation_id, product_id, demand_qty, done_qty, adj_reason)
             VALUES ($1,$2,$3,$4,$5)`,
            [params.id, line.product_id, line.demand_qty, line.done_qty||0, line.adj_reason||null]
          );
        }
      }
    });
    return ok({ message: 'Operation updated' });
  } catch (e) { return handleApiError(e); }
}

// POST /api/operations/[id]/validate
export async function validateOp(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const res = await query(
      'SELECT validate_operation($1, $2) AS result',
      [params.id, user!.userId]
    );
    const result = res.rows[0].result;
    if (!result.ok) return err('VALIDATION_ERROR', result.error, 422);
    return ok({ message: `${result.reference} validated successfully` });
  } catch (e) { return handleApiError(e); }
}

// POST /api/operations/[id]/cancel
export async function cancelOp(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const existing = await query('SELECT status, reference FROM operations WHERE id = $1', [params.id]);
    if (!existing.rows[0]) return err('NOT_FOUND', 'Operation not found', 404);
    if (['done','canceled'].includes(existing.rows[0].status))
      return err('CONFLICT', `Cannot cancel a ${existing.rows[0].status} operation`, 409);
    await query(`UPDATE operations SET status = 'canceled' WHERE id = $1`, [params.id]);
    return ok({ message: `${existing.rows[0].reference} canceled` });
  } catch (e) { return handleApiError(e); }
}

// POST /api/operations/[id]/confirm
export async function confirmOp(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const existing = await query(
      `SELECT o.status, o.type, o.source_location_id,
              (SELECT COUNT(*) FROM operation_lines WHERE operation_id = o.id) AS line_count
       FROM operations o WHERE o.id = $1`,
      [params.id]
    );
    if (!existing.rows[0]) return err('NOT_FOUND', 'Operation not found', 404);
    if (existing.rows[0].status !== 'draft') return err('CONFLICT', 'Only draft operations can be confirmed', 409);
    if (Number(existing.rows[0].line_count) === 0) return err('VALIDATION_ERROR', 'Add at least one product line first', 422);

    // Check if source has stock for delivery/transfer
    let newStatus = 'waiting';
    if (['delivery','transfer'].includes(existing.rows[0].type) && existing.rows[0].source_location_id) {
      const stockCheck = await query(
        `SELECT ol.product_id,
                COALESCE(sq.on_hand_qty,0) >= ol.demand_qty AS sufficient
         FROM operation_lines ol
         LEFT JOIN stock_quants sq ON sq.product_id = ol.product_id AND sq.location_id = $2
         WHERE ol.operation_id = $1`,
        [params.id, existing.rows[0].source_location_id]
      );
      newStatus = stockCheck.rows.every(r => r.sufficient) ? 'ready' : 'waiting';
    } else {
      newStatus = 'waiting';
    }

    await query(`UPDATE operations SET status = $1 WHERE id = $2`, [newStatus, params.id]);
    return ok({ message: `Operation confirmed — status: ${newStatus}`, status: newStatus });
  } catch (e) { return handleApiError(e); }
}
