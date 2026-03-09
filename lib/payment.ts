/**
 * Payment management — all payment records stored in `portal_payments` DB table.
 * Keyed by session_id from the `jfint_sid` cookie.
 *
 * Plans:
 *  - 'single' : access to one specific roll_no (amount from PAYMENT_AMOUNT_PAISE env)
 *  - 'all'    : access to all roll numbers for 2 hours (amount from ALL_ACCESS_AMOUNT_PAISE env, default ₹200)
 */
import { getPool } from '@/lib/db';

// Duration that the 'all' plan (and coupon) grants access
export const ALL_ACCESS_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─────────────────────────── Write helpers ───────────────────────────────────

/** Save a verified single-student payment to DB */
export async function saveSinglePayment(
  sessionId: string,
  rollNo: string,
  orderId: string,
  paymentId: string,
  amountPaise: number,
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO portal_payments
       (session_id, razorpay_order_id, razorpay_payment_id, plan, roll_no, amount_paise)
     VALUES (?, ?, ?, 'single', ?, ?)`,
    [sessionId, orderId, paymentId, rollNo, amountPaise],
  );
}

/** Save a verified all-access payment to DB (expires in 2 h) */
export async function saveAllAccessPayment(
  sessionId: string,
  orderId: string,
  paymentId: string,
  amountPaise: number,
): Promise<void> {
  const pool = getPool();
  const expiresAt = new Date(Date.now() + ALL_ACCESS_DURATION_MS);
  await pool.query(
    `INSERT INTO portal_payments
       (session_id, razorpay_order_id, razorpay_payment_id, plan, roll_no, amount_paise, expires_at)
     VALUES (?, ?, ?, 'all', NULL, ?, ?)`,
    [sessionId, orderId, paymentId, amountPaise, expiresAt],
  );
}

/** Save a coupon-based all-access grant to DB (expires in 2 h, zero amount) */
export async function saveCouponAccess(sessionId: string): Promise<void> {
  const pool = getPool();
  const expiresAt = new Date(Date.now() + ALL_ACCESS_DURATION_MS);
  await pool.query(
    `INSERT INTO portal_payments
       (session_id, razorpay_order_id, razorpay_payment_id, plan, roll_no, amount_paise, expires_at)
     VALUES (?, 'coupon', NULL, 'all', NULL, 0, ?)`,
    [sessionId, expiresAt],
  );
}

// ─────────────────────────── Read helpers ────────────────────────────────────

/** Returns true if sessionId has paid for rollNo (or has a valid all-access plan) */
export async function isRollAccessible(sessionId: string, rollNo: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT 1 FROM portal_payments
     WHERE session_id = ?
       AND (
         (plan = 'single' AND roll_no = ?)
         OR
         (plan = 'all' AND (expires_at IS NULL OR expires_at > NOW()))
       )
     LIMIT 1`,
    [sessionId, rollNo],
  ) as [unknown[], unknown];
  return (rows as unknown[]).length > 0;
}

/** Return current payment status for status API response */
export async function getPaymentStatus(sessionId: string): Promise<{
  allAccess: boolean;
  allAccessExpiresAt: string | null;
  paidRolls: string[];
}> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT plan, roll_no, expires_at FROM portal_payments WHERE session_id = ?`,
    [sessionId],
  ) as [unknown[], unknown];

  const entries = rows as { plan: string; roll_no: string | null; expires_at: Date | null }[];
  const now = new Date();
  let allAccess = false;
  let allAccessExpiresAt: string | null = null;
  const paidRolls: string[] = [];

  for (const e of entries) {
    if (e.plan === 'all') {
      if (!e.expires_at || e.expires_at > now) {
        allAccess = true;
        allAccessExpiresAt = e.expires_at ? e.expires_at.toISOString() : null;
      }
    } else if (e.plan === 'single' && e.roll_no) {
      paidRolls.push(e.roll_no);
    }
  }

  return { allAccess, allAccessExpiresAt, paidRolls };
}

// ─────────────────────────── Legacy (cookie) shim ────────────────────────────
// Kept so TypeScript doesn't break any old import that might still reference these.
// These are no-ops and will be removed in a future cleanup.
export const PAID_COOKIE = 'jfint_paid'; // obsolete — sessions now use jfint_sid
/** @deprecated Use DB-backed isRollAccessible() instead */
export function isRollNoPaid(_cookie: string | undefined, _rollNo: string): boolean { return false; }
/** @deprecated */
export function addPaidEntry(current: string | undefined, _rollNo: string): string { return current ?? ''; }
/** @deprecated */
export function getPaidEntries(_cookie: string | undefined): { r: string; exp: number }[] { return []; }
