import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { isRollAccessible } from '@/lib/payment';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/session';

const ALLOWED_TABLES = ['jecr_2ndyear', '1styearmaster'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];
const ALL_INFO_TABLE = '2528allinfo';

type StudentIdentity = {
  roll_no: string;
  student_name: string;
  father_name: string;
  mother_name: string;
  branch: string;
  year: string;
};

type ProfileMatchMeta = {
  confidence: 'high' | 'medium' | 'low';
  strategy: string;
  score: number;
  candidates: number;
};

function normalizeCompact(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function toIso(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toISOString();
}

function parseEducationRows(raw: unknown): Record<string, unknown>[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toProfilePayload(row: Record<string, unknown>) {
  return {
    id: row.id ?? null,
    source_file: String(row.source_file || ''),
    page_number: Number(row.page_number || 0),
    form_type: String(row.form_type || ''),
    session: String(row.session || ''),
    college: String(row.college || ''),
    branch_name: String(row.branch_name || ''),
    applicant_name: String(row.applicant_name || ''),
    father_name: String(row.father_name || ''),
    mother_name: String(row.mother_name || ''),
    gender: String(row.gender || ''),
    dob: String(row.dob || ''),
    student_status: String(row.student_status || ''),
    caste: String(row.caste || ''),
    category_i_ii: String(row.category_i_ii || ''),
    category_iii: String(row.category_iii || ''),
    specialization_branch: String(row.specialization_branch || ''),
    admission_status: String(row.admission_status || ''),
    earlier_enrollment_no: String(row.earlier_enrollment_no || ''),
    permanent_address: String(row.permanent_address || ''),
    correspondence_address: String(row.correspondence_address || ''),
    mobile_no: String(row.mobile_no || ''),
    parent_mobile_no: String(row.parent_mobile_no || ''),
    entrance_exam_roll_no: String(row.entrance_exam_roll_no || ''),
    entrance_exam_name: String(row.entrance_exam_name || ''),
    merit_secured: String(row.merit_secured || ''),
    email: String(row.email || ''),
    has_aadhar_card: String(row.has_aadhar_card || ''),
    aadhar_no: String(row.aadhar_no || ''),
    educational_qualification: String(row.educational_qualification || ''),
    college_shift: String(row.college_shift || ''),
    education_rows: parseEducationRows(row.education_rows_json),
    raw_text: String(row.raw_text || ''),
    extracted_at: toIso(row.extracted_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function scoreCandidate(row: Record<string, unknown>, student: StudentIdentity): number {
  const roll = normalizeCompact(student.roll_no);
  const studentName = normalizeCompact(student.student_name);
  const fatherName = normalizeCompact(student.father_name);
  const motherName = normalizeCompact(student.mother_name);
  const branch = normalizeCompact(student.branch);

  const earlier = normalizeCompact(row.earlier_enrollment_no);
  const entrance = normalizeCompact(row.entrance_exam_roll_no);
  const applicant = normalizeCompact(row.applicant_name);
  const father = normalizeCompact(row.father_name);
  const mother = normalizeCompact(row.mother_name);
  const branchName = normalizeCompact(row.branch_name || row.specialization_branch);

  let score = 0;
  if (roll && (earlier === roll || entrance === roll)) score += 140;
  if (studentName && applicant === studentName) score += 80;
  if (fatherName && father === fatherName) score += 45;
  if (motherName && mother === motherName) score += 25;
  if (branch && branchName && (branchName.includes(branch) || branch.includes(branchName))) score += 20;

  return score;
}

async function findBestProfile(student: StudentIdentity) {
  const pool = getPool();
  const rollNo = String(student.roll_no || '').trim();
  const rollCompact = rollNo.replace(/\s+/g, '');
  const rollCandidates = Array.from(new Set([rollNo, rollCompact].filter(Boolean)));
  const nameA = String(student.student_name || '').trim();
  const nameB = nameA.replace(/\s+/g, ' ');
  const fatherA = String(student.father_name || '').trim();
  const fatherB = fatherA.replace(/\s+/g, ' ');
  const applicantCandidates = Array.from(new Set([nameA, nameB].filter(Boolean)));
  const fatherCandidates = Array.from(new Set([fatherA, fatherB].filter(Boolean)));

  try {
    let directRows: Record<string, unknown>[] = [];
    if (rollCandidates.length > 0) {
      const placeholders = rollCandidates.map(() => '?').join(', ');
      const [directRowsRaw] = await pool.query(
        `SELECT *
         FROM \`${ALL_INFO_TABLE}\`
         WHERE \`earlier_enrollment_no\` IN (${placeholders})
            OR \`entrance_exam_roll_no\` IN (${placeholders})
         ORDER BY \`updated_at\` DESC
         LIMIT 5`,
        [...rollCandidates, ...rollCandidates],
      );
      directRows = directRowsRaw as Record<string, unknown>[];
    }

    if (directRows.length > 0) {
      return {
        profile: toProfilePayload(directRows[0]),
        profileMatch: {
          confidence: 'high' as const,
          strategy: 'roll-match',
          score: 200,
          candidates: directRows.length,
        },
      };
    }

    if (applicantCandidates.length === 0 && fatherCandidates.length === 0) {
      return { profile: null, profileMatch: null };
    }

    const applicantWhere = applicantCandidates.length > 0
      ? `\`applicant_name\` IN (${applicantCandidates.map(() => '?').join(', ')})`
      : '';
    const fatherWhere = fatherCandidates.length > 0
      ? `\`father_name\` IN (${fatherCandidates.map(() => '?').join(', ')})`
      : '';
    const whereClauses = [applicantWhere, fatherWhere].filter(Boolean).join(' OR ');
    const [nameRowsRaw] = await pool.query(
      `SELECT *
       FROM \`${ALL_INFO_TABLE}\`
       WHERE ${whereClauses}
       ORDER BY \`updated_at\` DESC
       LIMIT 30`,
      [...applicantCandidates, ...fatherCandidates],
    );

    const nameRows = nameRowsRaw as Record<string, unknown>[];
    if (nameRows.length === 0) {
      return { profile: null, profileMatch: null };
    }

    let best = nameRows[0];
    let bestScore = scoreCandidate(best, student);

    for (let i = 1; i < nameRows.length; i++) {
      const score = scoreCandidate(nameRows[i], student);
      if (score > bestScore) {
        best = nameRows[i];
        bestScore = score;
      }
    }

    if (bestScore < 70) {
      return { profile: null, profileMatch: null };
    }

    const confidence: ProfileMatchMeta['confidence'] = bestScore >= 150
      ? 'high'
      : bestScore >= 110
        ? 'medium'
        : 'low';

    return {
      profile: toProfilePayload(best),
      profileMatch: {
        confidence,
        strategy: 'name-father-branch-score',
        score: bestScore,
        candidates: nameRows.length,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (/ER_NO_SUCH_TABLE|doesn't exist/i.test(msg)) {
      return { profile: null, profileMatch: null };
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rollNo = (searchParams.get('roll_no') || '').trim();
  const includeProfile = ['1', 'true', 'yes'].includes((searchParams.get('include_profile') || '').toLowerCase());
  const rawTable = (searchParams.get('table') || 'jecr_2ndyear').trim();
  const tableName: AllowedTable = ALLOWED_TABLES.includes(rawTable as AllowedTable)
    ? rawTable as AllowedTable
    : 'jecr_2ndyear';

  // Keep 1st-sem complete-profile view open without payment unlock.
  if (tableName !== '1styearmaster') {
    const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;
    if (!sessionId) {
      return NextResponse.json({ error: 'payment_required' }, { status: 402 });
    }

    // Also pass email so prior-session payments (same email) are recognised.
    const { getSessionEmail } = await import('@/lib/session');
    const email = await getSessionEmail(sessionId).catch(() => null);
    const accessible = await isRollAccessible(sessionId, rollNo, email).catch(() => false);
    if (!accessible) {
      return NextResponse.json({ error: 'payment_required' }, { status: 402 });
    }
  }

  if (!rollNo) {
    return NextResponse.json({ error: 'roll_no is required' }, { status: 400 });
  }

  try {
    const pool = getPool();

    if (tableName === '1styearmaster') {
      // Student list is controlled by 1styearmaster, but paper details come from jecr_1styear.
      const [masterRows] = await pool.query(
        `SELECT \`roll_no\`, \`student_name\`, \`father_name\`, \`mother_name\`, \`branch\`
         FROM \`1styearmaster\`
         WHERE \`roll_no\` = ?
         LIMIT 1`,
        [rollNo],
      );

      const master = masterRows as Record<string, unknown>[];
      if (master.length === 0) {
        return NextResponse.json({ error: 'Student not found', student: null, papers: [] }, { status: 404 });
      }

      const [rows] = await pool.query(
        `SELECT * FROM \`jecr_1styear\` WHERE \`roll_no\` = ? ORDER BY \`paper_name\` ASC`,
        [rollNo],
      );
      const records = rows as Record<string, unknown>[];
      const firstMaster = master[0];

      const student: StudentIdentity = {
        roll_no: String(firstMaster.roll_no || ''),
        student_name: String(firstMaster.student_name || ''),
        father_name: String(firstMaster.father_name || ''),
        mother_name: String(firstMaster.mother_name || ''),
        branch: String(firstMaster.branch || ''),
        year: '1st Year',
      };

      const papers = records.map(r => ({
        paper_name:   String(r.paper_name || ''),
        paper_type:   String(r.paper_type || ''),
        exam_type:    String(r.exam_type || ''),
        marks_status: String(r.marks_status || ''),
      }));

      const summary = {
        totalPapers: papers.length,
        filled: papers.filter(p => {
          const s = String(p.marks_status || '').trim().toLowerCase();
          return s !== '' && !s.includes('not filled') && !s.includes('pending');
        }).length,
        pending: papers.filter(p => {
          const s = String(p.marks_status || '').trim().toLowerCase();
          return s === '' || s.includes('not filled') || s.includes('pending');
        }).length,
      };

      let profile: ReturnType<typeof toProfilePayload> | null = null;
      let profileMatch: ProfileMatchMeta | null = null;
      if (includeProfile) {
        const matched = await findBestProfile(student);
        profile = matched.profile;
        profileMatch = matched.profileMatch;
      }

      return NextResponse.json({
        student,
        papers,
        summary,
        profile,
        profileMatch,
        profileLoaded: includeProfile,
      });
    }

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
      year:         first.year || '1st Year',
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

    return NextResponse.json({ student, papers, summary, profileLoaded: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
