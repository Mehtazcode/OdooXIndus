import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { getUserFromRequest, requireAuth, requireManager } from '@/lib/auth';
import { ok, err, handleApiError, CategorySchema } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const res = await query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
       GROUP BY c.id ORDER BY c.name`
    );
    return ok({ categories: res.rows });
  } catch (e) { return handleApiError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireManager(user);
    const body = CategorySchema.parse(await req.json());
    const res = await query(
      `INSERT INTO categories (name, code, description) VALUES ($1,$2,$3) RETURNING *`,
      [body.name, body.code || null, body.description || null]
    );
    return ok({ category: res.rows[0] }, 201);
  } catch (e) { return handleApiError(e); }
}
