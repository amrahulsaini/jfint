import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

const AADHAR_TABLES = [
  '1styear_aadhar',
  '2ndyear_aadhar',
  '3rdyear_aadhar',
  '4thyear_aadhar',
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rollNo = String(body?.rollNo || '').trim().toUpperCase();

    if (!rollNo) {
      return NextResponse.json({ error: 'Roll number is required.' }, { status: 400 });
    }

    const pool = getPool();
    let pdfPassword: string | null = null;

    for (const table of AADHAR_TABLES) {
      const [rows] = (await pool.query(
        `SELECT DATE_FORMAT(dob, '%d%m%Y') AS dob FROM \`${table}\` WHERE roll_no = ? LIMIT 1`,
        [rollNo],
      )) as [Array<{ dob: string | null }>, unknown];

      if (rows.length > 0) {
        pdfPassword = rows[0].dob;
        break;
      }
    }

    // If roll is not available in any aadhar table, export remains unprotected.
    if (!pdfPassword) {
      return NextResponse.json({ protect: false });
    }

    return NextResponse.json({ protect: true, pdfPassword });
  } catch (err) {
    console.error('[pdf-auth/verify-dob]', err);
    return NextResponse.json({ error: 'Failed to prepare PDF protection.' }, { status: 500 });
  }
}
