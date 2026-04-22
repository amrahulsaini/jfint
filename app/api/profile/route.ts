import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

type DictRow = Record<string, unknown>;

const VERIFIED_COOKIE = 'jfint_student_verified';

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /ER_NO_SUCH_TABLE|doesn't exist/i.test(msg);
}

async function getColumns(pool: ReturnType<typeof getPool>, table: string): Promise<string[]> {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\``) as [unknown[], unknown];
  return (rows as Array<{ Field: string }>).map(r => String(r.Field || ''));
}

function pickField(columns: string[], candidates: string[]): string | null {
  const map = new Map(columns.map(c => [c.toLowerCase(), c]));
  for (const key of candidates) {
    const match = map.get(key.toLowerCase());
    if (match) return match;
  }
  return null;
}

function getValue(row: DictRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeRollForPhoto(value: string): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

async function fetchMappedRecords(
  pool: ReturnType<typeof getPool>,
  table: string,
  semester: '1st Sem' | '3rd Sem',
  verifiedEmail: string,
  emailColumnName: string,
) {
  try {
    const columns = await getColumns(pool, table);
    const emailCol = pickField(columns, [emailColumnName]);
    if (!emailCol) {
      return {
        table,
        semester,
        count: 0,
        fieldMap: null,
        records: [] as Array<Record<string, unknown>>,
        warning: `Email column not found (expected ${emailColumnName}).`,
      };
    }

    const orderCol = pickField(columns, ['updated_at', 'created_at', 'extracted_at', 'id']);
    const orderBy = orderCol ? ` ORDER BY \`${orderCol}\` DESC` : '';

    const [rows] = await pool.query(
      `SELECT *
       FROM \`${table}\`
       WHERE LOWER(TRIM(COALESCE(\`${emailCol}\`, ''))) = LOWER(TRIM(?))${orderBy}
       LIMIT 250`,
      [verifiedEmail],
    ) as [unknown[], unknown];

    const rawRows = rows as DictRow[];

    const rollPrimaryField = pickField(columns, ['roll_no', 'rollno', 'roll_number', 'earlier_enrollment_no', 'rtu_roll_no']);
    const rollSecondaryField = pickField(columns, ['entrance_exam_roll_no', 'university_roll_no']);
    const nameField = pickField(columns, ['student_name', 'applicant_name', 'name']);
    const branchField = pickField(columns, ['branch', 'branch_name', 'specialization_branch']);

    const records = rawRows.map((row, idx) => {
      const primaryRoll = getValue(row, ['roll_no', 'rollno', 'roll_number', 'earlier_enrollment_no', 'rtu_roll_no']);
      const secondaryRoll = getValue(row, ['entrance_exam_roll_no', 'university_roll_no']);
      const mappedRoll = primaryRoll || secondaryRoll;
      const studentName = getValue(row, ['student_name', 'applicant_name', 'name']);
      const branch = getValue(row, ['branch', 'branch_name', 'specialization_branch']);
      const mobile = getValue(row, ['mobile_no', 'mobile', 'student_mobile']);
      const fatherName = getValue(row, ['father_name']);
      const motherName = getValue(row, ['mother_name']);
      const photoRoll = normalizeRollForPhoto(mappedRoll);
      const photoDir = semester === '3rd Sem' ? 'student_photos' : '1styearphotos';

      return {
        id: String(row.id ?? `${table}-${idx + 1}`),
        table,
        semester,
        rollNo: mappedRoll || '-',
        secondaryRollNo: secondaryRoll || null,
        studentName: studentName || null,
        branch: branch || null,
        mobile: mobile || null,
        fatherName: fatherName || null,
        motherName: motherName || null,
        photoUrl: photoRoll ? `/${photoDir}/photo_${photoRoll}.jpg` : null,
        updatedAt: toIso(row.updated_at ?? row.created_at ?? row.extracted_at),
      };
    });

    return {
      table,
      semester,
      count: records.length,
      fieldMap: {
        emailField: emailCol,
        primaryRollField: rollPrimaryField,
        secondaryRollField: rollSecondaryField,
        nameField,
        branchField,
      },
      records,
      warning: null as string | null,
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      return {
        table,
        semester,
        count: 0,
        fieldMap: null,
        records: [] as Array<Record<string, unknown>>,
        warning: `Table ${table} was not found in this database.`,
      };
    }
    throw err;
  }
}

export async function GET(req: NextRequest) {
  try {
    const verifiedEmail = normalizeEmail(req.cookies.get(VERIFIED_COOKIE)?.value || '');
    if (!verifiedEmail || !verifiedEmail.endsWith('@jecrc.ac.in')) {
      return NextResponse.json({ error: 'Email verification required.' }, { status: 401 });
    }

    const pool = getPool();

    const [sessionRows] = await pool.query(
      `SELECT id, created_at, expires_at, ip_address
       FROM portal_sessions
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [verifiedEmail],
    ) as [unknown[], unknown];

    const sessions = (sessionRows as Array<{
      id: string;
      created_at: Date;
      expires_at: Date;
      ip_address: string | null;
    }>).map((row) => ({
      sessionId: row.id,
      createdAt: row.created_at?.toISOString?.() ?? null,
      expiresAt: row.expires_at?.toISOString?.() ?? null,
      ipAddress: row.ip_address,
      active: row.expires_at ? row.expires_at.getTime() > Date.now() : false,
    }));

    const [paymentRows] = await pool.query(
      `SELECT plan, roll_no, amount_paise, razorpay_order_id, razorpay_payment_id, created_at, expires_at
       FROM portal_payments
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 150`,
      [verifiedEmail],
    ) as [unknown[], unknown];

    const payments = (paymentRows as Array<{
      plan: string;
      roll_no: string | null;
      amount_paise: number;
      razorpay_order_id: string;
      razorpay_payment_id: string | null;
      created_at: Date;
      expires_at: Date | null;
    }>).map((row) => ({
      plan: row.plan,
      rollNo: row.roll_no,
      amountPaise: row.amount_paise,
      amountRupees: (row.amount_paise / 100).toFixed(2),
      orderId: row.razorpay_order_id,
      paymentId: row.razorpay_payment_id,
      createdAt: row.created_at?.toISOString?.() ?? null,
      expiresAt: row.expires_at?.toISOString?.() ?? null,
      isCoupon: row.razorpay_order_id === 'coupon',
      active: row.plan === 'all' ? (!row.expires_at || row.expires_at.getTime() > Date.now()) : true,
    }));

    // Strict lookup flow requested:
    // 1) Check 2428main.student_emailid
    // 2) If nothing found, fallback to 2528allinfo.student_email
    const thirdSem = await fetchMappedRecords(pool, '2428main', '3rd Sem', verifiedEmail, 'student_emailid');
    const firstSem = thirdSem.count === 0
      ? await fetchMappedRecords(pool, '2528allinfo', '1st Sem', verifiedEmail, 'student_email')
      : {
          table: '2528allinfo',
          semester: '1st Sem',
          count: 0,
          fieldMap: null,
          records: [] as Array<Record<string, unknown>>,
          warning: 'Skipped fallback: match found in 2428main.student_emailid.',
        };

    return NextResponse.json({
      email: verifiedEmail,
      totals: {
        sessions: sessions.length,
        payments: payments.length,
        firstSemRecords: firstSem.count,
        thirdSemRecords: thirdSem.count,
      },
      sessions,
      payments,
      mappings: {
        firstSem,
        thirdSem,
      },
    });
  } catch (err) {
    console.error('[profile]', err);
    return NextResponse.json({ error: 'Failed to load profile data.' }, { status: 500 });
  }
}
