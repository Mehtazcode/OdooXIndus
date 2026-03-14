import { NextRequest } from 'next/server';
import { validateOp, cancelOp, confirmOp } from '../route';

export async function POST(req: NextRequest, { params }: { params: { id: string; action: string } }) {
  const p = { params: { id: params.id } };
  if (params.action === 'validate') return validateOp(req, p);
  if (params.action === 'cancel')   return cancelOp(req, p);
  if (params.action === 'confirm')  return confirmOp(req, p);
  return Response.json({ error: 'Not found' }, { status: 404 });
}
