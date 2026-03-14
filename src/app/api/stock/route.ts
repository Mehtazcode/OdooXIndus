import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest, requireAuth } from '@/lib/auth';
import { ok, handleApiError, PaginationSchema } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const url = new URL(req.url);
    const { page, limit } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const offset    = (page - 1) * limit;
    const search    = url.searchParams.get('search') || '';
    const opType    = url.searchParams.get('type') || '';
    const productId = url.searchParams.get('product_id') || '';
    const fromDate  = url.searchParams.get('from_date') || '';
    const toDate    = url.searchParams.get('to_date') || '';
    const exportCsv = url.searchParams.get('export') === 'csv';

    const conditions: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (opType)    { conditions.push(`o.type = $${i++}`); vals.push(opType); }
    if (productId) { conditions.push(`sm.product_id = $${i++}`); vals.push(productId); }
    if (fromDate)  { conditions.push(`sm.moved_at >= $${i++}`); vals.push(fromDate); }
    if (toDate)    { conditions.push(`sm.moved_at <= $${i++}::DATE + INTERVAL '1 day'`); vals.push(toDate); }
    if (search)    { conditions.push(`(o.reference ILIKE $${i} OR p.name ILIKE $${i} OR p.sku ILIKE $${i})`); vals.push(`%${search}%`); i++; }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT sm.id, sm.qty, sm.moved_at,
        p.name AS product_name, p.sku, p.uom,
        fl.name AS from_location, tl.name AS to_location,
        o.reference, o.type AS op_type,
        u.name AS moved_by_name
      FROM stock_moves sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN locations fl ON fl.id = sm.from_location_id
      LEFT JOIN locations tl ON tl.id = sm.to_location_id
      LEFT JOIN operations o ON o.id = sm.operation_id
      LEFT JOIN users u ON u.id = sm.moved_by
      ${where}
      ORDER BY sm.moved_at DESC
      ${exportCsv ? '' : `LIMIT $${i} OFFSET $${i+1}`}`;

    if (!exportCsv) vals.push(limit, offset);
    const [rows, countRes] = await Promise.all([
      query(sql, vals),
      query(`SELECT COUNT(*) FROM stock_moves sm LEFT JOIN operations o ON o.id = sm.operation_id LEFT JOIN products p ON p.id = sm.product_id ${where}`, vals.slice(0, exportCsv ? undefined : -2)),
    ]);

    if (exportCsv) {
      const headers = ['Date','Reference','Type','Product','SKU','From','To','Qty','UoM','By'];
      const csvRows = [headers.join(',')];
      for (const r of rows.rows) {
        csvRows.push([
          `"${r.moved_at}"`, `"${r.reference||''}"`, `"${r.op_type||''}"`,
          `"${r.product_name}"`, `"${r.sku}"`, `"${r.from_location}"`,
          `"${r.to_location}"`, r.qty, `"${r.uom}"`, `"${r.moved_by_name||''}"`
        ].join(','));
      }
      return new Response(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="stock_moves_${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return ok({ moves: rows.rows, total: Number(countRes.rows[0].count), page, limit });
  } catch (e) { return handleApiError(e); }
}
