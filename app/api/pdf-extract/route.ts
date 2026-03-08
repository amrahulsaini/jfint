import { NextRequest, NextResponse } from 'next/server';

/* ── helpers ──────────────────────────────────────────────────── */

/** Scan PDF buffer for raw JPEG streams (DCTDecode images) */
function extractJPEGs(buf: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let pos = 0;
  while (pos < buf.length - 3) {
    if (buf[pos] === 0xff && buf[pos + 1] === 0xd8 && buf[pos + 2] === 0xff) {
      const start = pos;
      pos += 3;
      while (pos < buf.length - 1) {
        if (buf[pos] === 0xff && buf[pos + 1] === 0xd9) {
          jpegs.push(Buffer.from(buf.subarray(start, pos + 2)));
          pos += 2;
          break;
        }
        pos++;
      }
    } else {
      pos++;
    }
  }
  return jpegs;
}

/** Read JPEG dimensions from SOF marker */
function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  let pos = 2;
  while (pos < buf.length - 9) {
    if (buf[pos] !== 0xff) return null;
    const marker = buf[pos + 1];
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return { h: buf.readUInt16BE(pos + 5), w: buf.readUInt16BE(pos + 7) };
    }
    if (pos + 3 >= buf.length) break;
    pos += 2 + buf.readUInt16BE(pos + 2);
  }
  return null;
}

/** Extract a field value from raw page text */
function field(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** Parse admission card text into structured data */
function parseAdmissionCard(text: string) {
  const t = text.replace(/\s+/g, ' ');
  return {
    rollNo: field(t, /Roll\s*Number\s*:?\s*(\S+)/i),
    enrollmentNo: field(t, /Enrollment\s*Number\s*:?\s*(\S+)/i),
    name: field(t, /Name\s*Of\s*Candidate\s*:?\s*(.+?)(?=Father)/i),
    fatherName: field(t, /Father'?s?\s*Name\s*:?\s*(.+?)(?=Mother)/i),
    motherName: field(t, /Mother'?s?\s*Name\s*:?\s*(.+?)(?=Course)/i),
    branch: field(t, /Branch\/?Specialization\s*:?\s*(.+?)(?=Centre|College|Center|$)/i),
    exam: field(t, /Name\s*Of\s*Examination\s*:?\s*(.+?)(?=Enrollment|$)/i),
  };
}

/** Deduplicate identical buffers, returns unique items */
function dedupeBuffers(bufs: Buffer[]): { unique: Buffer[]; duplicateHash: string } {
  const map = new Map<string, { buf: Buffer; count: number }>();
  for (const b of bufs) {
    // use first 200 + last 200 bytes as quick hash
    const key =
      b.subarray(0, Math.min(200, b.length)).toString('hex') +
      ':' +
      b.subarray(Math.max(0, b.length - 200)).toString('hex');
    const entry = map.get(key);
    if (entry) entry.count++;
    else map.set(key, { buf: b, count: 1 });
  }
  // The image appearing most times (or first with count > 1) is likely the logo
  let logoHash = '';
  let maxCount = 0;
  for (const [k, v] of map) {
    if (v.count > maxCount) {
      maxCount = v.count;
      logoHash = k;
    }
  }
  // If the most-repeated image appears only once, there's no logo duplicate
  // In that case, try to identify logo by smallest size
  if (maxCount <= 1) logoHash = '';

  const unique = bufs.filter((b) => {
    const key =
      b.subarray(0, Math.min(200, b.length)).toString('hex') +
      ':' +
      b.subarray(Math.max(0, b.length - 200)).toString('hex');
    return key !== logoHash;
  });

  return { unique, duplicateHash: logoHash };
}

/* ── route handler ────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Please upload a valid PDF file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Extract text per page using pdf-parse
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');

    const pageTexts: string[] = [];

    await pdfParse(buffer, {
      pagerender: async (pageData: { getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }> }) => {
        const tc = await pageData.getTextContent();
        const items = tc.items.slice();
        // Sort top-to-bottom, left-to-right
        items.sort((a, b) => {
          const yDiff = b.transform[5] - a.transform[5];
          if (Math.abs(yDiff) > 5) return yDiff;
          return a.transform[4] - b.transform[4];
        });
        const text = items.map((i) => i.str).join(' ');
        pageTexts.push(text);
        return text;
      },
    });

    // 2. Extract JPEG images from raw PDF bytes
    const allJpegs = extractJPEGs(buffer);

    // 3. Filter to meaningful images (ignore tiny icons)
    const meaningful = allJpegs.filter((j) => {
      const dims = jpegDimensions(j);
      return j.length > 1500 && dims && dims.w > 20 && dims.h > 20;
    });

    // 4. Remove logo duplicates
    let { unique: studentPhotos } = dedupeBuffers(meaningful);

    // If we still have more photos than pages, keep only the largest N
    if (studentPhotos.length > pageTexts.length) {
      const sized = studentPhotos.map((b, i) => ({ b, i, sz: b.length }));
      sized.sort((a, b) => b.sz - a.sz);
      const keep = sized.slice(0, pageTexts.length);
      keep.sort((a, b) => a.i - b.i);
      studentPhotos = keep.map((k) => k.b);
    }

    // 5. Build student records
    const students = pageTexts.map((text, i) => {
      const parsed = parseAdmissionCard(text);
      const photo = studentPhotos[i];
      const dims = photo ? jpegDimensions(photo) : null;
      return {
        pageNum: i + 1,
        ...parsed,
        photoBase64: photo ? `data:image/jpeg;base64,${photo.toString('base64')}` : null,
        photoWidth: dims?.w || 0,
        photoHeight: dims?.h || 0,
      };
    });

    return NextResponse.json({
      totalPages: pageTexts.length,
      totalPhotosFound: allJpegs.length,
      totalStudentPhotos: studentPhotos.length,
      students,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
