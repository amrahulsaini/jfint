import { NextResponse } from 'next/server';
import { cacheGetJson, cacheSetJson } from '@/lib/cache';
import { getPool } from '@/lib/db';

const ALLOWED_TABLES = ['jecr_2ndyear', '1styearmaster'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

const FIRST_YEAR_COMM_TABLE = '2528firstyear_comm';
const STUDENTS_CACHE_TTL_SECONDS = 40;

/* ─── Server-side cache (lives for the Node.js process lifetime) ─────────────
   branches/genders/stats almost never change — cache them aggressively so
   only the first request pays the cost, every subsequent request is instant. */
interface MetaCache {
  branches: string[];
  genders: string[];
  stats: Record<string, number>;
  expiresAt: number;
}
const META_TTL_MS = 5 * 60 * 1000; // 5 minutes
const metaCache: Record<string, MetaCache> = {};

function getCachedMeta(key: string): MetaCache | null {
  const c = metaCache[key];
  if (c && c.expiresAt > Date.now()) return c;
  return null;
}
function setCachedMeta(key: string, data: Omit<MetaCache, 'expiresAt'>) {
  metaCache[key] = { ...data, expiresAt: Date.now() + META_TTL_MS };
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
  const cacheKey = [
    'db-students-v3',
    encodeURIComponent(tableName),
    page,
    limit,
    encodeURIComponent(search.toLowerCase()),
    encodeURIComponent(branch.toLowerCase()),
    encodeURIComponent(gender.toLowerCase()),
  ].join(':');

  const cached = await cacheGetJson<Record<string, unknown>>(cacheKey);
  if (cached) {
    const hit = NextResponse.json(cached);
    hit.headers.set('X-Cache', 'HIT');
    return hit;
  }

  try {
    const pool = getPool();

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

    if (isFirstYearMaster) {
      // ── Build meta cache key (branches/genders/stats don't change with page/search) ──
      const metaKey = `1styear`;
      const cached = getCachedMeta(metaKey);

      // ── Fire count + rows queries in PARALLEL (don't wait sequentially) ──
      const countPromise = pool.query(
        `SELECT COUNT(*) AS total FROM \`${FIRST_YEAR_COMM_TABLE}\` fc ${where}`,
        params,
      );

      // Use LEFT JOIN with a grouped subquery for paper_count — much faster
      // than correlated subquery when there's an index on roll_no
      const rowsPromise = pool.query(
        `SELECT fc.\`roll_no\`, fc.\`student_name\`, fc.\`father_name\`, fc.\`mother_name\`,
                fc.\`branch\`, fc.\`year\`, fc.\`gender\`,
                COALESCE(pc.paper_count, 0) AS paper_count,
                '' AS papers
         FROM \`${FIRST_YEAR_COMM_TABLE}\` fc
         LEFT JOIN (
           SELECT \`roll_no\`, COUNT(*) AS paper_count
           FROM \`jecr_1styear\`
           GROUP BY \`roll_no\`
         ) pc ON pc.\`roll_no\` = fc.\`roll_no\`
         ${where}
         ORDER BY fc.\`student_name\` ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      // ── Fetch meta (branches/genders/stats) in parallel only if not cached ──
      let metaPromise: Promise<{ branches: string[]; genders: string[]; stats: Record<string, number> }>;
      if (cached) {
        metaPromise = Promise.resolve({ branches: cached.branches, genders: cached.genders, stats: cached.stats });
      } else {
        metaPromise = (async () => {
          const [branchRes, genderRes, statsRes] = await Promise.all([
            pool.query(
              `SELECT DISTINCT \`branch\` FROM \`${FIRST_YEAR_COMM_TABLE}\`
               WHERE \`roll_no\` LIKE '25%' AND \`branch\` IS NOT NULL AND \`branch\` != ''
               ORDER BY \`branch\``,
            ),
            pool.query(
              `SELECT DISTINCT \`gender\` FROM \`${FIRST_YEAR_COMM_TABLE}\`
               WHERE \`roll_no\` LIKE '25%' AND \`gender\` IS NOT NULL AND \`gender\` != ''
               ORDER BY \`gender\``,
            ),
            pool.query(
              `SELECT
                 (SELECT COUNT(*) FROM \`jecr_1styear\` WHERE \`roll_no\` LIKE '25%') AS totalRecords,
                 (SELECT COUNT(DISTINCT \`branch\`) FROM \`${FIRST_YEAR_COMM_TABLE}\` WHERE \`roll_no\` LIKE '25%' AND \`branch\` IS NOT NULL AND \`branch\` != '') AS totalBranches,
                 (SELECT COUNT(DISTINCT \`paper_name\`) FROM \`jecr_1styear\` WHERE \`roll_no\` LIKE '25%') AS totalPapers,
                 (SELECT COUNT(*) FROM \`${FIRST_YEAR_COMM_TABLE}\` WHERE \`roll_no\` LIKE '25%') AS totalStudents`,
            ),
          ]);
          const branches = (branchRes[0] as { branch: string }[]).map(b => b.branch);
          const genders = (genderRes[0] as { gender: string }[]).map(g => g.gender);
          const stats = (statsRes[0] as Record<string, number>[])[0];
          setCachedMeta(metaKey, { branches, genders, stats });
          return { branches, genders, stats };
        })();
      }

      // ── Await all in parallel ──
      const [[countResult], [rowsResult], meta] = await Promise.all([countPromise, rowsPromise, metaPromise]);
      const total = (countResult as { total: number }[])[0].total;

      const payload = {
        rows: rowsResult,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        branches: meta.branches,
        genders: meta.genders,
        stats: meta.stats,
      };

      await cacheSetJson(cacheKey, payload, STUDENTS_CACHE_TTL_SECONDS);
      const miss = NextResponse.json(payload);
      miss.headers.set('X-Cache', 'MISS');
      return miss;

    } else {
      // ── 2nd year: run all 3 queries in parallel ──
      const [countResult, rowsResult, branchResult, statsResult] = await Promise.all([
        pool.query(
          `SELECT COUNT(DISTINCT \`roll_no\`) AS total FROM \`${tableName}\` ${where}`,
          params,
        ),
        pool.query(
          `SELECT \`roll_no\`, \`student_name\`, \`father_name\`, \`mother_name\`, \`branch\`, \`year\`,
                  COUNT(*) AS paper_count,
                  GROUP_CONCAT(DISTINCT \`paper_name\` SEPARATOR ', ') AS papers
           FROM \`${tableName}\` ${where}
           GROUP BY \`roll_no\`, \`student_name\`, \`father_name\`, \`mother_name\`, \`branch\`, \`year\`
           ORDER BY \`student_name\` ASC
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        ),
        pool.query(
          `SELECT DISTINCT \`branch\` FROM \`${tableName}\` WHERE \`branch\` IS NOT NULL AND \`branch\` != '' ORDER BY \`branch\``,
        ),
        pool.query(
          `SELECT COUNT(*) AS totalRecords, COUNT(DISTINCT \`branch\`) AS totalBranches,
                  COUNT(DISTINCT \`paper_name\`) AS totalPapers, COUNT(DISTINCT \`roll_no\`) AS totalStudents
           FROM \`${tableName}\``,
        ),
      ]);

      const total = (countResult[0] as { total: number }[])[0].total;

      const payload = {
        rows: rowsResult[0],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        branches: (branchResult[0] as { branch: string }[]).map(b => b.branch),
        genders: [],
        stats: (statsResult[0] as Record<string, number>[])[0],
      };

      await cacheSetJson(cacheKey, payload, STUDENTS_CACHE_TTL_SECONDS);
      const miss = NextResponse.json(payload);
      miss.headers.set('X-Cache', 'MISS');
      return miss;
    }

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database connection failed';
    return NextResponse.json({ error: message, rows: [], total: 0 }, { status: 500 });
  }
}
