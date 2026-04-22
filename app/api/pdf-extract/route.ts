import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { promisify } from 'util';

/* ── helpers ──────────────────────────────────────────────────── */

/** Extract a regex group from text */
function field(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** Strip Hindi / non-ASCII text + clean junk chars like ] \ */
function englishOnly(s: string): string {
  let cleaned = s.replace(/\s*\(.*$/, '').trim();
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
  // remove stray ] \ at end from pdf extraction artifacts
  cleaned = cleaned.replace(/[\]\[\\\/]+\s*$/, '').trim();
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

function uniqueImages(images: string[]) {
  return [...new Set(images.filter(Boolean))];
}

const execFileAsync = promisify(execFile);

interface PythonPageResult {
  pageNum: number;
  text: string;
  photoBase64: string | null;
  photoWidth: number;
  photoHeight: number;
  alternatives: string[];
}

interface PythonExtractResult {
  totalPages: number;
  pages: PythonPageResult[];
}

async function runPythonExtractor(pdfPath: string, outputPath: string): Promise<PythonExtractResult> {
  const scriptPathFromEnv = process.env.PDF_EXTRACT_SCRIPT_PATH?.trim();
  const scriptPath = scriptPathFromEnv && scriptPathFromEnv.length > 0
    ? scriptPathFromEnv
    : ['scripts', 'extract_student_photos.py'].join(path.sep);
  const preferredPython = process.env.PYTHON_PATH || 'C:/Users/ammra/AppData/Local/Programs/Python/Python313/python.exe';
  const candidates = process.platform === 'win32'
    ? [
        { cmd: preferredPython, args: [scriptPath, pdfPath, outputPath] },
        { cmd: 'py', args: ['-3', scriptPath, pdfPath, outputPath] },
        { cmd: 'python', args: [scriptPath, pdfPath, outputPath] },
      ]
    : [
        { cmd: preferredPython, args: [scriptPath, pdfPath, outputPath] },
        { cmd: 'python3', args: [scriptPath, pdfPath, outputPath] },
        { cmd: 'python', args: [scriptPath, pdfPath, outputPath] },
      ];

  let lastError = 'Python extractor failed';

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.cmd, candidate.args, {
        maxBuffer: 10 * 1024 * 1024,
      });
      const json = await readFile(outputPath, 'utf-8');
      return JSON.parse(json) as PythonExtractResult;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError);
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let tempDir = '';

      try {
        tempDir = await mkdtemp(`${os.tmpdir()}${path.sep}jfint-`);
        const tempPdfPath = `${tempDir}${path.sep}upload.pdf`;
        const tempJsonPath = `${tempDir}${path.sep}extract-result.json`;
        await writeFile(tempPdfPath, buffer);

        const extracted = await runPythonExtractor(tempPdfPath, tempJsonPath);
        const totalPages = extracted.totalPages;
        send('init', { totalPages });
        let totalPhotosFound = 0;

        for (const page of extracted.pages) {
          const parsed = parseAdmissionCard(page.text || '');
          const alternatives = uniqueImages(page.alternatives || []);
          if (page.photoBase64) totalPhotosFound++;

          send('page', {
            pageNum: page.pageNum,
            ...parsed,
            photoBase64: page.photoBase64,
            photoWidth: page.photoWidth || 0,
            photoHeight: page.photoHeight || 0,
            alternatives,
          });
        }
        send('done', { totalPages, totalStudentPhotos: totalPhotosFound });
      } catch (err: unknown) {
        send('error', { error: err instanceof Error ? err.message : 'Failed to process PDF' });
      } finally {
        if (tempDir) {
          await rm(tempDir, { recursive: true, force: true });
        }
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
