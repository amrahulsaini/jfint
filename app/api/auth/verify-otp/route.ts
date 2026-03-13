import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, saveSessionToDB, SESSION_COOKIE } from '@/lib/session';
import { clearAdminPass, getAdminLoginEmail, verifyAdminPass } from '@/lib/login-pass';

const SESSION_MINUTES = 20;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const otp = String(body?.passcode || body?.otp || '').trim();

    const loginEmail = getAdminLoginEmail();
    if (!loginEmail) {
      return NextResponse.json({ error: 'ADMIN_LOGIN_EMAIL is not configured.' }, { status: 500 });
    }

    const result = await verifyAdminPass(loginEmail, otp);

    if (!result.ok) {
      if (result.clear) {
        try { await clearAdminPass(loginEmail); } catch { /* no-op */ }
      }
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // OTP valid — create signed session ID and persist to DB
    const { sessionId, cookieValue } = createSessionToken();
    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for') ||
      '127.0.0.1';
    try { await saveSessionToDB(sessionId, ip, loginEmail); } catch (e) { console.error('[verify-otp] DB session save failed', e); }

    const res = NextResponse.json({ success: true });
    const expiryMs = Date.now() + SESSION_MINUTES * 60 * 1000;
    // Auth cookie — fixed 20-min session, expiry does NOT slide on navigation
    res.cookies.set('jfint_auth', process.env.AUTH_PASSWORD!, {
      httpOnly: true, sameSite: 'lax', maxAge: SESSION_MINUTES * 60, path: '/',
    });
    // Non-httpOnly expiry timestamp so the client timer can count down accurately
    res.cookies.set('jfint_auth_exp', String(expiryMs), {
      httpOnly: false, sameSite: 'lax', maxAge: SESSION_MINUTES * 60, path: '/',
    });
    // Session ID cookie — browser session cookie (no maxAge), used to key DB payments
    res.cookies.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true, sameSite: 'lax', path: '/',
    });
    return res;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
