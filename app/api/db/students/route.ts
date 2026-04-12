import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

const ALLOWED_TABLES = ['jecr_2ndyear', '1styearmaster'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

const FIRST_YEAR_COMM_TABLE = '2528firstyear_comm';

async function ensureFirstYearCommunicationTable(pool: ReturnType<typeof getPool>) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS \`${FIRST_YEAR_COMM_TABLE}\` (
      roll_no VARCHAR(64) NOT NULL,
      student_name VARCHAR(255) DEFAULT '',
      father_name VARCHAR(255) DEFAULT '',
      mother_name VARCHAR(255) DEFAULT '',
      branch VARCHAR(255) DEFAULT '',
      year VARCHAR(32) DEFAULT '1st Year',
      gender VARCHAR(64) DEFAULT '',
      email VARCHAR(255) DEFAULT '',
      mobile_no VARCHAR(64) DEFAULT '',
      parent_mobile_no VARCHAR(64) DEFAULT '',
      aadhar_no VARCHAR(128) DEFAULT '',
      has_aadhar_card VARCHAR(64) DEFAULT '',
      source_profile_id BIGINT NULL,
      synced_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (roll_no),
      KEY idx_branch (branch),
      KEY idx_gender (gender),
      KEY idx_mobile (mobile_no),
      KEY idx_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
  );

  // Keep requests fast: if communication table is already populated for 25-batch,
  // skip expensive resync work on normal list reads.
  const [commCountRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM \`${FIRST_YEAR_COMM_TABLE}\``,
  );
  const commCount = Number((commCountRows as Array<{ total: number }>)[0]?.total || 0);

  const [masterCountRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM \`1styearmaster\` WHERE \`roll_no\` LIKE '25%'`,
  );
  const masterCount = Number((masterCountRows as Array<{ total: number }>)[0]?.total || 0);

  if (commCount > 0 && commCount >= masterCount) {
    return;
  }

  const normalizedFmRoll = `REPLACE(REPLACE(REPLACE(TRIM(fm.\`roll_no\`), ' ', ''), '-', ''), '/', '')`;
  const rollMatchExpr = `(
    ai.\`earlier_enrollment_no\` = fm.\`roll_no\`
    OR ai.\`entrance_exam_roll_no\` = fm.\`roll_no\`
    OR REPLACE(REPLACE(REPLACE(TRIM(ai.\`earlier_enrollment_no\`), ' ', ''), '-', ''), '/', '') = ${normalizedFmRoll}
    OR REPLACE(REPLACE(REPLACE(TRIM(ai.\`entrance_exam_roll_no\`), ' ', ''), '-', ''), '/', '') = ${normalizedFmRoll}
  )`;

  await pool.query(
    `INSERT INTO \`${FIRST_YEAR_COMM_TABLE}\` (
      roll_no, student_name, father_name, mother_name, branch, year,
      gender, email, mobile_no, parent_mobile_no, aadhar_no, has_aadhar_card,
      source_profile_id, synced_at
    )
    SELECT
      fm.\`roll_no\`,
      COALESCE(fm.\`student_name\`, ''),
      COALESCE(fm.\`father_name\`, ''),
      COALESCE(fm.\`mother_name\`, ''),
      COALESCE(fm.\`branch\`, ''),
      '1st Year',
      COALESCE((SELECT ai.\`gender\` FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY ai.\`updated_at\` DESC, ai.\`id\` DESC LIMIT 1), ''),
      COALESCE((SELECT ai.\`email\` FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY ai.\`updated_at\` DESC, ai.\`id\` DESC LIMIT 1), ''),
      COALESCE((SELECT ai.\`mobile_no\` FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY ai.\`updated_at\` DESC, ai.\`id\` DESC LIMIT 1), ''),
      COALESCE((SELECT ai.\`parent_mobile_no\` FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY ai.\`updated_at\` DESC, ai.\`id\` DESC LIMIT 1), ''),
      COALESCE((SELECT ai.\`aadhar_no\` FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY ai.\`updated_at\` DESC, ai.\`id\` DESC LIMIT 1), ''),
      COALESCE((SELECT ai.\`has_aadhar_card\` FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY ai.\`updated_at\` DESC, ai.\`id\` DESC LIMIT 1), ''),
      (SELECT ai.\`id\` FROM \`2528allinfo\` ai WHERE ${rollMatchExpr} ORDER BY ai.\`updated_at\` DESC, ai.\`id\` DESC LIMIT 1),
      CURRENT_TIMESTAMP
    FROM \`1styearmaster\` fm
    WHERE fm.\`roll_no\` LIKE '25%'
    ON DUPLICATE KEY UPDATE
      student_name = VALUES(student_name),
      father_name = VALUES(father_name),
      mother_name = VALUES(mother_name),
      branch = VALUES(branch),
      year = VALUES(year),
      gender = VALUES(gender),
      email = VALUES(email),
      mobile_no = VALUES(mobile_no),
      parent_mobile_no = VALUES(parent_mobile_no),
      aadhar_no = VALUES(aadhar_no),
      has_aadhar_card = VALUES(has_aadhar_card),
      source_profile_id = VALUES(source_profile_id),
      synced_at = VALUES(synced_at)`,
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const search = (searchParams.get('search') || '').trim();
  const branch = (searchParams.get('branch') || '').trim();
  const gender = (searchParams.get('gender') || '').trim();
  const offset = (page - 1) * limit;
  const rawTable = (searchParams.get('table') || 'jecr_2ndyear').trim();
  const tableName: AllowedTable = ALLOWED_TABLES.includes(rawTable as AllowedTable)
    ? rawTable as AllowedTable
    : 'jecr_2ndyear';
  const isFirstYearMaster = tableName === '1styearmaster';

  try {
    const pool = getPool();
    if (isFirstYearMaster) {
      await ensureFirstYearCommunicationTable(pool);
    }

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    const col = (name: string) => isFirstYearMaster ? `fc.\`${name}\`` : `\`${name}\``;

    if (search) {
      conditions.push(`(${col('student_name')} LIKE ? OR ${col('roll_no')} LIKE ? OR ${col('father_name')} LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (branch) {
      conditions.push(`${col('branch')} = ?`);
      params.push(branch);
    }
    if (isFirstYearMaster) {
      conditions.push("fc.`roll_no` LIKE '25%'");
      if (gender) {
        conditions.push("fc.`gender` = ?");
        params.push(gender);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    let rows: unknown = [];
    let branches: unknown = [];
    let genders: string[] = [];
    let stats: unknown = [];

    if (isFirstYearMaster) {
      const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM \`${FIRST_YEAR_COMM_TABLE}\` fc
         ${where}`,
        params,
      );
      total = (countResult as { total: number }[])[0].total;

      [rows] = await pool.query(
        `SELECT fc.\`roll_no\`, fc.\`student_name\`, fc.\`father_name\`, fc.\`mother_name\`, fc.\`branch\`, fc.\`year\`, fc.\`gender\`,
                COALESCE(mp.\`paper_count\`, 0) AS paper_count,
                '' AS papers
         FROM \`${FIRST_YEAR_COMM_TABLE}\` fc
         LEFT JOIN (
           SELECT \`roll_no\`, COUNT(*) AS \`paper_count\`
           FROM \`jecr_1styear\`
           WHERE \`roll_no\` LIKE '25%'
           GROUP BY \`roll_no\`
         ) mp ON mp.\`roll_no\` = fc.\`roll_no\`
         ${where}
         ORDER BY fc.\`student_name\` ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      [branches] = await pool.query(
        `SELECT DISTINCT fc.\`branch\`
         FROM \`${FIRST_YEAR_COMM_TABLE}\` fc
         WHERE fc.\`roll_no\` LIKE '25%'
           AND fc.\`branch\` IS NOT NULL
           AND fc.\`branch\` != ''
         ORDER BY fc.\`branch\``,
      );

      const [genderRows] = await pool.query(
        `SELECT DISTINCT fc.\`gender\`
         FROM \`${FIRST_YEAR_COMM_TABLE}\` fc
         WHERE fc.\`roll_no\` LIKE '25%'
           AND fc.\`gender\` IS NOT NULL
           AND fc.\`gender\` != ''
         ORDER BY fc.\`gender\``,
      );
      genders = (genderRows as Array<{ gender: string }>).map(g => g.gender);

      [stats] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM \`jecr_1styear\` WHERE \`roll_no\` LIKE '25%') AS totalRecords,
           (SELECT COUNT(DISTINCT \`branch\`) FROM \`${FIRST_YEAR_COMM_TABLE}\` WHERE \`roll_no\` LIKE '25%' AND \`branch\` IS NOT NULL AND \`branch\` != '') AS totalBranches,
           (SELECT COUNT(DISTINCT \`paper_name\`) FROM \`jecr_1styear\` WHERE \`roll_no\` LIKE '25%') AS totalPapers,
           (SELECT COUNT(*) FROM \`${FIRST_YEAR_COMM_TABLE}\` WHERE \`roll_no\` LIKE '25%') AS totalStudents`,
      );
    } else {
      const [countResult] = await pool.query(
        `SELECT COUNT(DISTINCT \`roll_no\`) AS total FROM \`${tableName}\` ${where}`,
        params,
      );
      total = (countResult as { total: number }[])[0].total;

      [rows] = await pool.query(
        `SELECT \`roll_no\`, \`student_name\`, \`father_name\`, \`mother_name\`, \`branch\`, \`year\`,
                COUNT(*) AS paper_count,
                GROUP_CONCAT(DISTINCT \`paper_name\` SEPARATOR ', ') AS papers
         FROM \`${tableName}\` ${where}
         GROUP BY \`roll_no\`, \`student_name\`, \`father_name\`, \`mother_name\`, \`branch\`, \`year\`
         ORDER BY \`student_name\` ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      [branches] = await pool.query(
        `SELECT DISTINCT \`branch\` FROM \`${tableName}\` WHERE \`branch\` IS NOT NULL AND \`branch\` != '' ORDER BY \`branch\``,
      );

      [stats] = await pool.query(
        'SELECT COUNT(*) AS totalRecords, COUNT(DISTINCT `branch`) AS totalBranches, COUNT(DISTINCT `paper_name`) AS totalPapers, COUNT(DISTINCT `roll_no`) AS totalStudents FROM `' + tableName + '`',
      );
    }

    return NextResponse.json({
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      branches: (branches as { branch: string }[]).map(b => b.branch),
      genders,
      stats: (stats as Record<string, number>[])[0],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database connection failed';
    return NextResponse.json({ error: message, rows: [], total: 0 }, { status: 500 });
  }
}
