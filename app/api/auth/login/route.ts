import { NextRequest, NextResponse } from 'next/server';

const SESSION_MINUTES = 20;

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const expected = process.env.AUTH_PASSWORD;

    if (!expected || password !== expected) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set('jfint_auth', expected, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MINUTES * 60,
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
