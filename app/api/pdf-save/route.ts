import { NextRequest, NextResponse } from 'next/server';
import { putPublicObject } from '@/lib/storage';

interface StudentPayload {
  rollNo: string;
  name: string;
  photoBase64: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const students: StudentPayload[] = body.students;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: 'No student data provided' }, { status: 400 });
    }

    let photosSaved = 0;

    for (const s of students) {
      if (!s.rollNo || !s.name || !s.photoBase64) continue;
      try {
        const base64Data = s.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        await putPublicObject(`1styearphotos/photo_${s.rollNo}.jpg`, imgBuffer, 'image/jpeg');
        photosSaved++;
      } catch {
        // skip failed photo
      }
    }

    return NextResponse.json({ photosSaved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save photos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
