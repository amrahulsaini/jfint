import { NextRequest, NextResponse } from 'next/server';
import { getActiveSessionRecord, SESSION_COOKIE, verifySessionToken } from '@/lib/session';

const VERIFIED_COOKIE = 'jfint_student_verified';

export async function GET(req: NextRequest) {
  const verified = String(req.cookies.get(VERIFIED_COOKIE)?.value || '').trim().toLowerCase();
  if (!verified || !verified.endsWith('@jecrc.ac.in')) {
    return NextResponse.json({ verified: false });
  }

  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;
  if (!sessionId) {
    return NextResponse.json({ verified: false });
  }

  const session = await getActiveSessionRecord(sessionId).catch(() => null);
  if (!session?.email || session.email.toLowerCase() !== verified) {
    return NextResponse.json({ verified: false });
  }

  return NextResponse.json({
    verified: true,
    email: verified,
    sessionExpiresAt: session.expiresAt.toISOString(),
  });
}
