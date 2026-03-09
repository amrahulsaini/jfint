import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';
import { getPool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;

  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const pool = getPool();

    // Session info
    const [sessRows] = await pool.query(
      'SELECT email, created_at, expires_at, ip_address FROM portal_sessions WHERE id = ? LIMIT 1',
      [sessionId],
    ) as [unknown[], unknown];
    const sess = (sessRows as { email: string | null; created_at: Date; expires_at: Date; ip_address: string | null }[])[0] ?? null;

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

    return NextResponse.json({
      sessionId: sessionId.slice(0, 8) + '…', // partial, for display only
      email: sess?.email ?? null,
      loginAt: sess?.created_at ? sess.created_at.toISOString() : null,
      sessionExpiresAt: sess?.expires_at ? sess.expires_at.toISOString() : null,
      ipAddress: sess?.ip_address ?? null,
      payments,
      totalSpent: payments.reduce((sum, p) => sum + p.amountPaise, 0),
    });
  } catch (err) {
    console.error('[tracking]', err);
    return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
  }
}
