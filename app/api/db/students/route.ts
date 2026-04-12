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

  try {
    const pool = getPool();

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push('(`student_name` LIKE ? OR `roll_no` LIKE ? OR `father_name` LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (branch) {
      conditions.push('`branch` = ?');
      params.push(branch);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // We show one row per unique student (by roll_no), sorted alphabetically
    // Total unique students count
    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT \`roll_no\`) AS total FROM \`${tableName}\` ${where}`,
      params
    );
    const total = (countResult as { total: number }[])[0].total;

    // Fetch unique students sorted alphabetically by name
    const [rows] = await pool.query(
      `SELECT \`roll_no\`, \`student_name\`, \`father_name\`, \`mother_name\`, \`branch\`, \`year\`,
              COUNT(*) AS paper_count,
              GROUP_CONCAT(DISTINCT \`paper_name\` SEPARATOR ', ') AS papers
       FROM \`${tableName}\` ${where}
       GROUP BY \`roll_no\`, \`student_name\`, \`father_name\`, \`mother_name\`, \`branch\`, \`year\`
       ORDER BY \`student_name\` ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get distinct branches for filter
    const [branches] = await pool.query(
      `SELECT DISTINCT \`branch\` FROM \`${tableName}\` WHERE \`branch\` IS NOT NULL AND \`branch\` != '' ORDER BY \`branch\``
    );

    const statsQuery = 'SELECT COUNT(*) AS totalRecords, COUNT(DISTINCT `branch`) AS totalBranches, COUNT(DISTINCT `paper_name`) AS totalPapers, COUNT(DISTINCT `roll_no`) AS totalStudents FROM `' + tableName + '`';
    const [stats] = await pool.query(statsQuery);

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
