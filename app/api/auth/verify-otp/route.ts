import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';

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
      // Update cookie with incremented attempt count if provided
      if (result.updatedCookie) {
        res.cookies.set('jfint_otp_state', result.updatedCookie, {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 5 * 60,
          path: '/',
        });
      } else {
        // Too many attempts — clear the OTP cookie so flow must restart
        res.cookies.set('jfint_otp_state', '', { httpOnly: true, maxAge: 0, path: '/' });
      }
      return res;
    }

    // OTP valid — grant full session, clear intermediate cookies
    const res = NextResponse.json({ success: true });
    res.cookies.set('jfint_auth', process.env.AUTH_PASSWORD!, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MINUTES * 60,
      path: '/',
    });
    res.cookies.set('jfint_pw_verified', '', { httpOnly: true, maxAge: 0, path: '/' });
    res.cookies.set('jfint_otp_state', '', { httpOnly: true, maxAge: 0, path: '/' });
    return res;
  } catch (err) {
    console.error('[verify-otp]', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
