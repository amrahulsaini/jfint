import { NextRequest, NextResponse } from 'next/server';
import { cacheGetJson, cacheSetJson } from '@/lib/cache';
import { verifySessionToken, SESSION_COOKIE, getActiveSessionRecord } from '@/lib/session';
import { getPool } from '@/lib/db';

const TRACKING_CACHE_TTL_SECONDS = 20;

export async function GET(req: NextRequest) {
  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;

  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const pool = getPool();

    const sess = await getActiveSessionRecord(sessionId);
    if (!sess) {
      return NextResponse.json({ error: 'Session expired. Please verify again.' }, { status: 401 });
    }

    const cacheKey = `tracking:v2:${String(sess.email || '').toLowerCase()}:${sessionId}`;
    const cached = await cacheGetJson<Record<string, unknown>>(cacheKey);
    if (cached) {
      const hit = NextResponse.json(cached);
      hit.headers.set('X-Cache', 'HIT');
      return hit;
    }

    // Full payment history — query by email (if known) OR session_id
    // so history from previous login sessions with same email is included
    const hasEmail = sess?.email && sess.email.length > 0;
    const [payRows] = await pool.query(
      `SELECT plan, roll_no, amount_paise, razorpay_order_id, razorpay_payment_id, expires_at, created_at
       FROM portal_payments
       WHERE session_id = ?${hasEmail ? ' OR (email IS NOT NULL AND email = ?)' : ''}
       ORDER BY created_at ASC`,
      hasEmail ? [sessionId, sess!.email] : [sessionId],
    ) as [unknown[], unknown];

    const payments = (payRows as {
      plan: string;
      roll_no: string | null;
      amount_paise: number;
      razorpay_order_id: string;
      razorpay_payment_id: string | null;
      expires_at: Date | null;
      created_at: Date;
    }[]).map(p => ({
      plan: p.plan,
      rollNo: p.roll_no,
      amountPaise: p.amount_paise,
      amountRupees: (p.amount_paise / 100).toFixed(2),
      orderId: p.razorpay_order_id,
      paymentId: p.razorpay_payment_id,
      expiresAt: p.expires_at ? p.expires_at.toISOString() : null,
      createdAt: p.created_at.toISOString(),
      isCoupon: p.razorpay_order_id === 'coupon',
    }));

    const payload = {
      sessionId: sessionId.slice(0, 8) + '…', // partial, for display only
      email: sess?.email ?? null,
      loginAt: sess?.createdAt ? sess.createdAt.toISOString() : null,
      sessionExpiresAt: sess?.expiresAt ? sess.expiresAt.toISOString() : null,
      ipAddress: sess?.ipAddress ?? null,
      payments,
      totalSpent: payments.reduce((sum, p) => sum + p.amountPaise, 0),
    };

    await cacheSetJson(cacheKey, payload, TRACKING_CACHE_TTL_SECONDS);
    const miss = NextResponse.json(payload);
    miss.headers.set('X-Cache', 'MISS');
    return miss;
  } catch (err) {
    console.error('[tracking]', err);
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}
