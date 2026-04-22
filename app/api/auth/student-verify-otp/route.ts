import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { createSessionToken, saveSessionToDB, SESSION_COOKIE } from '@/lib/session';

const OTP_COOKIE = 'jfint_student_otp';
const VERIFIED_COOKIE = 'jfint_student_verified';
const SESSION_MINUTES = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const otp = String(body?.otp || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!email || !email.endsWith('@jecrc.ac.in')) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }

    const cookieToken = req.cookies.get(OTP_COOKIE)?.value;
    if (!cookieToken) {
      return NextResponse.json({ error: 'OTP session expired. Please request a new code.' }, { status: 401 });
    }

    const result = verifyOtp(cookieToken, otp, email);

    if (!result.ok) {
      const failRes = NextResponse.json({ error: result.error }, { status: 401 });
      if (result.updatedCookie) {
        failRes.cookies.set(OTP_COOKIE, result.updatedCookie, {
          httpOnly: true, sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60, path: '/',
        });
      } else {
        failRes.cookies.set(OTP_COOKIE, '', { maxAge: 0, path: '/' });
      }
      return failRes;
    }

    const { sessionId, cookieValue } = createSessionToken();
    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for') ||
      '127.0.0.1';
    try {
      await saveSessionToDB(sessionId, ip, email);
    } catch (e) {
      console.error('[student-verify-otp] DB session save failed', e);
      return NextResponse.json({ error: 'Unable to start session. Please try again.' }, { status: 500 });
    }

    // Verified — issue 30-minute session cookies.
    const res = NextResponse.json({ success: true });
    res.cookies.set(VERIFIED_COOKIE, email, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MINUTES * 60,
      path: '/',
    });
    res.cookies.set(SESSION_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MINUTES * 60,
      path: '/',
    });
    res.cookies.set(OTP_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  } catch (err) {
    console.error('[student-verify-otp]', err);
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
