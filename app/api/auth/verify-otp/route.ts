import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { createSessionToken, saveSessionToDB, SESSION_COOKIE } from '@/lib/session';

const SESSION_MINUTES = 20;

export async function POST(req: NextRequest) {
  try {
    const { otp, email } = await req.json();

    const otpCookie = req.cookies.get('jfint_otp_state')?.value;
    if (!otpCookie) {
      return NextResponse.json({ error: 'No active OTP session. Please request a code first.' }, { status: 401 });
    }

    const result = verifyOtp(otpCookie, String(otp || '').trim(), String(email || '').trim().toLowerCase());

    if (!result.ok) {
      const res = NextResponse.json({ error: result.error }, { status: 401 });
      if (result.updatedCookie) {
        res.cookies.set('jfint_otp_state', result.updatedCookie, {
          httpOnly: true, sameSite: 'lax', maxAge: 5 * 60, path: '/',
        });
      } else {
        res.cookies.set('jfint_otp_state', '', { httpOnly: true, maxAge: 0, path: '/' });
      }
      return res;
    }

    // OTP valid — create signed session ID and persist to DB
    const { sessionId, cookieValue } = createSessionToken();
    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for') ||
      '127.0.0.1';
    try { await saveSessionToDB(sessionId, ip); } catch (e) { console.error('[verify-otp] DB session save failed', e); }

    const res = NextResponse.json({ success: true });
    // Auth cookie (middleware check — sliding 20 min)
    res.cookies.set('jfint_auth', process.env.AUTH_PASSWORD!, {
      httpOnly: true, sameSite: 'lax', maxAge: SESSION_MINUTES * 60, path: '/',
    });
    // Session ID cookie — browser session cookie (no maxAge), used to key DB payments
    res.cookies.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true, sameSite: 'lax', path: '/',
    });
    // Clear OTP intermediate cookies
    res.cookies.set('jfint_pw_verified', '', { httpOnly: true, maxAge: 0, path: '/' });
    res.cookies.set('jfint_otp_state', '', { httpOnly: true, maxAge: 0, path: '/' });
    return res;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
