import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { saveSinglePayment, saveAllAccessPayment } from '@/lib/payment';
import { verifySessionToken, SESSION_COOKIE, getSessionEmail } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roll_no, plan } =
      await req.json() as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        roll_no?: string;
        plan?: string;
      };

    const paymentPlan = plan === 'all' ? 'all' : 'single';

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
    }
    if (paymentPlan === 'single' && !roll_no) {
      return NextResponse.json({ error: 'roll_no is required for single plan' }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret.startsWith('YOUR_')) {
      return NextResponse.json({ error: 'Razorpay not configured' }, { status: 503 });
    }

    // Verify Razorpay HMAC-SHA256 signature
    const sigBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = crypto.createHmac('sha256', keySecret).update(sigBody).digest('hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    const gotBuf = Buffer.from(razorpay_signature, 'hex');
    if (expBuf.length !== gotBuf.length || !crypto.timingSafeEqual(expBuf, gotBuf)) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // Get session ID from cookie
    const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;
    if (!sessionId) {
      return NextResponse.json({ error: 'No valid session — please log in again' }, { status: 401 });
    }

    // Determine amount from env
    const amountPaise = paymentPlan === 'all'
      ? parseInt(process.env.ALL_ACCESS_AMOUNT_PAISE || '20000', 10)
      : parseInt(process.env.PAYMENT_AMOUNT_PAISE || '500', 10);

    // Persist to DB
    const email = await getSessionEmail(sessionId).catch(() => null);
    if (paymentPlan === 'all') {
      await saveAllAccessPayment(sessionId, email, razorpay_order_id, razorpay_payment_id, amountPaise);
    } else {
      await saveSinglePayment(sessionId, email, roll_no!, razorpay_order_id, razorpay_payment_id, amountPaise);
    }

    return NextResponse.json({ success: true, plan: paymentPlan });
  } catch (err) {
    console.error('[verify-payment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
