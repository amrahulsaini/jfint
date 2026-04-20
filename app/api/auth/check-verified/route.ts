import { NextRequest, NextResponse } from 'next/server';

const VERIFIED_COOKIE = 'jfint_student_verified';

export async function GET(req: NextRequest) {
  const verified = req.cookies.get(VERIFIED_COOKIE)?.value;
  if (verified && verified.endsWith('@jecrc.ac.in')) {
    return NextResponse.json({ verified: true, email: verified });
  }
  return NextResponse.json({ verified: false });
}
