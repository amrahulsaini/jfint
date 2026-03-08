import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import pool from '@/lib/db';

interface StudentPayload {
  rollNo: string;
  enrollmentNo: string;
  name: string;
  fatherName: string;
  motherName: string;
  branch: string;
  exam: string;
  photoBase64: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const students: StudentPayload[] = body.students;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 });
    }

    // 1. Ensure student_photos directory exists
    const photoDir = path.join(process.cwd(), 'public', 'student_photos');
    await mkdir(photoDir, { recursive: true });

    // 2. Create table if not exists
    const conn = await pool.getConnection();
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS \`1styearmaster\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          roll_no VARCHAR(50) NOT NULL,
          enrollment_no VARCHAR(50) DEFAULT '',
          student_name VARCHAR(200) NOT NULL,
          father_name VARCHAR(200) DEFAULT '',
          mother_name VARCHAR(200) DEFAULT '',
          branch VARCHAR(100) DEFAULT '',
          exam VARCHAR(200) DEFAULT '',
          photo_saved TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_roll (roll_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      let saved = 0;
      let photosSaved = 0;

      for (const s of students) {
        if (!s.rollNo || !s.name) continue;

        // 3. Save photo to disk
        let photoOk = false;
        if (s.photoBase64) {
          try {
            const base64Data = s.photoBase64.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            const filePath = path.join(photoDir, `photo_${s.rollNo}.jpg`);
            await writeFile(filePath, imgBuffer);
            photoOk = true;
            photosSaved++;
          } catch {
            // photo save failed, continue
          }
        }

        // 4. Insert into DB (REPLACE to handle duplicates)
        await conn.execute(
          `REPLACE INTO \`1styearmaster\`
           (roll_no, enrollment_no, student_name, father_name, mother_name, branch, exam, photo_saved)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.rollNo,
            s.enrollmentNo || '',
            s.name,
            s.fatherName || '',
            s.motherName || '',
            s.branch || '',
            s.exam || '',
            photoOk ? 1 : 0,
          ]
        );
        saved++;
      }

      return NextResponse.json({ saved, photosSaved });
    } finally {
      conn.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
