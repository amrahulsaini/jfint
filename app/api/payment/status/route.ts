import { NextRequest, NextResponse } from 'next/server';
import { getPaidEntries, PAID_COOKIE } from '@/lib/payment';

export async function GET(req: NextRequest) {
  const value = req.cookies.get(PAID_COOKIE)?.value;
  const entries = getPaidEntries(value);
  const allAccess = entries.some(e => e.r === '*');
  const paidRolls = entries.filter(e => e.r !== '*').map(e => e.r);
  return NextResponse.json({ allAccess, paidRolls });
}
