import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/payment';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';

export async function GET(req: NextRequest) {
  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;

  if (!sessionId) {
    // No session = not logged in properly yet, return empty state
    return NextResponse.json({ allAccess: false, allAccessExpiresAt: null, paidRolls: [] });
  }

  try {
    const status = await getPaymentStatus(sessionId);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[payment/status]', err);
    return NextResponse.json({ allAccess: false, allAccessExpiresAt: null, paidRolls: [] });
  }
}
