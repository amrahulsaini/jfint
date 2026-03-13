import { NextRequest, NextResponse } from 'next/server';
import { OTP_TTL_MS, verifyOtp } from '@/lib/otp';
import { createSessionToken, saveSessionToDB, SESSION_COOKIE } from '@/lib/session';

const SESSION_MINUTES = 20;
const LOGIN_EMAIL = 'rahulsaini.cse28@jecrc.ac.in';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const otp = String(body?.passcode || body?.otp || '').trim();

    const otpCookie = req.cookies.get('jfint_otp_state')?.value;
    if (!otpCookie) {
      return NextResponse.json({ error: 'No active pass session. Please generate a pass first.' }, { status: 401 });
    }

    const result = verifyOtp(otpCookie, otp, LOGIN_EMAIL);

    if (!result.ok) {
      const res = NextResponse.json({ error: result.error }, { status: 401 });
      if (result.updatedCookie) {
        res.cookies.set('jfint_otp_state', result.updatedCookie, {
          httpOnly: true, sameSite: 'lax', maxAge: Math.floor(OTP_TTL_MS / 1000), path: '/',
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
    try { await saveSessionToDB(sessionId, ip, LOGIN_EMAIL); } catch (e) { console.error('[verify-otp] DB session save failed', e); }

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
    // Clear temporary pass cookie after successful verification.
    res.cookies.set('jfint_otp_state', '', { httpOnly: true, maxAge: 0, path: '/' });
    return res;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
