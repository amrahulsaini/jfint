import { NextRequest, NextResponse } from 'next/server';
import { generateOtp } from '@/lib/otp';
import { sendOtpEmail } from '@/lib/mailer';
import {
  getAdminLoginEmail,
  getAdminPassState,
  saveAdminPass,
  RESEND_COOLDOWN_MS,
} from '@/lib/login-pass';

export async function POST(req: NextRequest) {
  try {
    // Read JSON body if sent, but this endpoint does not require user input.
    try { await req.json(); } catch { /* no-op */ }

    const loginEmail = getAdminLoginEmail();
    if (!loginEmail) {
      return NextResponse.json({ error: 'ADMIN_LOGIN_EMAIL is not configured.' }, { status: 500 });
    }

    // Enforce resend cooldown from DB state.
    const state = await getAdminPassState(loginEmail);
    if (state) {
      const elapsed = Date.now() - state.lastSentAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json({ error: `Please wait ${wait}s before requesting a new code.` }, { status: 429 });
      }
    }

    const passcode = generateOtp();
    await saveAdminPass(loginEmail, passcode);
    await sendOtpEmail(loginEmail, passcode);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send pass. Check your SMTP configuration.' }, { status: 500 });
  }
}
