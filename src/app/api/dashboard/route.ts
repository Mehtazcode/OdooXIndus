import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest, requireAuth } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const url = new URL(req.url);
    const warehouseId = url.searchParams.get('warehouse_id') || '';

    const locFilter = warehouseId
      ? `AND sq.location_id IN (SELECT id FROM locations WHERE warehouse_id = '${warehouseId}')`
      : '';

    const [kpisRes, lowRes, outRes, pendRecRes, pendDelRes, recentRes] = await Promise.all([
      // Total in-stock products
      query(`SELECT COUNT(DISTINCT p.id) AS total
             FROM products p
             JOIN stock_quants sq ON sq.product_id = p.id ${locFilter}
             WHERE p.is_active = TRUE AND sq.on_hand_qty > 0`),
      // Low stock
      query(`SELECT COUNT(DISTINCT p.id) AS cnt
             FROM products p
             JOIN stock_quants sq ON sq.product_id = p.id ${locFilter}
             WHERE p.is_active = TRUE AND p.reorder_min IS NOT NULL
               AND (SELECT COALESCE(SUM(sq2.on_hand_qty),0) FROM stock_quants sq2 WHERE sq2.product_id = p.id) > 0
               AND (SELECT COALESCE(SUM(sq2.on_hand_qty),0) FROM stock_quants sq2 WHERE sq2.product_id = p.id) <= p.reorder_min`),
      // Out of stock
      query(`SELECT COUNT(DISTINCT p.id) AS cnt
             FROM products p
             WHERE p.is_active = TRUE
               AND (SELECT COALESCE(SUM(sq.on_hand_qty),0) FROM stock_quants sq WHERE sq.product_id = p.id) = 0`),
      // Pending receipts
      query(`SELECT COUNT(*) AS cnt FROM operations WHERE type='receipt' AND status IN ('draft','waiting')`),
      // Pending deliveries
      query(`SELECT COUNT(*) AS cnt FROM operations WHERE type='delivery' AND status IN ('waiting','ready')`),
      // Recent ops
      query(`SELECT o.*,
               sl.name AS source_location_name, dl.name AS dest_location_name,
               u.name AS created_by_name
             FROM operations o
             LEFT JOIN locations sl ON sl.id = o.source_location_id
             LEFT JOIN locations dl ON dl.id = o.dest_location_id
             LEFT JOIN users u ON u.id = o.created_by
             ORDER BY o.created_at DESC LIMIT 10`),
    ]);

    return ok({
      kpis: {
        total_in_stock:     Number(kpisRes.rows[0]?.total || 0),
        low_stock_count:    Number(lowRes.rows[0]?.cnt || 0),
        out_of_stock_count: Number(outRes.rows[0]?.cnt || 0),
        pending_receipts:   Number(pendRecRes.rows[0]?.cnt || 0),
        pending_deliveries: Number(pendDelRes.rows[0]?.cnt || 0),
      },
      recent_operations: recentRes.rows,
    });
  } catch (e) { return handleApiError(e); }
}
