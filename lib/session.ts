/**
 * Session management — signed session ID stored in jfint_sid cookie.
 * The jfint_auth cookie continues to handle middleware auth (unchanged).
 * This session ID is used to key DB payment records.
 */
import crypto from 'crypto';
import { getPool } from '@/lib/db';

const SESSION_COOKIE = 'jfint_sid';
export { SESSION_COOKIE };

const SESSION_MINUTES = 30;
const SESSION_MS = SESSION_MINUTES * 60 * 1000;

function secret(): string {
  const s = process.env.OTP_SECRET;
  if (!s) throw new Error('OTP_SECRET is not configured');
  return s;
}

function hmac(sessionId: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(`sid:${sessionId}`)
    .digest('hex');
}

/**
 * Create a new signed session token.
 * Format: <64-hex-session-id>.<64-hex-HMAC>
 */
export function createSessionToken(): { sessionId: string; cookieValue: string } {
  const sessionId = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const cookieValue = `${sessionId}.${hmac(sessionId)}`;
  return { sessionId, cookieValue };
}

/**
 * Verify cookie value and extract session ID.
 * Returns the session ID string if valid, or null if tampered/missing.
 * Does NOT check DB — use for fast per-request validation.
 */
export function verifySessionToken(cookieValue: string): string | null {
  if (!cookieValue) return null;
  // Must be exactly: 64 hex + '.' + 64 hex = 129 chars total
  if (cookieValue.length !== 129) return null;
  const sessionId = cookieValue.slice(0, 64);
  const sig = cookieValue.slice(65);
  const expected = hmac(sessionId);
  try {
    const eBuf = Buffer.from(expected, 'hex');
    const sBuf = Buffer.from(sig, 'hex');
    if (eBuf.length !== sBuf.length || !crypto.timingSafeEqual(eBuf, sBuf)) return null;
  } catch { return null; }
  return sessionId;
}

/** Persist session to DB after successful login */
export async function saveSessionToDB(sessionId: string, ip: string, email: string): Promise<void> {
  const pool = getPool();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await pool.query(
    `INSERT INTO portal_sessions (id, expires_at, ip_address, email)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at), email = VALUES(email)`,
    [sessionId, expiresAt, ip, email]
  );
}

/** Get the email associated with a session ID */
export async function getSessionEmail(sessionId: string): Promise<string | null> {
  const session = await getActiveSessionRecord(sessionId);
  return session?.email ?? null;
}

export interface ActiveSessionRecord {
  email: string | null;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
}

/**
 * Returns active session metadata if the session is still valid.
 * Expired sessions are treated as non-existent.
 */
export async function getActiveSessionRecord(sessionId: string): Promise<ActiveSessionRecord | null> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT email, created_at, expires_at, ip_address
     FROM portal_sessions
     WHERE id = ? AND expires_at > NOW()
     LIMIT 1`,
    [sessionId]
  ) as [unknown[], unknown];
  const r = (rows as {
    email: string | null;
    created_at: Date;
    expires_at: Date;
    ip_address: string | null;
  }[])[0];
  if (!r) return null;
  return {
    email: r.email ?? null,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    ipAddress: r.ip_address ?? null,
  };
}

/** Remove session from DB on logout */
export async function deleteSessionFromDB(sessionId: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM portal_sessions WHERE id = ?', [sessionId]);
}

/** Clean up expired sessions (call occasionally, not on every request) */
export async function purgeExpiredSessions(): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM portal_sessions WHERE expires_at < NOW()');
}
