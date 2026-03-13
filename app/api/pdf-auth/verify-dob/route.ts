import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

const AADHAR_TABLES = [
  '1styear_aadhar',
  '2ndyear_aadhar',
  '3rdyear_aadhar',
  '4thyear_aadhar',
] as const;

function parseDobFromDDMMYYYY(input: string): string | null {
  if (!/^\d{8}$/.test(input)) return null;
  const dd = input.slice(0, 2);
  const mm = input.slice(2, 4);
  const yyyy = input.slice(4, 8);
  const asDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime())) return null;
  if (asDate.getUTCFullYear() !== Number(yyyy)) return null;
  if (asDate.getUTCMonth() + 1 !== Number(mm)) return null;
  if (asDate.getUTCDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rollNo = String(body?.rollNo || '').trim().toUpperCase();
    const dobInput = String(body?.dob || '').trim();

    if (!rollNo) {
      return NextResponse.json({ error: 'Roll number is required.' }, { status: 400 });
    }

    const pool = getPool();
    let foundDob: string | null = null;

    for (const table of AADHAR_TABLES) {
      const [rows] = (await pool.query(
        `SELECT DATE_FORMAT(dob, '%Y-%m-%d') AS dob FROM \`${table}\` WHERE roll_no = ? LIMIT 1`,
        [rollNo],
      )) as [Array<{ dob: string | null }>, unknown];

      if (rows.length > 0) {
        foundDob = rows[0].dob;
        break;
      }
    }

    // If roll is not available in any aadhar table, allow manual export without DOB auth.
    if (!foundDob) {
      return NextResponse.json({ allow: true, authRequired: false, reason: 'roll_not_found' });
    }

    // Roll exists in aadhar table, so DOB auth is mandatory.
    if (!dobInput) {
      return NextResponse.json({ allow: false, authRequired: true, error: 'Enter DOB in ddmmyyyy format.' }, { status: 401 });
    }

    const normalizedDob = parseDobFromDDMMYYYY(dobInput);
    if (!normalizedDob) {
      return NextResponse.json({ allow: false, authRequired: true, error: 'Invalid DOB format. Use ddmmyyyy.' }, { status: 400 });
    }

    if (normalizedDob !== foundDob) {
      return NextResponse.json({ allow: false, authRequired: true, error: 'DOB does not match this roll number.' }, { status: 401 });
    }

    return NextResponse.json({ allow: true, authRequired: true, reason: 'dob_verified' });
  } catch (err) {
    console.error('[pdf-auth/verify-dob]', err);
    return NextResponse.json({ error: 'Failed to verify DOB.' }, { status: 500 });
  }
}
