import { NextRequest, NextResponse } from 'next/server';
import { createOtpCookie, generateOtp, readOtpCookie } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/mailer';
import {
  getAdminLoginEmail,
  getAdminPassState,
  saveAdminPass,
  RESEND_COOLDOWN_MS,
} from '@/lib/login-pass';

const OTP_COOKIE = 'jfint_login_otp';

export async function POST(req: NextRequest) {
  try {
    // Read JSON body if sent, but this endpoint does not require user input.
    try { await req.json(); } catch { /* no-op */ }

    const loginEmail = getAdminLoginEmail();
    if (!loginEmail) {
      return NextResponse.json({ error: 'ADMIN_LOGIN_EMAIL is not configured.' }, { status: 500 });
    }

    // Enforce resend cooldown from signed cookie (works even if DB is unreachable).
    const existingCookie = req.cookies.get(OTP_COOKIE)?.value;
    if (existingCookie) {
      const otpState = readOtpCookie(existingCookie);
      if (otpState) {
        const elapsed = Date.now() - Number(otpState.iss || 0);
        if (elapsed < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json({ error: `Please wait ${wait}s before requesting a new code.` }, { status: 429 });
        }
      }
    }

    // Also enforce resend cooldown from DB when available.
    try {
      const state = await getAdminPassState(loginEmail);
      if (state) {
        const elapsed = Date.now() - state.lastSentAt.getTime();
        if (elapsed < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json({ error: `Please wait ${wait}s before requesting a new code.` }, { status: 429 });
        }
      }
    } catch (err) {
      console.warn('[send-otp] DB cooldown check skipped:', err);
    }

    const passcode = generateOtp();

    // Save in DB if available; OTP cookie remains the primary fallback for local environments.
    try {
      await saveAdminPass(loginEmail, passcode);
    } catch (err) {
      console.warn('[send-otp] DB pass save skipped:', err);
    }

    try {
      await sendOtpEmail(loginEmail, passcode);
    } catch (err) {
      console.error('[send-otp] SMTP send failed:', err);
      return NextResponse.json({ error: 'Failed to send pass email. Please verify SMTP_USER/SMTP_PASS and app password.' }, { status: 500 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(OTP_COOKIE, createOtpCookie(loginEmail, passcode), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send pass. Check your SMTP configuration.' }, { status: 500 });
  }
}
