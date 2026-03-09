import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, deleteSessionFromDB, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: NextRequest) {
  // Delete session from DB
  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (sidCookie) {
    const sessionId = verifySessionToken(sidCookie);
    if (sessionId) {
      try { await deleteSessionFromDB(sessionId); } catch { /* ignore */ }
    }
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set('jfint_auth', '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  res.cookies.set('jfint_paid', '', { httpOnly: true, maxAge: 0, path: '/' }); // clear legacy cookie
  return res;
}
