import { NextRequest, NextResponse } from 'next/server';
import {
  validatePwVerifiedToken,
  createOtpCookie,
  generateOtp,
  readOtpCookie,
  RESEND_COOLDOWN_MS,
} from '@/lib/otp';
import { sendOtpEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    // 1. Confirm password step was completed
    const pwCookie = req.cookies.get('jfint_pw_verified')?.value;
    if (!pwCookie || !validatePwVerifiedToken(pwCookie)) {
      return NextResponse.json({ error: 'Session expired. Please enter your password again.' }, { status: 401 });
    }

    const { email } = await req.json();

    // 2. Validate email domain
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }
    const normalised = email.trim().toLowerCase();
    if (!normalised.endsWith('@jecrc.ac.in')) {
      return NextResponse.json({ error: 'Only @jecrc.ac.in addresses are allowed.' }, { status: 400 });
    }

    // 3. Resend cooldown: if an unexpired OTP state exists for this email, enforce 60s gap
    const existingCookie = req.cookies.get('jfint_otp_state')?.value;
    if (existingCookie) {
      const state = readOtpCookie(existingCookie);
      if (state && state.email === normalised) {
        const elapsed = Date.now() - state.iss;
        if (elapsed < RESEND_COOLDOWN_MS) {
          const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
          return NextResponse.json({ error: `Please wait ${wait}s before requesting a new code.` }, { status: 429 });
        }
      }
    }

    // 4. Generate OTP, send email, store signed state cookie
    const otp = generateOtp();
    await sendOtpEmail(normalised, otp);

    const res = NextResponse.json({ success: true });
    res.cookies.set('jfint_otp_state', createOtpCookie(normalised, otp), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 5 * 60,   // 5 minutes (matches OTP TTL)
      path: '/',
    });
    return res;
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send OTP. Check your SMTP configuration.' }, { status: 500 });
  }
}
