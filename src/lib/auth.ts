import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';
import { NextRequest } from 'next/server';

const JWT_SECRET  = process.env.JWT_SECRET!;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'manager' | 'staff';
  name: string;
}

// ─── Password helpers ────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── JWT helpers ─────────────────────────────────────────────
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES } as any);
}
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// ─── Extract user from request ───────────────────────────────
export function getUserFromRequest(req: NextRequest): JWTPayload | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return verifyToken(auth.slice(7));
  }
  // Also check cookie for SSR pages
  const cookie = req.cookies.get('ci_token')?.value;
  if (cookie) return verifyToken(cookie);
  return null;
}

// ─── Require auth middleware ─────────────────────────────────
export function requireAuth(user: JWTPayload | null): void {
  if (!user) throw new AuthError('Unauthorized', 401);
}
export function requireManager(user: JWTPayload | null): void {
  requireAuth(user);
  if (user!.role !== 'manager') throw new AuthError('Forbidden — manager role required', 403);
}

// ─── Login logic with lockout ────────────────────────────────
export async function loginUser(email: string, password: string) {
  const res = await query(
    `SELECT id, name, email, password_hash, role, is_active, failed_attempts, locked_until
     FROM users WHERE lower(email) = lower($1)`,
    [email.trim()]
  );
  const user = res.rows[0];

  if (!user || !user.is_active) {
    throw new AuthError('Invalid email or password', 401);
  }

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    throw new AuthError(`Account locked. Try again in ${remaining} minute(s).`, 429);
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    const newAttempts = user.failed_attempts + 1;
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      await query(
        `UPDATE users SET failed_attempts = $1, locked_until = NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes' WHERE id = $2`,
        [newAttempts, user.id]
      );
      throw new AuthError(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`, 429);
    }
    await query(`UPDATE users SET failed_attempts = $1 WHERE id = $2`, [newAttempts, user.id]);
    throw new AuthError('Invalid email or password', 401);
  }

  // Reset failed attempts on success
  await query(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);

  const payload: JWTPayload = { userId: user.id, email: user.email, role: user.role, name: user.name };
  return { token: signToken(payload), user: payload };
}

// ─── Custom error ────────────────────────────────────────────
export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── OTP helpers ─────────────────────────────────────────────
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
export async function createOtp(userId: string, otp: string): Promise<void> {
  const hash = await bcrypt.hash(otp, 10);
  // Invalidate existing active OTPs
  await query(`DELETE FROM otp_tokens WHERE user_id = $1 AND used_at IS NULL`, [userId]);
  // Insert new OTP (10-minute expiry)
  await query(
    `INSERT INTO otp_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
    [userId, hash]
  );
}
export async function verifyOtp(userId: string, otp: string): Promise<boolean> {
  const res = await query(
    `SELECT id, token_hash FROM otp_tokens
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (!res.rows[0]) return false;
  const valid = await bcrypt.compare(otp, res.rows[0].token_hash);
  if (valid) {
    await query(`UPDATE otp_tokens SET used_at = NOW() WHERE id = $1`, [res.rows[0].id]);
  }
  return valid;
}
