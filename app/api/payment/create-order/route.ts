import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

let razorpay: Razorpay | null = null;

function getRazorpay() {
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return razorpay;
}

/** GET — returns configured price without creating an order */
export async function GET(_req: NextRequest) {
  const amountPaise = parseInt(process.env.PAYMENT_AMOUNT_PAISE || '500', 10);
  return NextResponse.json({ amountPaise, amountRupees: amountPaise / 100 });
}

/** POST — creates a real Razorpay order */
export async function POST(_req: NextRequest) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || keyId.startsWith('YOUR_') || !keySecret || keySecret.startsWith('YOUR_')) {
      return NextResponse.json(
        { error: 'Razorpay is not configured yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in env.' },
        { status: 503 }
      );
    }

    const amountPaise = parseInt(process.env.PAYMENT_AMOUNT_PAISE || '500', 10);

    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (err) {
    console.error('[create-order]', err);
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
  }
}
