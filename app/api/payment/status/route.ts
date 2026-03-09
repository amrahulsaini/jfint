import { NextRequest, NextResponse } from 'next/server';
import { validatePaidCookie, PAID_COOKIE } from '@/lib/payment';

export async function GET(req: NextRequest) {
  const value = req.cookies.get(PAID_COOKIE)?.value;
  return NextResponse.json({ paid: validatePaidCookie(value) });
}
