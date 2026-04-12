import { NextRequest, NextResponse } from 'next/server';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const DEFAULT_PDF_RELATIVE_PATH = 'forms-1styear/mechanical-engineering.pdf';
const OUTPUT_ROOT = path.join(process.cwd(), 'data', 'extractions');

type EducationRow = {
  exam: string;
  rollNo: string;
  year: string;
  stream: string;
  board: string;
  obtainedMarks: string;
  maxMarks: string;
  percentage: string;
  cgpa: string;
  result: string;
};

type StudentFields = {
  applicantName: string;
  fatherName: string;
  motherName: string;
  gender: string;
  dateOfBirth: string;
  status: string;
  caste: string;
  categoryIAndII: string;
  categoryIII: string;
  specializationBranch: string;
  admissionStatus: string;
  earlierEnrollmentNo: string;
  permanentAddress: string;
  correspondenceAddress: string;
  mobileNo: string;
  parentMobileNo: string;
  entranceExamRollNo: string;
  entranceExamName: string;
  meritSecured: string;
  email: string;
  hasAadharCard: string;
  aadharNo: string;
  educationalQualification: string;
  collegeShift: string;
};

type StudentRecord = {
  pageNumber: number;
  metadata: {
    formType: string;
    session: string;
    college: string;
    branchName: string;
  };
  fields: StudentFields;
  educationRows: EducationRow[];
  rawText: string;
};

type ExtractionPayload = {
  sourceFile: string;
  outputFile: string;
  extractedAt: string;
  totalPages: number;
  totalRecords: number;
  records: StudentRecord[];
};

const FIELD_LABELS: Array<{ key: keyof StudentFields; pattern: string }> = [
  { key: 'applicantName', pattern: '1\\.\\s*Applicant\\s+Name\\s+in\\s+English' },
  { key: 'fatherName', pattern: "2\\.\\s*Father'?s\\s+Name\\s+in\\s+English" },
  { key: 'motherName', pattern: "3\\.\\s*Mother'?s\\s+Name\\s+in\\s+English" },
  { key: 'gender', pattern: '4\\.\\s*Gender' },
  { key: 'dateOfBirth', pattern: '5\\.\\s*Date\\s+of\\s+Birth' },
  { key: 'status', pattern: '6\\.\\s*Status' },
  { key: 'caste', pattern: '7\\.\\s*Caste' },
  { key: 'categoryIAndII', pattern: '8\\.\\s*Category\\s*-\\s*I\\s*&\\s*II' },
  { key: 'categoryIII', pattern: '9\\.\\s*Category\\s*-\\s*III' },
  { key: 'specializationBranch', pattern: '10\\.\\s*Specialization\\s*\\/\\s*Branch' },
  { key: 'admissionStatus', pattern: '11\\.\\s*Admission\\s+Status' },
  { key: 'earlierEnrollmentNo', pattern: '12\\.\\s*Earlier\\s+Enrollment\\s+No' },
  { key: 'permanentAddress', pattern: '13\\.\\s*Permanent\\s+Address' },
  { key: 'correspondenceAddress', pattern: '14\\.\\s*Corr\\.?\\s*Address' },
  { key: 'mobileNo', pattern: '15\\.\\s*Mobile\\s+No' },
  { key: 'parentMobileNo', pattern: '16\\.\\s*Parent\\s+Mobile\\s+No' },
  { key: 'entranceExamRollNo', pattern: '17\\.\\s*Entrance\\s+Exam\\s+Roll\\s+No' },
  { key: 'entranceExamName', pattern: '18\\.\\s*Entrance\\s+Exam\\s+Name' },
  { key: 'meritSecured', pattern: '19\\.\\s*Merit\\s+Secured' },
  { key: 'email', pattern: '20\\.\\s*Email' },
  { key: 'hasAadharCard', pattern: '21\\.\\s*You\\s+have\\s+Aadhar\\s+Card' },
  { key: 'aadharNo', pattern: '22\\.\\s*A(?:a|d)har\\s+No\\.' },
  { key: 'educationalQualification', pattern: '23\\.\\s*Educational\\s+Qualification' },
  { key: 'collegeShift', pattern: '24\\.\\s*College\\s+Shift' },
];

function normalizeSpaces(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForParsing(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function toRelativeWorkspacePath(absPath: string): string {
  return path.relative(process.cwd(), absPath).split(path.sep).join('/');
}

function resolvePdfRelativePath(input?: string): string {
  const value = String(input || DEFAULT_PDF_RELATIVE_PATH)
    .trim()
    .replace(/\\/g, '/');

  if (!/^forms-1styear\/[a-zA-Z0-9._-]+\.pdf$/i.test(value)) {
    throw new Error('Invalid PDF path. Use files inside public/forms-1styear.');
  }

  return value;
}

function outputJsonPathForPdf(pdfRelativePath: string): string {
  const parsed = path.posix.parse(pdfRelativePath);
  return path.join(OUTPUT_ROOT, parsed.dir, `${parsed.name}.json`);
}

function pick(text: string, re: RegExp): string {
  const m = text.match(re);
  return normalizeSpaces(m?.[1] || '');
}

function extractFields(text: string): StudentFields {
  const out = {} as StudentFields;

  for (let i = 0; i < FIELD_LABELS.length; i++) {
    const cur = FIELD_LABELS[i];
    const next = FIELD_LABELS[i + 1];
    const stop = next
      ? `${next.pattern}\\s*:`
      : '(?:Exam\\s+Roll\\s+No\\.|I\\s+have\\s+passed\\s+qualifying\\s+Exam|Declaration\\s+by\\s+the\\s+student|$)';

    const re = new RegExp(`${cur.pattern}\\s*:\\s*([\\s\\S]*?)(?=${stop})`, 'i');
    out[cur.key] = normalizeSpaces((text.match(re)?.[1] || ''));
  }

  return out;
}

function parseEducationRows(text: string): EducationRow[] {
  const rows: EducationRow[] = [];
  const flat = normalizeSpaces(text);

  const re = /(SSC\s*\/\s*10th\s*\/\s*Matric|HSC\s*\/\s*12th\s*\/\s*Diploma)\s+([A-Za-z0-9./-]+)\s+(\d{4})\s+([A-Za-z0-9./-]+)\s+([A-Za-z0-9./-]+)\s+([A-Za-z0-9./-]+)\s+([A-Za-z0-9./-]+)\s+([A-Za-z0-9./-]+)\s+([A-Za-z0-9./-]+)\s+([A-Za-z0-9./-]+)/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(flat)) !== null) {
    rows.push({
      exam: normalizeSpaces(m[1].replace(/\s*\/\s*/g, ' / ')),
      rollNo: m[2],
      year: m[3],
      stream: m[4],
      board: m[5],
      obtainedMarks: m[6],
      maxMarks: m[7],
      percentage: m[8],
      cgpa: m[9],
      result: m[10],
    });
  }

  return rows;
}

function parseStudentPage(pageText: string, pageNumber: number): StudentRecord {
  const normalized = normalizeForParsing(pageText);

  const metadata = {
    formType: pick(normalized, /UPDATED\s+ENROLLMENT\s+FORM\s*:\s*([\s\S]*?)(?=SESSION\s*:|COLLEGE\s*:|BRANCH\s+NAME\s*:|1\.)/i),
    session: pick(normalized, /SESSION\s*:\s*([0-9]{4}\s*-\s*[0-9]{4})/i),
    college: pick(normalized, /COLLEGE\s*:\s*([\s\S]*?)(?=BRANCH\s+NAME\s*:|1\.)/i),
    branchName: pick(normalized, /BRANCH\s+NAME\s*:\s*([\s\S]*?)(?=1\.\s*Applicant\s+Name\s+in\s+English|$)/i),
  };

  return {
    pageNumber,
    metadata,
    fields: extractFields(normalized),
    educationRows: parseEducationRows(normalized),
    rawText: normalized,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPageText(items: any[]): string {
  const lines: Array<{ y: number; parts: Array<{ x: number; text: string }> }> = [];

  for (const item of items as Array<{ str?: string; transform?: number[] }>) {
    const raw = String(item.str || '');
    const text = raw.replace(/\u00a0/g, ' ').trim();
    if (!text) continue;

    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);

    let line = lines.find(l => Math.abs(l.y - y) < 2.5);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, text });
  }

  lines.sort((a, b) => b.y - a.y);

  return lines
    .map(line => line.parts.sort((a, b) => a.x - b.x).map(p => p.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

async function extractPageTexts(pdfBuffer: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as any;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    pages.push(buildPageText(text.items || []));
  }

  return pages;
}

async function runExtraction(pdfRelativePath: string): Promise<ExtractionPayload> {
  const pdfAbsolutePath = path.join(process.cwd(), 'public', pdfRelativePath);
  const outputPath = outputJsonPathForPdf(pdfRelativePath);

  const pdfBuffer = await readFile(pdfAbsolutePath);
  const pageTexts = await extractPageTexts(pdfBuffer);

  const records = pageTexts
    .map((txt, idx) => parseStudentPage(txt, idx + 1))
    .filter(r => Boolean(r.fields.applicantName || r.fields.mobileNo || r.fields.email));

  const payload: ExtractionPayload = {
    sourceFile: pdfRelativePath,
    outputFile: toRelativeWorkspacePath(outputPath),
    extractedAt: new Date().toISOString(),
    totalPages: pageTexts.length,
    totalRecords: records.length,
    records,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');

  return payload;
}

function isFileNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT';
}

export async function GET(req: NextRequest) {
  try {
    const file = resolvePdfRelativePath(new URL(req.url).searchParams.get('file') || undefined);
    const outputPath = outputJsonPathForPdf(file);

    let raw: string;
    try {
      raw = await readFile(outputPath, 'utf8');
    } catch (err) {
      if (isFileNotFound(err)) {
        return NextResponse.json({
          exists: false,
          sourceFile: file,
          outputFile: toRelativeWorkspacePath(outputPath),
          message: 'No extracted JSON found yet. Run extraction first.',
        });
      }
      throw err;
    }

    const data = JSON.parse(raw) as ExtractionPayload;
    return NextResponse.json({ exists: true, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read extraction data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: { file?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const file = resolvePdfRelativePath(body.file);
    const result = await runExtraction(file);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
