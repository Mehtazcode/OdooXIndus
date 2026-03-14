import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import {
  hashPassword, loginUser, requireAuth, getUserFromRequest,
  generateOtp, createOtp, verifyOtp, AuthError
} from '@/lib/auth';
import { ok, err, handleApiError, RegisterSchema, LoginSchema } from '@/lib/api';
import { z } from 'zod';

// POST /api/auth/register
export async function register(req: NextRequest) {
  try {
    const body = RegisterSchema.parse(await req.json());
    // Check duplicate email
    const exists = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [body.email]);
    if (exists.rows.length) return err('CONFLICT', 'Email already registered', 409, { email: 'Email already in use' });
    const hash = await hashPassword(body.password);
    const res = await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, role, created_at`,
      [body.name, body.email, hash, body.role]
    );
    return ok({ user: res.rows[0] }, 201);
  } catch (e) { return handleApiError(e); }
}

// POST /api/auth/login
export async function login(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());
    const { token, user } = await loginUser(body.email, body.password);
    const response = ok({ token, user });
    response.cookies.set('ci_token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/'
    });
    return response;
  } catch (e) { return handleApiError(e); }
}

// POST /api/auth/logout
export async function logout() {
  const response = ok({ message: 'Logged out' });
  response.cookies.set('ci_token', '', { maxAge: 0, path: '/' });
  return response;
}

// POST /api/auth/forgot-password
export async function forgotPassword(req: NextRequest) {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(await req.json());
    const res = await query('SELECT id, name FROM users WHERE lower(email) = lower($1) AND is_active = TRUE', [email]);
    if (!res.rows[0]) {
      // Always return 200 to prevent email enumeration
      return ok({ message: 'If that email exists, an OTP has been sent.' });
    }
    const otp = generateOtp();
    await createOtp(res.rows[0].id, otp);
    // In production send via nodemailer — here we return it for dev
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OTP for ${email}]: ${otp}`);
      return ok({ message: 'OTP sent.', dev_otp: otp });
    }
    // TODO: send via nodemailer (see scripts/mailer.ts)
    return ok({ message: 'If that email exists, an OTP has been sent.' });
  } catch (e) { return handleApiError(e); }
}

// POST /api/auth/reset-password
export async function resetPassword(req: NextRequest) {
  try {
    const { email, otp, new_password } = z.object({
      email:        z.string().email(),
      otp:          z.string().length(6, 'OTP must be 6 digits'),
      new_password: z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase').regex(/[0-9]/, 'Must contain number'),
    }).parse(await req.json());
    const res = await query('SELECT id FROM users WHERE lower(email) = lower($1) AND is_active = TRUE', [email]);
    if (!res.rows[0]) return err('NOT_FOUND', 'User not found', 404);
    const valid = await verifyOtp(res.rows[0].id, otp);
    if (!valid) return err('VALIDATION_ERROR', 'Invalid or expired OTP', 422, { otp: 'Invalid or expired OTP' });
    const hash = await hashPassword(new_password);
    await query(`UPDATE users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2`, [hash, res.rows[0].id]);
    return ok({ message: 'Password reset successfully' });
  } catch (e) { return handleApiError(e); }
}

// GET /api/auth/me
export async function me(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const res = await query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [user!.userId]
    );
    if (!res.rows[0]) return err('NOT_FOUND', 'User not found', 404);
    return ok({ user: res.rows[0] });
  } catch (e) { return handleApiError(e); }
}

// PATCH /api/auth/me
export async function updateMe(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    requireAuth(user);
    const body = z.object({
      name:         z.string().min(2).max(120).trim().optional(),
      email:        z.string().email().toLowerCase().trim().optional(),
      current_password: z.string().optional(),
      new_password:     z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/).optional(),
    }).parse(await req.json());

    if (body.new_password) {
      if (!body.current_password) return err('VALIDATION_ERROR', 'Current password required', 422);
      const res = await query('SELECT password_hash FROM users WHERE id = $1', [user!.userId]);
      const { verifyPassword } = await import('@/lib/auth');
      const valid = await verifyPassword(body.current_password, res.rows[0].password_hash);
      if (!valid) return err('VALIDATION_ERROR', 'Current password is incorrect', 422, { current_password: 'Incorrect password' });
      const newHash = await hashPassword(body.new_password);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user!.userId]);
    }

    if (body.name || body.email) {
      if (body.email) {
        const dup = await query('SELECT id FROM users WHERE lower(email) = lower($1) AND id != $2', [body.email, user!.userId]);
        if (dup.rows.length) return err('CONFLICT', 'Email already in use', 409, { email: 'Email already in use' });
      }
      const updates: string[] = [];
      const vals: any[] = [];
      let i = 1;
      if (body.name)  { updates.push(`name = $${i++}`);  vals.push(body.name); }
      if (body.email) { updates.push(`email = $${i++}`); vals.push(body.email); }
      vals.push(user!.userId);
      if (updates.length) {
        await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`, vals);
      }
    }
    return ok({ message: 'Profile updated' });
  } catch (e) { return handleApiError(e); }
}
