import { NextRequest, NextResponse } from 'next/server';
import { pwVerifiedToken } from '@/lib/otp';

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || secret.startsWith('YOUR_')) return true; // skip if not configured yet
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  });
  const data = await r.json() as { success: boolean };
  return data.success === true;
}

export async function POST(req: NextRequest) {
  try {
    const { password, turnstileToken } = await req.json();
    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for') ||
      '127.0.0.1';

    // 1. Verify Turnstile captcha
    const captchaOk = await verifyTurnstile(turnstileToken || '', ip);
    if (!captchaOk) {
      return NextResponse.json({ error: 'Captcha verification failed. Please refresh and try again.' }, { status: 400 });
    }

    // 2. Verify password
    const expected = process.env.AUTH_PASSWORD;
    if (!expected || password !== expected) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    // 3. Set intermediate cookie — email OTP step comes next
    const res = NextResponse.json({ success: true });
    res.cookies.set('jfint_pw_verified', pwVerifiedToken(), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 min to complete email + OTP
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
