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

/** Parse admission card text → structured fields */
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

        /* ─── 3. get all images (with base64 dataUrls) ─── */
        const imgResult = await parser.getImage({ imageDataUrl: true, imageBuffer: false, imageThreshold: 20 });

        /* ─── 4. extract raw JPEGs for fallback + dedup ─── */
        const rawJpegs = extractJPEGs(buffer);
        const meaningful = rawJpegs.filter((j) => {
          const dims = jpegDimensions(j);
          // must be reasonable size, not tiny, and portrait-ish (photo, not signature)
          return j.length > 1500 && dims && dims.w > 20 && dims.h > 20 && dims.h >= dims.w;
        });
        let studentPhotos = removeLogo(meaningful);

        /* ─── 5. build photo lookup: prefer pdf-parse images, fallback to raw jpegs ─── */
        // pdf-parse provides images per page
        const pagePhotos: Map<number, string> = new Map();
        for (const pg of imgResult.pages) {
          if (pg.images.length > 0) {
            // separate portrait images (photos) from landscape (signatures)
            const candidates = pg.images.filter(
              (img: { width: number; height: number; dataUrl: string }) =>
                img.width > 30 && img.height > 30 && img.dataUrl
            );
            // prefer portrait (height >= width) — passport photos
            const portraits = candidates.filter(
              (img: { width: number; height: number }) => img.height >= img.width
            );
            const pool = portraits.length > 0 ? portraits : candidates;
            // pick the largest from the filtered pool
            const best = pool.sort(
              (a: { width: number; height: number }, b: { width: number; height: number }) =>
                (b.width * b.height) - (a.width * a.height)
            )[0];
            if (best) pagePhotos.set(pg.pageNumber, best.dataUrl);
          }
        }

        /* ─── 6. process page by page & stream ─── */
        for (let i = 0; i < totalPages; i++) {
          const pageNum = i + 1;
          const pageText = textResult.pages.find((p: { num: number }) => p.num === pageNum)?.text || '';
          const parsed = parseAdmissionCard(pageText);

          // photo: first try pdf-parse per-page image, then fallback to raw jpeg by index
          let photoBase64 = pagePhotos.get(pageNum) || null;
          if (!photoBase64 && studentPhotos[i]) {
            photoBase64 = `data:image/jpeg;base64,${studentPhotos[i].toString('base64')}`;
          }

          const dims = studentPhotos[i] ? jpegDimensions(studentPhotos[i]) : null;

          send('page', {
            pageNum,
            ...parsed,
            photoBase64,
            photoWidth: dims?.w || 0,
            photoHeight: dims?.h || 0,
          });
        }

        await parser.destroy();

        send('done', {
          totalPages,
          totalPhotosFound: rawJpegs.length,
          totalStudentPhotos: studentPhotos.length,
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
