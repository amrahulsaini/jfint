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

type ParsedLine = {
  y: number;
  parts: Array<{ x: number; text: string }>;
  text: string;
};

type PageTextBundle = {
  text: string;
  lines: ParsedLine[];
};

type FieldDef = {
  key: keyof StudentFields;
  index: number;
  label: string;
};

const FIELD_DEFS: FieldDef[] = [
  { key: 'applicantName', index: 1, label: 'Applicant\\s+Name\\s+in\\s+English' },
  { key: 'fatherName', index: 2, label: "Father'?s\\s+Name\\s+in\\s+English" },
  { key: 'motherName', index: 3, label: "Mother'?s\\s+Name\\s+in\\s+English" },
  { key: 'gender', index: 4, label: 'Gender' },
  { key: 'dateOfBirth', index: 5, label: 'Date\\s+of\\s+Birth' },
  { key: 'status', index: 6, label: 'Status' },
  { key: 'caste', index: 7, label: 'Caste' },
  { key: 'categoryIAndII', index: 8, label: 'Category\\s*-\\s*I\\s*&\\s*II' },
  { key: 'categoryIII', index: 9, label: 'Category\\s*-\\s*III' },
  { key: 'specializationBranch', index: 10, label: 'Specialization\\s*\\/\\s*Branch' },
  { key: 'admissionStatus', index: 11, label: 'Ad+mission\\s+Status' },
  { key: 'earlierEnrollmentNo', index: 12, label: 'Earlier\\s+Enrollment\\s+No' },
  { key: 'permanentAddress', index: 13, label: 'Permanent\\s+Address' },
  { key: 'correspondenceAddress', index: 14, label: '(?:Corr\\.?\\s*Address|Correspondence\\s*Address)' },
  { key: 'mobileNo', index: 15, label: 'Mobile\\s+No' },
  { key: 'parentMobileNo', index: 16, label: 'Parent\\s+Mobile\\s+No' },
  { key: 'entranceExamRollNo', index: 17, label: 'Ent(?:r)?ance\\s+Exam\\s+Roll\\s+No' },
  { key: 'entranceExamName', index: 18, label: 'Entrance\\s+Exam\\s+Name' },
  { key: 'meritSecured', index: 19, label: 'Merit\\s+Secured' },
  { key: 'email', index: 20, label: 'Email' },
  { key: 'hasAadharCard', index: 21, label: 'You\\s+have\\s+Aadhar\\s+Card' },
  { key: 'aadharNo', index: 22, label: 'A(?:a|d)har\\s+No\\.?' },
  { key: 'educationalQualification', index: 23, label: 'Educational\\s+Qualification' },
  { key: 'collegeShift', index: 24, label: 'College\\s+Shift' },
];

const EMPTY_FIELDS: StudentFields = {
  applicantName: '',
  fatherName: '',
  motherName: '',
  gender: '',
  dateOfBirth: '',
  status: '',
  caste: '',
  categoryIAndII: '',
  categoryIII: '',
  specializationBranch: '',
  admissionStatus: '',
  earlierEnrollmentNo: '',
  permanentAddress: '',
  correspondenceAddress: '',
  mobileNo: '',
  parentMobileNo: '',
  entranceExamRollNo: '',
  entranceExamName: '',
  meritSecured: '',
  email: '',
  hasAadharCard: '',
  aadharNo: '',
  educationalQualification: '',
  collegeShift: '',
};

const FIELD_KEY_BY_INDEX: Record<number, keyof StudentFields> = {
  1: 'applicantName',
  2: 'fatherName',
  3: 'motherName',
  4: 'gender',
  5: 'dateOfBirth',
  6: 'status',
  7: 'caste',
  8: 'categoryIAndII',
  9: 'categoryIII',
  10: 'specializationBranch',
  11: 'admissionStatus',
  12: 'earlierEnrollmentNo',
  13: 'permanentAddress',
  14: 'correspondenceAddress',
  15: 'mobileNo',
  16: 'parentMobileNo',
  17: 'entranceExamRollNo',
  18: 'entranceExamName',
  19: 'meritSecured',
  20: 'email',
  21: 'hasAadharCard',
  22: 'aadharNo',
  23: 'educationalQualification',
  24: 'collegeShift',
};

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

function extractNumberedBlocks(text: string): Array<{ index: number; label: string; value: string }> {
  const section = text.split(/Exam\s+Roll\s+No\./i)[0] || text;
  const marker = /(\d{1,2})\.\s*([A-Za-z&'\/(). -]{1,80}?)\s*:\s*/g;

  const matches: Array<{ index: number; label: string; start: number; valueStart: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = marker.exec(section)) !== null) {
    const index = Number(m[1]);
    if (!Number.isFinite(index) || index < 1 || index > 24) continue;
    matches.push({
      index,
      label: normalizeSpaces(m[2]),
      start: m.index,
      valueStart: marker.lastIndex,
    });
  }

  const blocks: Array<{ index: number; label: string; value: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const valueRaw = section.slice(cur.valueStart, next ? next.start : section.length);
    blocks.push({
      index: cur.index,
      label: cur.label,
      value: normalizeSpaces(valueRaw),
    });
  }

  return blocks;
}

function lineContainsIndex(line: ParsedLine, index: number): boolean {
  const re = new RegExp(`(?:^|\\D)${index}\\.`, 'i');
  return line.parts.some(p => re.test(p.text)) || re.test(line.text);
}

function deriveColumnPivot(lines: ParsedLine[]): number {
  const pairs: Array<[number, number]> = [[13, 14], [15, 16], [11, 12], [17, 18], [19, 20], [21, 22], [23, 24]];

  for (const [left, right] of pairs) {
    const line = lines.find(l => lineContainsIndex(l, left) && lineContainsIndex(l, right));
    if (!line) continue;
    const part = line.parts.find(p => new RegExp(`(?:^|\\D)${right}\\.`, 'i').test(p.text));
    if (part) return part.x - 2;
  }

  return 360;
}

function extractAddressColumns(lines: ParsedLine[]): { permanentAddress: string; correspondenceAddress: string } {
  const startIdx = lines.findIndex(l => /13\.\s*Permanent\s+Address\s*:/i.test(l.text));
  if (startIdx < 0) {
    return { permanentAddress: '', correspondenceAddress: '' };
  }

  const endIdxRaw = lines.findIndex((l, i) => i > startIdx && /15\.\s*Mobile\s+No\s*:/i.test(l.text));
  const endIdx = endIdxRaw >= 0 ? endIdxRaw : lines.length;
  const pivot = deriveColumnPivot(lines);

  const permanent: string[] = [];
  const correspondence: string[] = [];

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    let left = normalizeSpaces(line.parts.filter(p => p.x < pivot).map(p => p.text).join(' '));
    let right = normalizeSpaces(line.parts.filter(p => p.x >= pivot).map(p => p.text).join(' '));

    if (i === startIdx) {
      left = normalizeSpaces(left.replace(/^.*13\.\s*Permanent\s+Address\s*:\s*/i, ''));
      right = normalizeSpaces(right.replace(/^.*14\.\s*(?:Corr\.?\s*Address|Correspondence\s*Address)\s*:\s*/i, ''));
    } else {
      left = normalizeSpaces(left.replace(/^\d{1,2}\.\s*[^:]*:\s*/i, ''));
      right = normalizeSpaces(right.replace(/^\d{1,2}\.\s*[^:]*:\s*/i, ''));
    }

    if (left) permanent.push(left);
    if (right) correspondence.push(right);
  }

  return {
    permanentAddress: normalizeSpaces(permanent.join(' ').replace(/\s+,/g, ',')),
    correspondenceAddress: normalizeSpaces(correspondence.join(' ').replace(/\s+,/g, ',')),
  };
}

function extractFields(text: string, lines: ParsedLine[]): StudentFields {
  const out: StudentFields = { ...EMPTY_FIELDS };

  const blocks = extractNumberedBlocks(text);
  for (const block of blocks) {
    const key = FIELD_KEY_BY_INDEX[block.index];
    if (!key) continue;
    out[key] = block.value;
  }

  const addresses = extractAddressColumns(lines);
  if (addresses.permanentAddress) out.permanentAddress = addresses.permanentAddress;
  if (addresses.correspondenceAddress) out.correspondenceAddress = addresses.correspondenceAddress;

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

function parseStudentPage(page: PageTextBundle, pageNumber: number): StudentRecord {
  const normalized = normalizeForParsing(page.text);

  const metadata = {
    formType: pick(normalized, /UPDATED\s+ENROLLMENT\s+FORM\s*:\s*([\s\S]*?)(?=SESSION\s*:|COLLEGE\s*:|BRANCH\s+NAME\s*:|1\.)/i),
    session: pick(normalized, /SESSION\s*:\s*([0-9]{4}\s*-\s*[0-9]{4})/i),
    college: pick(normalized, /COLLEGE\s*:\s*([\s\S]*?)(?=BRANCH\s+NAME\s*:|1\.)/i),
    branchName: pick(normalized, /BRANCH\s+NAME\s*:\s*([\s\S]*?)(?=1\.\s*Applicant\s+Name\s+in\s+English|$)/i),
  };

  return {
    pageNumber,
    metadata,
    fields: extractFields(normalized, page.lines),
    educationRows: parseEducationRows(normalized),
    rawText: normalized,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPageText(items: any[]): PageTextBundle {
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

  const parsedLines: ParsedLine[] = lines
    .map(line => {
      const sortedParts = [...line.parts].sort((a, b) => a.x - b.x);
      const text = sortedParts.map(p => p.text).join(' ').replace(/\s+/g, ' ').trim();
      return { y: line.y, parts: sortedParts, text };
    })
    .filter(line => Boolean(line.text));

  return {
    lines: parsedLines,
    text: parsedLines.map(line => line.text).join('\n'),
  };
}

async function extractPageTexts(pdfBuffer: Buffer): Promise<PageTextBundle[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as any;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const pages: PageTextBundle[] = [];

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
    .map((page, idx) => parseStudentPage(page, idx + 1))
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
