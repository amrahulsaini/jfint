import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import {
  isFileNotFound,
  outputJsonPathForPdf,
  resolvePdfRelativePath,
  runExtraction,
  toRelativeWorkspacePath,
  type ExtractionPayload,
} from '@/lib/extractions';

export const runtime = 'nodejs';

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
