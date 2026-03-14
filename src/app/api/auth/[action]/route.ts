import { NextRequest } from 'next/server';
import { register, login, logout, forgotPassword, resetPassword, me, updateMe } from '../handlers';

export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const action = params.action;
  if (action === 'register')        return register(req);
  if (action === 'login')           return login(req);
  if (action === 'logout')          return logout();
  if (action === 'forgot-password') return forgotPassword(req);
  if (action === 'reset-password')  return resetPassword(req);
  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(req: NextRequest, { params }: { params: { action: string } }) {
  if (params.action === 'me') return me(req);
  return Response.json({ error: 'Not found' }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: { action: string } }) {
  if (params.action === 'me') return updateMe(req);
  return Response.json({ error: 'Not found' }, { status: 404 });
}
