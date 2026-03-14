import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './src/lib/auth';

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  // Allow static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname === '/') return NextResponse.next();

  const token = req.cookies.get('ci_token')?.value || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    // API routes return 401, pages redirect to login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`/login?returnUrl=${encodeURIComponent(pathname)}`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
