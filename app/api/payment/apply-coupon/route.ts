import { NextRequest, NextResponse } from 'next/server';
import { saveCouponAccess } from '@/lib/payment';
import { verifySessionToken, SESSION_COOKIE, getSessionEmail } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { coupon } = await req.json();

    if (!coupon || typeof coupon !== 'string') {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    const validCode = process.env.COUPON_CODE;
    if (!validCode) {
      return NextResponse.json({ error: 'Coupons are not enabled' }, { status: 503 });
    }
    if (coupon.trim() !== validCode) {
      return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
    }

    // Get session ID
    const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;
    if (!sessionId) {
      return NextResponse.json({ error: 'No valid session — please log in again' }, { status: 401 });
    }

    const email = await getSessionEmail(sessionId).catch(() => null);
    await saveCouponAccess(sessionId, email);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[apply-coupon]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
