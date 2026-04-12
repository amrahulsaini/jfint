import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

const ALLOWED_TABLES = ['jecr_2ndyear', '1styearmaster'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const search = (searchParams.get('search') || '').trim();
  const branch = (searchParams.get('branch') || '').trim();
  const offset = (page - 1) * limit;
  const rawTable = (searchParams.get('table') || 'jecr_2ndyear').trim();
  const tableName: AllowedTable = ALLOWED_TABLES.includes(rawTable as AllowedTable)
    ? rawTable as AllowedTable
    : 'jecr_2ndyear';
  const isFirstYearMaster = tableName === '1styearmaster';

  try {
    const pool = getPool();

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    const col = (name: string) => isFirstYearMaster ? `fm.\`${name}\`` : `\`${name}\``;

    if (isFirstYearMaster) {
      // Hard filter for 1st sem: only 25-batch roll numbers.
      conditions.push("fm.`roll_no` LIKE '25%'");
    }

    if (search) {
      conditions.push(`(${col('student_name')} LIKE ? OR ${col('roll_no')} LIKE ? OR ${col('father_name')} LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (branch) {
      conditions.push(`${col('branch')} = ?`);
      params.push(branch);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    let rows: unknown = [];
    let branches: unknown = [];
    let stats: unknown = [];

    if (isFirstYearMaster) {
      // 1st sem: include only students from 1styearmaster, but compute papers from jecr_1styear.
      const [countResult] = await pool.query(
        `SELECT COUNT(DISTINCT fm.\`roll_no\`) AS total
         FROM \`1styearmaster\` fm
         ${where}`,
        params,
      );
      total = (countResult as { total: number }[])[0].total;

      [rows] = await pool.query(
        `SELECT fm.\`roll_no\`, fm.\`student_name\`, fm.\`father_name\`, fm.\`mother_name\`, fm.\`branch\`,
                '1st Year' AS \`year\`,
                COALESCE(mp.\`paper_count\`, 0) AS paper_count,
                '' AS papers
         FROM \`1styearmaster\` fm
         LEFT JOIN (
           SELECT \`roll_no\`, COUNT(*) AS \`paper_count\`
           FROM \`jecr_1styear\`
           WHERE \`roll_no\` LIKE '25%'
           GROUP BY \`roll_no\`
         ) mp ON mp.\`roll_no\` = fm.\`roll_no\`
         ${where}
         ORDER BY fm.\`student_name\` ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      [branches] = await pool.query(
        `SELECT DISTINCT fm.\`branch\`
         FROM \`1styearmaster\` fm
         WHERE fm.\`roll_no\` LIKE '25%'
           AND fm.\`branch\` IS NOT NULL
           AND fm.\`branch\` != ''
         ORDER BY fm.\`branch\``,
      );

      [stats] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM \`jecr_1styear\` WHERE \`roll_no\` LIKE '25%') AS totalRecords,
           (SELECT COUNT(DISTINCT \`branch\`) FROM \`1styearmaster\` WHERE \`roll_no\` LIKE '25%' AND \`branch\` IS NOT NULL AND \`branch\` != '') AS totalBranches,
           (SELECT COUNT(DISTINCT \`paper_name\`) FROM \`jecr_1styear\` WHERE \`roll_no\` LIKE '25%') AS totalPapers,
           (SELECT COUNT(*) FROM \`1styearmaster\` WHERE \`roll_no\` LIKE '25%') AS totalStudents`,
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
      stats: (stats as Record<string, number>[])[0],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database connection failed';
    return NextResponse.json({ error: message, rows: [], total: 0 }, { status: 500 });
  }
}
