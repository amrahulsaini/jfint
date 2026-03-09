import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/payment';
import { verifySessionToken, SESSION_COOKIE, getSessionEmail } from '@/lib/session';

export async function GET(req: NextRequest) {
  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;

  if (!sessionId) {
    return NextResponse.json({ allAccess: false, allAccessExpiresAt: null, paidRolls: [] });
  }

  try {
    // Get email so we can find payments from previous sessions with same email
    const email = await getSessionEmail(sessionId).catch(() => null);
    const status = await getPaymentStatus(sessionId, email);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[payment/status]', err);
    return NextResponse.json({ allAccess: false, allAccessExpiresAt: null, paidRolls: [] });
  }
}
