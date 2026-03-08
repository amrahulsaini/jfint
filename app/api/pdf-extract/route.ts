import { NextRequest } from 'next/server';

/* ── helpers ──────────────────────────────────────────────────── */

/** Scan PDF buffer for raw JPEG streams (FF D8 … FF D9) */
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

/** Read JPEG width/height from SOF marker */
function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  let pos = 2;
  while (pos < buf.length - 9) {
    if (buf[pos] !== 0xff) return null;
    const marker = buf[pos + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(pos + 5), w: buf.readUInt16BE(pos + 7) };
    }
    if (pos + 3 >= buf.length) break;
    pos += 2 + buf.readUInt16BE(pos + 2);
  }
  return null;
}

/** Quick hash for dedup (first 200 + last 200 bytes) */
function bufKey(b: Buffer): string {
  return (
    b.subarray(0, Math.min(200, b.length)).toString('hex') +
    ':' +
    b.subarray(Math.max(0, b.length - 200)).toString('hex')
  );
}

/** Remove the most-repeated image (logo) from list */
function removeLogo(bufs: Buffer[]): Buffer[] {
  const counts = new Map<string, number>();
  for (const b of bufs) {
    const k = bufKey(b);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let logoKey = '';
  let maxC = 0;
  for (const [k, c] of counts) {
    if (c > maxC) { maxC = c; logoKey = k; }
  }
  if (maxC <= 1) return bufs; // no duplicate = no logo
  return bufs.filter((b) => bufKey(b) !== logoKey);
}

/** Extract a regex group from text */
function field(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** Strip Hindi / non-ASCII text: keep only up to first '(' or non-Latin char */
function englishOnly(s: string): string {
  // remove anything from '(' onward  e.g. "AJAY YADAV (अजय yadav)" → "AJAY YADAV"
  let cleaned = s.replace(/\s*\(.*$/, '').trim();
  // also strip any remaining non-ASCII characters (Devanagari etc.)
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned;
}

/** Parse admission card text → structured fields */
function parseAdmissionCard(text: string) {
  const t = text.replace(/\s+/g, ' ');
  return {
    rollNo: field(t, /Roll\s*Number\s*:?\s*(\S+)/i),
    enrollmentNo: field(t, /Enrollment\s*Number\s*:?\s*(\S+)/i),
    name: englishOnly(field(t, /Name\s*Of\s*Candidate\s*:?\s*(.+?)(?=Father)/i)),
    fatherName: englishOnly(field(t, /Father'?s?\s*Name\s*:?\s*(.+?)(?=Mother)/i)),
    motherName: englishOnly(field(t, /Mother'?s?\s*Name\s*:?\s*(.+?)(?=Course)/i)),
    branch: field(t, /Branch\/?Specialization\s*:?\s*(.+?)(?=Centre|College|Center|$)/i),
    exam: field(t, /Name\s*Of\s*Examination\s*:?\s*(.+?)(?=Enrollment|$)/i),
  };
}

/* ── SSE stream: one event per page ───────────────────────────── */

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('pdf') as File | null;
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    return new Response(JSON.stringify({ error: 'Please upload a valid PDF file' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require('pdf-parse');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        /* ─── 1. load PDF ─── */
        const parser = new PDFParse({ data: buffer });

        /* ─── 2. get text per page ─── */
        const textResult = await parser.getText();
        const totalPages: number = textResult.total;
        send('init', { totalPages });

        /* ─── 3. extract student photos from raw JPEG streams ─── */
        // Scan the PDF binary for embedded JPEG images
        const rawJpegs = extractJPEGs(buffer);
        const meaningful = rawJpegs.filter((j) => {
          const dims = jpegDimensions(j);
          return j.length > 800 && dims && dims.w > 20 && dims.h > 20;
        });
        // remove logos: any image that appears more than once is a logo
        const afterLogo = removeLogo(meaningful);

        // Each admission card page has ~2 images after logo removal: photo + signature
        // Photo is ALWAYS bigger in byte size than signature (color photo vs B&W strokes)
        // Group images by page: we know totalPages, so split into groups
        const imgsPerPage = Math.max(1, Math.round(afterLogo.length / totalPages));
        const pagePhotoMap: Map<number, string> = new Map();

        for (let i = 0; i < totalPages; i++) {
          const start = i * imgsPerPage;
          const end = Math.min(start + imgsPerPage, afterLogo.length);
          const pageImgs = afterLogo.slice(start, end);
          if (pageImgs.length === 0) continue;
          // pick the one with most bytes = the actual photo (not signature)
          const photo = pageImgs.reduce((best, cur) => cur.length > best.length ? cur : best);
          pagePhotoMap.set(i + 1, `data:image/jpeg;base64,${photo.toString('base64')}`);
        }

        /* ─── 4. process page by page & stream ─── */
        for (let i = 0; i < totalPages; i++) {
          const pageNum = i + 1;
          const pageText = textResult.pages.find((p: { num: number }) => p.num === pageNum)?.text || '';
          const parsed = parseAdmissionCard(pageText);

          const photoBase64 = pagePhotoMap.get(pageNum) || null;

          send('page', {
            pageNum,
            ...parsed,
            photoBase64,
            photoWidth: 0,
            photoHeight: 0,
          });
        }

        await parser.destroy();

        send('done', {
          totalPages,
          totalPhotosFound: rawJpegs.length,
          totalStudentPhotos: pagePhotoMap.size,
        });
      } catch (err: unknown) {
        send('error', { error: err instanceof Error ? err.message : 'Failed to process PDF' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
