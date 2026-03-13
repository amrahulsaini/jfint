import { NextRequest, NextResponse } from 'next/server';
import {
  createOtpCookie,
  generateOtp,
  readOtpCookie,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
} from '@/lib/otp';
import { sendOtpEmail } from '@/lib/mailer';

const LOGIN_EMAIL = 'rahulsaini.cse28@jecrc.ac.in';

export async function POST(req: NextRequest) {
  try {
    // Read JSON body if sent, but this endpoint does not require user input.
    try { await req.json(); } catch { /* no-op */ }

    // Enforce resend cooldown for the fixed login mailbox.
    const existingCookie = req.cookies.get('jfint_otp_state')?.value;
    if (existingCookie) {
      const state = readOtpCookie(existingCookie);
      if (state && state.email === LOGIN_EMAIL) {
        const elapsed = Date.now() - state.iss;
        if (elapsed < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json({ error: `Please wait ${wait}s before requesting a new code.` }, { status: 429 });
        }
      }
    }

    // Generate pass, send email, and store signed state cookie.
    const otp = generateOtp();
    await sendOtpEmail(LOGIN_EMAIL, otp);

    const res = NextResponse.json({ success: true });
    res.cookies.set('jfint_otp_state', createOtpCookie(LOGIN_EMAIL, otp), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: Math.floor(OTP_TTL_MS / 1000),
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send pass. Check your SMTP configuration.' }, { status: 500 });
  }
}
