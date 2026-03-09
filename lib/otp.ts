/**
 * Secure OTP cookie utilities.
 * The OTP state is stored in a tamper-proof signed HttpOnly cookie — no database needed.
 */
import crypto from 'crypto';

const SECRET = () => process.env.OTP_SECRET || 'dev_fallback_CHANGE_ME';

// ── Internal helpers ──────────────────────────────────────────────────────────

function sign(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function unsign(token: string): object | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET()).update(b64).digest('base64url');
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch { return null; }
  try { return JSON.parse(Buffer.from(b64, 'base64url').toString()); }
  catch { return null; }
}

function hashOtp(otp: string, email: string): string {
  return crypto.createHmac('sha256', SECRET()).update(`${otp}:${email}`).digest('hex');
}

// ── Pw-verified cookie ────────────────────────────────────────────────────────

/** Value that proves the password step was completed. */
export function pwVerifiedToken(): string {
  return crypto.createHmac('sha256', SECRET()).update('pw_step_ok').digest('hex');
}

export function validatePwVerifiedToken(value: string): boolean {
  const expected = pwVerifiedToken();
  try {
    if (value.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

// ── OTP state cookie ──────────────────────────────────────────────────────────

export interface OtpState {
  email: string;
  hash: string;    // HMAC(otp:email)
  exp: number;     // expiry ms
  att: number;     // failed attempts so far
  iss: number;     // issued at ms (resend cooldown)
}

export const OTP_TTL_MS = 5 * 60 * 1000;       // OTP valid for 5 min
export const RESEND_COOLDOWN_MS = 60 * 1000;    // 60s between resends
export const MAX_ATTEMPTS = 5;

export function createOtpCookie(email: string, otp: string): string {
  const now = Date.now();
  const state: OtpState = {
    email,
    hash: hashOtp(otp, email),
    exp: now + OTP_TTL_MS,
    att: 0,
    iss: now,
  };
  return sign(state);
}

export function readOtpCookie(cookie: string): OtpState | null {
  return unsign(cookie) as OtpState | null;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string; updatedCookie?: string };

export function verifyOtp(cookie: string, otp: string, email: string): VerifyResult {
  const state = readOtpCookie(cookie);
  if (!state) return { ok: false, error: 'Session expired. Please start over.' };
  if (Date.now() > state.exp) return { ok: false, error: 'OTP expired. Please request a new one.' };
  if (state.email !== email) return { ok: false, error: 'Email mismatch.' };
  if (state.att >= MAX_ATTEMPTS) return { ok: false, error: 'Too many attempts. Please request a new OTP.' };

  const expected = hashOtp(otp, email);
  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(state.hash, 'hex'),
      Buffer.from(expected, 'hex'),
    );
    if (match) return { ok: true };
  } catch { /* fall through */ }

  const remaining = MAX_ATTEMPTS - (state.att + 1);
  const updated = sign({ ...state, att: state.att + 1 });
  return {
    ok: false,
    error: remaining > 0
      ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      : 'Too many incorrect attempts. Please request a new OTP.',
    updatedCookie: updated,
  };
}

/** Generates a cryptographically secure 6-digit OTP. */
export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}
