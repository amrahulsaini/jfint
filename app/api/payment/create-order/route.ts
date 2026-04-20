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

/**
 * GET — returns pricing for both plans.
 * plan=single : PAYMENT_AMOUNT_PAISE (per student, no expiry)
 * plan=all    : ALL_ACCESS_AMOUNT_PAISE (default 20000 = ₹200, valid 2 hours)
 */
export async function GET(_req: NextRequest) {
  const singlePaise = parseInt(process.env.PAYMENT_AMOUNT_PAISE || '1000', 10);
  const allPaise = parseInt(process.env.ALL_ACCESS_AMOUNT_PAISE || '1000', 10);
  return NextResponse.json({
    single: { amountPaise: singlePaise, amountRupees: singlePaise / 100 },
    all:    { amountPaise: allPaise,    amountRupees: allPaise / 100, durationHours: 2 },
    // Legacy field kept for backward compat with old client code
    amountPaise: singlePaise,
    amountRupees: singlePaise / 100,
  });
}

/** POST — creates a Razorpay order for the given plan */
export async function POST(req: NextRequest) {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || keyId.startsWith('YOUR_') || !keySecret || keySecret.startsWith('YOUR_')) {
      return NextResponse.json(
        { error: 'Razorpay is not configured yet.' },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({})) as { plan?: string };
    const plan = body.plan === 'all' ? 'all' : 'single';
    const amountPaise = plan === 'all'
      ? parseInt(process.env.ALL_ACCESS_AMOUNT_PAISE || '1000', 10)
      : parseInt(process.env.PAYMENT_AMOUNT_PAISE || '1000', 10);

    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { plan },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      plan,
    });
  } catch (err) {
    console.error('[create-order]', err);
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
  }
}
