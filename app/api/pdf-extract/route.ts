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

        /* ─── 4. extract raw JPEGs for fallback ─── */
        const rawJpegs = extractJPEGs(buffer);
        const meaningful = rawJpegs.filter((j) => {
          const dims = jpegDimensions(j);
          return j.length > 2000 && dims && dims.w > 40 && dims.h > 40;
        });
        // remove the logo (most repeated identical image)
        const afterLogo = removeLogo(meaningful);
        // among remaining, keep only the ones that look like photos:
        // photos have high file-size-per-pixel (complex color data)
        // signatures have low file-size-per-pixel (simple B&W strokes)
        const studentPhotos = afterLogo.filter((j) => {
          const dims = jpegDimensions(j);
          if (!dims) return false;
          const bytesPerPixel = j.length / (dims.w * dims.h);
          // photos typically > 0.15 bytes/pixel, signatures < 0.08
          return bytesPerPixel > 0.10 && dims.h >= dims.w * 0.8;
        });

        /* ─── 5. build photo lookup: prefer pdf-parse images, fallback to raw jpegs ─── */
        // Step A: detect logo by finding image dims that appear on many pages
        const dimPageCount = new Map<string, number>();
        for (const pg of imgResult.pages) {
          const seenDims = new Set<string>();
          for (const img of pg.images) {
            const dk = `${img.width}x${img.height}`;
            if (!seenDims.has(dk)) { seenDims.add(dk); dimPageCount.set(dk, (dimPageCount.get(dk) || 0) + 1); }
          }
        }
        // logo dims: appears on > 50% of pages
        const logoDims = new Set<string>();
        for (const [dk, cnt] of dimPageCount) {
          if (cnt > totalPages * 0.5 && cnt > 1) logoDims.add(dk);
        }

        const pagePhotos: Map<number, string> = new Map();
        for (const pg of imgResult.pages) {
          if (pg.images.length === 0) continue;
          // filter out tiny images & logo images
          const candidates = pg.images.filter(
            (img: { width: number; height: number; dataUrl: string }) =>
              img.width > 30 && img.height > 30 && img.dataUrl &&
              !logoDims.has(`${img.width}x${img.height}`)
          );
          if (candidates.length === 0) continue;

          // pick the image with the MOST data (largest dataUrl) = most complex = photo
          // signatures are simple B&W and compress to small data; photos are color-rich
          const best = candidates.sort(
            (a: { dataUrl: string }, b: { dataUrl: string }) =>
              b.dataUrl.length - a.dataUrl.length
          )[0];
          if (best) pagePhotos.set(pg.pageNumber, best.dataUrl);
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
