import crypto from 'crypto';
import { getPool } from '@/lib/db';

const PASS_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export { PASS_TTL_MS, RESEND_COOLDOWN_MS, MAX_ATTEMPTS };

function secret(): string {
  return process.env.OTP_SECRET || 'dev_fallback_CHANGE_ME';
}

function passHash(passcode: string, email: string): string {
  return crypto.createHmac('sha256', secret()).update(`${passcode}:${email}`).digest('hex');
}

export function getAdminLoginEmail(): string {
  return String(process.env.ADMIN_LOGIN_EMAIL || '')
    .trim()
    .toLowerCase();
}

export async function getAdminPassState(email: string): Promise<{
  passHash: string;
  expiresAt: Date;
  failedAttempts: number;
  lastSentAt: Date;
} | null> {
  const pool = getPool();
  const [rows] = (await pool.query(
    'SELECT pass_hash, expires_at, failed_attempts, last_sent_at FROM admin_login_passes WHERE email = ? LIMIT 1',
    [email],
  )) as [Array<{ pass_hash: string; expires_at: Date; failed_attempts: number; last_sent_at: Date }>, unknown];

  if (!rows.length) return null;
  return {
    passHash: rows[0].pass_hash,
    expiresAt: new Date(rows[0].expires_at),
    failedAttempts: Number(rows[0].failed_attempts || 0),
    lastSentAt: new Date(rows[0].last_sent_at),
  };
}

export async function saveAdminPass(email: string, passcode: string): Promise<void> {
  const pool = getPool();
  const hash = passHash(passcode, email);
  const expiresAt = new Date(Date.now() + PASS_TTL_MS);

  await pool.query(
    `INSERT INTO admin_login_passes (email, pass_hash, expires_at, failed_attempts, last_sent_at)
     VALUES (?, ?, ?, 0, NOW())
     ON DUPLICATE KEY UPDATE
       pass_hash = VALUES(pass_hash),
       expires_at = VALUES(expires_at),
       failed_attempts = 0,
       last_sent_at = NOW(),
       updated_at = NOW()`,
    [email, hash, expiresAt],
  );
}

export async function verifyAdminPass(email: string, passcode: string): Promise<
  | { ok: true }
  | { ok: false; error: string; clear: boolean }
> {
  const state = await getAdminPassState(email);
  if (!state) {
    return { ok: false, error: 'No active pass session. Please generate a pass first.', clear: false };
  }

  if (Date.now() > state.expiresAt.getTime()) {
    return { ok: false, error: 'Pass expired. Please generate a new pass.', clear: true };
  }

  if (state.failedAttempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many incorrect attempts. Please generate a new pass.', clear: true };
  }

  const expected = passHash(passcode, email);
  let isMatch = false;
  try {
    const a = Buffer.from(state.passHash, 'hex');
    const b = Buffer.from(expected, 'hex');
    isMatch = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    isMatch = false;
  }

  if (isMatch) {
    return { ok: true };
  }

  const pool = getPool();
  await pool.query('UPDATE admin_login_passes SET failed_attempts = failed_attempts + 1, updated_at = NOW() WHERE email = ?', [email]);

  const remaining = Math.max(0, MAX_ATTEMPTS - (state.failedAttempts + 1));
  if (remaining <= 0) {
    return { ok: false, error: 'Too many incorrect attempts. Please generate a new pass.', clear: true };
  }
  return {
    ok: false,
    error: `Incorrect pass. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    clear: false,
  };
}

export async function clearAdminPass(email: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM admin_login_passes WHERE email = ?', [email]);
}
