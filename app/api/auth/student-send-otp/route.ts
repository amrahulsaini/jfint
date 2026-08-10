import { NextRequest, NextResponse } from 'next/server';
import { createOtpCookie, generateOtp, readOtpCookie, RESEND_COOLDOWN_MS } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/mailer';
import { isOtpDisabled } from '@/lib/otp-mode';
import { createSessionToken, saveSessionToDB, SESSION_COOKIE } from '@/lib/session';

const OTP_COOKIE = 'jfint_student_otp';
const VERIFIED_COOKIE = 'jfint_student_verified';
const SESSION_MINUTES = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();

    // Strictly enforce @jecrc.ac.in domain
    if (!email || !email.endsWith('@jecrc.ac.in')) {
      return NextResponse.json(
        { error: 'Only @jecrc.ac.in email addresses are allowed.' },
        { status: 400 },
      );
    }

    // OTP delivery is disabled — sign the user in on the email step alone.
    if (isOtpDisabled()) {
      const { sessionId, cookieValue } = createSessionToken();
      const ip =
        req.headers.get('cf-connecting-ip') ||
        req.headers.get('x-forwarded-for') ||
        '127.0.0.1';
      try {
        await saveSessionToDB(sessionId, ip, email);
      } catch (e) {
        console.error('[student-send-otp] DB session save failed', e);
        return NextResponse.json({ error: 'Unable to start session. Please try again.' }, { status: 500 });
      }

      const res = NextResponse.json({ success: true, otpDisabled: true });
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
    }

    // Enforce resend cooldown from signed cookie
    const existingCookie = req.cookies.get(OTP_COOKIE)?.value;
    if (existingCookie) {
      const otpState = readOtpCookie(existingCookie);
      if (otpState) {
        const elapsed = Date.now() - Number(otpState.iss || 0);
        if (elapsed < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json(
            { error: `Please wait ${wait}s before requesting a new code.` },
            { status: 429 },
          );
        }
      }
    }

    const passcode = generateOtp();

    try {
      await sendOtpEmail(email, passcode);
    } catch (err) {
      console.error('[student-send-otp] SMTP send failed:', err);
      return NextResponse.json(
        { error: 'Failed to send OTP. Please try again.' },
        { status: 500 },
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(OTP_COOKIE, createOtpCookie(email, passcode), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('[student-send-otp]', err);
    return NextResponse.json({ error: 'Failed to send OTP.' }, { status: 500 });
  }
}
