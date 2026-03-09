import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { isRollAccessible } from '@/lib/payment';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';

const ALLOWED_TABLES = ['jecr_2ndyear', 'jecr_1styear'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

export async function GET(req: NextRequest) {
  // Require payment for this specific roll_no (or a valid all-access plan)
  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;
  const rollNoForCheck = (new URL(req.url).searchParams.get('roll_no') || '').trim();

  if (!sessionId) {
    return NextResponse.json({ error: 'payment_required' }, { status: 402 });
  }
  // Also pass email so prior-session payments (same email) are recognised
  const { getSessionEmail } = await import('@/lib/session');
  const email = await getSessionEmail(sessionId).catch(() => null);
  const accessible = await isRollAccessible(sessionId, rollNoForCheck, email).catch(() => false);
  if (!accessible) {
    return NextResponse.json({ error: 'payment_required' }, { status: 402 });
  }

  const { searchParams } = new URL(req.url);
  const rollNo = (searchParams.get('roll_no') || '').trim();
  const rawTable = (searchParams.get('table') || 'jecr_2ndyear').trim();
  const tableName: AllowedTable = ALLOWED_TABLES.includes(rawTable as AllowedTable)
    ? rawTable as AllowedTable
    : 'jecr_2ndyear';

  if (!rollNo) {
    return NextResponse.json({ error: 'roll_no is required' }, { status: 400 });
  }

  try {
    const pool = getPool();

    // Get all records for this roll number (all papers, marks, etc.)
    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\` WHERE \`roll_no\` = ? ORDER BY \`paper_name\` ASC`,
      [rollNo]
    );

    const records = rows as Record<string, unknown>[];

    if (records.length === 0) {
      return NextResponse.json({ error: 'Student not found', student: null, papers: [] }, { status: 404 });
    }

    // Build student info from first record
    const first = records[0];
    const student = {
      roll_no:      first.roll_no,
      student_name: first.student_name,
      father_name:  first.father_name,
      mother_name:  first.mother_name,
      branch:       first.branch,
      year:         first.year,
    };

    // Build papers list
    const papers = records.map(r => ({
      paper_name:   r.paper_name,
      paper_type:   r.paper_type,
      exam_type:    r.exam_type,
      marks_status: r.marks_status,
    }));

    // Summary
    const summary = {
      totalPapers: papers.length,
      filled: papers.filter(p => {
        const s = String(p.marks_status || '').trim().toLowerCase();
        // Has a numeric value or is "Absent" → marks are entered
        return s !== '' && !s.includes('not filled') && !s.includes('pending');
      }).length,
      pending: papers.filter(p => {
        const s = String(p.marks_status || '').trim().toLowerCase();
        return s === '' || s.includes('not filled') || s.includes('pending');
      }).length,
    };

    return NextResponse.json({ student, papers, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
