import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        id, 
        email, 
        created_at as createdAt, 
        expires_at as expiresAt, 
        ip_address as ipAddress
      FROM portal_sessions 
      ORDER BY created_at DESC 
      LIMIT 1000
    `);

    return NextResponse.json({ success: true, activities: rows });
  } catch (error) {
    console.error('[activity]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch activity.' }, { status: 500 });
  }
}
