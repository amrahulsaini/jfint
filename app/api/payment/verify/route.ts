import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addPaidEntry, PAID_COOKIE } from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roll_no } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !roll_no) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret.startsWith('YOUR_')) {
      return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 });
    }

    // Verify HMAC-SHA256 signature as required by Razorpay
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    const expBuf = Buffer.from(expectedSig, 'hex');
    const gotBuf = Buffer.from(razorpay_signature, 'hex');

    if (expBuf.length !== gotBuf.length || !crypto.timingSafeEqual(expBuf, gotBuf)) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    const res = NextResponse.json({ success: true });

    // Session cookie — no maxAge/expires, browser deletes it when closed
    res.cookies.set(PAID_COOKIE, addPaidEntry(existing, roll_no), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[verify-payment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
