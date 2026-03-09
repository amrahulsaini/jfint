import { NextRequest, NextResponse } from 'next/server';
import { addPaidEntry, PAID_COOKIE } from '@/lib/payment';

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

    const res = NextResponse.json({ success: true });

    // Session cookie — no maxAge/expires, browser deletes it when closed
    const existing = req.cookies.get(PAID_COOKIE)?.value;
    res.cookies.set(PAID_COOKIE, addPaidEntry(existing, '*'), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[apply-coupon]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
