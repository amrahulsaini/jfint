import { NextRequest, NextResponse } from 'next/server';

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

    // Coupon is valid — client will handle unlocking the pending student
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[apply-coupon]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
