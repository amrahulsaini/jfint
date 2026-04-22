import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatus } from '@/lib/payment';
import { verifySessionToken, SESSION_COOKIE, getActiveSessionRecord } from '@/lib/session';

export async function GET(req: NextRequest) {
  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;

  if (!sessionId) {
    return NextResponse.json({ allAccess: false, allAccessExpiresAt: null, paidRolls: [] });
  }

  try {
    const session = await getActiveSessionRecord(sessionId);
    if (!session) {
      return NextResponse.json({ allAccess: false, allAccessExpiresAt: null, paidRolls: [] });
    }
    // Get email so we can find payments from previous sessions with same email
    const status = await getPaymentStatus(sessionId, session.email);
    return NextResponse.json(status);
  } catch (err) {
    console.error('[payment/status]', err);
    return NextResponse.json({ allAccess: false, allAccessExpiresAt: null, paidRolls: [] });
  }
}
