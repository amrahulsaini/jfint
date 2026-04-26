'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type ViewKey = '1styear' | '2ndyear';

type StudentDetail = {
  student: {
    roll_no: string;
    student_name: string;
    father_name: string;
    mother_name: string;
    branch: string;
    year: string;
  };
  papers: Array<{
    paper_name: string;
    paper_type: string;
    exam_type: string;
    marks_status: string;
  }>;
  summary: {
    totalPapers: number;
    filled: number;
    pending: number;
  };
};

type BulkLog = {
  rollNo: string;
  status: 'success' | 'failed';
  message: string;
};

const VIEWS: Record<ViewKey, { table: string; photoDir: string; label: string }> = {
  '1styear': { table: '1styearmaster', photoDir: '1styearphotos', label: '1st Year' },
  '2ndyear': { table: 'jecr_2ndyear', photoDir: 'student_photos', label: '2nd Year' },
};

function getFullMarks(paperType: string, paperName: string): number {
  const pt = (paperType || '').toLowerCase();
  if (pt.includes('mid')) return 30;
  if (pt.includes('sessional')) return 60;
  if (pt.includes('practical')) return /^FEC/i.test(paperName || '') ? 100 : 40;
  return 0;
}

function parseRoll(roll: string): { prefix: string; num: number; width: number } | null {
  const clean = roll.trim().toUpperCase();
  const m = clean.match(/^(.*?)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], num: Number(m[2]), width: m[2].length };
}

function buildRollRange(startRoll: string, endRoll: string): { rolls: string[]; error?: string } {
  const s = parseRoll(startRoll);
  const e = parseRoll(endRoll);

  if (!s || !e) {
    return { rolls: [], error: 'Roll format must end with numbers (example: 23EJCCS001).' };
  }
  if (s.prefix !== e.prefix) {
    return { rolls: [], error: 'Start and end roll numbers must have the same prefix.' };
  }
  if (s.width !== e.width) {
    return { rolls: [], error: 'Start and end roll numbers must have the same numeric length.' };
  }
  if (s.num > e.num) {
    return { rolls: [], error: 'Start roll number must be less than or equal to end roll number.' };
  }

  const rolls: string[] = [];
  for (let n = s.num; n <= e.num; n++) {
    rolls.push(`${s.prefix}${String(n).padStart(s.width, '0')}`);
  }
  return { rolls };
}

async function toDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function buildBulkFileName(startRoll: string, endRoll: string): string {
  return `Bulk_${startRoll}_to_${endRoll}_Marks.pdf`;
}

function decoratePdfPages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  margin: number,
) {
  const W = doc.internal.pageSize.getWidth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pCount: number = (doc as any).getNumberOfPages?.() || 1;
  for (let pg = 1; pg <= pCount; pg++) {
    doc.setPage(pg);
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(220, 220, 220);
    doc.text('www.jecrcfoundation.live', W / 2, pageH / 2, { align: 'center', angle: 45 });

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 10, W - margin, pageH - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(209, 213, 219);
    doc.text('JECRC Foundation, Jaipur  |  Computer-generated report  |  For official use only', W / 2, pageH - 5.5, { align: 'center' });
    doc.text(`Page ${pg} of ${pCount}`, W - margin, pageH - 5.5, { align: 'right' });
  }
}

async function appendStudentToPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  detail: StudentDetail,
  photoDir: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable: any,
) {
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  // Header bar
  doc.setFillColor(249, 115, 22);
  doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255, 237, 213);
  doc.setFont('helvetica', 'bold');
  doc.text('JECRC FOUNDATION', margin + 4, y + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('Internal Marks Report', margin + 4, y + 12);
  doc.setFontSize(7);
  doc.setTextColor(255, 237, 213);
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(dateStr, W - margin - 4, y + 12, { align: 'right' });
  y += 22;

  // Photo
  const photoUrl = `/${photoDir}/photo_${detail.student.roll_no}.jpg`;
  let photoLoaded = false;
  try {
    const photoRes = await fetch(photoUrl);
    if (photoRes.ok) {
      const photoData = await toDataUrl(await photoRes.blob());
      doc.addImage(photoData, 'JPEG', margin, y, 28, 33, undefined, 'FAST');
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, 28, 33, 2, 2, 'S');
      photoLoaded = true;
    }
  } catch {
    photoLoaded = false;
  }

  if (!photoLoaded) {
    doc.setFillColor(255, 237, 213);
    doc.roundedRect(margin, y, 28, 33, 2, 2, 'F');
    doc.setFontSize(18);
    doc.setTextColor(249, 115, 22);
    doc.setFont('helvetica', 'bold');
    doc.text((detail.student.student_name || '?').charAt(0).toUpperCase(), margin + 14, y + 19, { align: 'center' });
  }

  // Student info
  const infoX = margin + 32;
  const infoMaxW = W - margin - infoX - 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  const nameLines = doc.splitTextToSize(detail.student.student_name || '-', infoMaxW);
  doc.text(nameLines[0], infoX, y + 7);

  doc.setFontSize(9);
  doc.setTextColor(249, 115, 22);
  doc.text(detail.student.roll_no || '-', infoX, y + 13);

  const halfW = (infoMaxW - 4) / 2;
  let fy = y + 20;
  (['Father', 'Mother'] as const).forEach((label, idx) => {
    const fx = idx === 0 ? infoX : infoX + halfW + 4;
    const val = idx === 0 ? detail.student.father_name : detail.student.mother_name;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(156, 163, 175);
    doc.text(label.toUpperCase(), fx, fy);
    doc.setFontSize(8.5);
    doc.setTextColor(17, 24, 39);
    const truncated = doc.splitTextToSize(String(val || '-'), halfW);
    doc.text(truncated[0], fx, fy + 4.5);
  });

  fy += 10;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(156, 163, 175);
  doc.text('BRANCH', infoX, fy);
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  const branchLines = doc.splitTextToSize(String(detail.student.branch || '-'), infoMaxW);
  doc.text(branchLines.slice(0, 2) as string[], infoX, fy + 4.5);
  const branchH = branchLines.length > 1 ? 5 : 0;

  fy += 10 + branchH;
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(156, 163, 175);
  doc.text('YEAR', infoX, fy);
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(String(detail.student.year || '-'), infoX, fy + 4.5);

  y += Math.max(38, fy - y + 10);

  // Summary boxes
  const boxW = (W - margin * 2 - 8) / 3;
  const summaryItems = [
    { label: 'Total Papers', val: detail.summary.totalPapers, bg: [249, 250, 251] as [number, number, number], num: [17, 24, 39] as [number, number, number], lbl: [107, 114, 128] as [number, number, number] },
    { label: 'Marks Filled', val: detail.summary.filled, bg: [240, 253, 244] as [number, number, number], num: [22, 163, 74] as [number, number, number], lbl: [22, 163, 74] as [number, number, number] },
    { label: 'Pending', val: detail.summary.pending, bg: [255, 247, 237] as [number, number, number], num: [249, 115, 22] as [number, number, number], lbl: [249, 115, 22] as [number, number, number] },
  ];
  summaryItems.forEach((item, i) => {
    const bx = margin + i * (boxW + 4);
    doc.setFillColor(...item.bg);
    doc.roundedRect(bx, y, boxW, 16, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...item.num);
    doc.text(String(item.val), bx + boxW / 2, y + 8.5, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setTextColor(...item.lbl);
    doc.text(item.label.toUpperCase(), bx + boxW / 2, y + 13.5, { align: 'center' });
  });
  y += 22;

  // Marks scheme disclaimer
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(margin, y, W - margin * 2, 26, 2, 2, 'F');
  doc.setDrawColor(253, 230, 138);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, W - margin * 2, 26, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('[!]  MARKS SCHEME', margin + 4, y + 5);
  const disc = [
    '- Mid Term marks are out of 30',
    '- Sessional marks are out of 60',
    '- Practical marks are out of 40',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  disc.forEach((line, i) => {
    doc.text(line, margin + 4 + i * 62, y + 12);
  });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('* FEC paper practical marks are out of 100', margin + 4, y + 21);
  y += 32;

  // Papers table
  autoTable(doc, {
    startY: y,
    head: [['#', 'Paper Name', 'Type', 'Exam Type', 'Marks Status']],
    body: detail.papers.map((p, i) => {
      const mv = (p.marks_status || '').trim();
      const isAbsent = mv.toLowerCase() === 'absent';
      const full = getFullMarks(p.paper_type, p.paper_name);
      const marksDisplay = isAbsent ? 'Absent' : (mv && full > 0 ? `${mv} / ${full}` : (mv || '-'));
      return [i + 1, p.paper_name, p.paper_type, p.exam_type, marksDisplay];
    }),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica', textColor: [55, 65, 81] },
    headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 24 }, 3: { cellWidth: 26 }, 4: { cellWidth: 36, halign: 'center' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      if (data.column.index === 4 && data.section === 'body') {
        const val = String(data.cell.raw || '').toLowerCase();
        if (val === 'absent') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (val.includes('/')) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        } else if (val.includes('not') || val.includes('pending') || val === '-') {
          data.cell.styles.textColor = [234, 88, 12];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Affiliation disclaimer box
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? y;
  const disclaimerH = 34;
  const pageH0 = doc.internal.pageSize.getHeight();
  let dy = tableEndY + 8;
  if (dy + disclaimerH > pageH0 - 18) {
    doc.addPage();
    dy = 14;
  }
  doc.setFillColor(255, 245, 245);
  doc.roundedRect(margin, dy, W - margin * 2, disclaimerH, 2, 2, 'F');
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, dy, W - margin * 2, disclaimerH, 2, 2, 'S');
  doc.setFillColor(220, 38, 38);
  doc.rect(margin, dy, 2.5, disclaimerH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38);
  doc.text('[!] IMPORTANT DISCLAIMER', margin + 6, dy + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27);
  const dLine1 = 'This website is NOT affiliated with JECRC Foundation or any associated institution in any manner.';
  const dLine2 = 'It is an independent project for skill practice, giving students early access to information beyond what universities provide.';
  const dLine3 = 'For any issues, contact: jecrc@jecrcfoundation.live';
  doc.text(dLine1, margin + 6, dy + 14);
  doc.text(dLine2, margin + 6, dy + 20);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(185, 28, 28);
  doc.text(dLine3, margin + 6, dy + 27.5);
}

export default function BulkPdfPage() {
  const [view, setView] = useState<ViewKey>('2ndyear');
  const [startRoll, setStartRoll] = useState('');
  const [endRoll, setEndRoll] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [currentRoll, setCurrentRoll] = useState('');
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<BulkLog[]>([]);
  const stopRef = useRef(false);

  const successCount = useMemo(() => logs.filter(l => l.status === 'success').length, [logs]);
  const failedCount = useMemo(() => logs.filter(l => l.status === 'failed').length, [logs]);

  const stopDownload = () => {
    stopRef.current = true;
  };

  const startDownload = async () => {
    const range = buildRollRange(startRoll, endRoll);
    if (range.error) {
      setError(range.error);
      return;
    }

    setError('');
    setLogs([]);
    setProcessed(0);
    setTotal(range.rolls.length);
    setCurrentRoll('');
    stopRef.current = false;
    setRunning(true);

    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      let combinedDoc: InstanceType<typeof jsPDF> | null = null;

      for (const rollNo of range.rolls) {
        if (stopRef.current) break;

        setCurrentRoll(rollNo);

        try {
          const res = await fetch(
            `/api/db/student-detail?roll_no=${encodeURIComponent(rollNo)}&table=${encodeURIComponent(VIEWS[view].table)}`,
          );

          if (!res.ok) {
            let msg = 'Record unavailable';
            try {
              const e = await res.json();
              msg = String(e?.error || msg);
            } catch {
              msg = res.statusText || msg;
            }
            setLogs(prev => [{ rollNo, status: 'failed' as const, message: msg }, ...prev].slice(0, 100));
            setProcessed(p => p + 1);
            continue;
          }

          const detail = (await res.json()) as StudentDetail;
          if (!combinedDoc) {
            combinedDoc = new jsPDF({ unit: 'mm', format: 'a4' });
          } else {
            combinedDoc.addPage();
          }

          await appendStudentToPdf(combinedDoc, detail, VIEWS[view].photoDir, autoTable);
          setLogs(prev => [{ rollNo, status: 'success' as const, message: 'Added to combined PDF' }, ...prev].slice(0, 100));
          setProcessed(p => p + 1);
        } catch {
          setLogs(prev => [{ rollNo, status: 'failed' as const, message: 'Download failed' }, ...prev].slice(0, 100));
          setProcessed(p => p + 1);
        }
      }

      if (combinedDoc) {
        decoratePdfPages(combinedDoc, 14);
        combinedDoc.save(buildBulkFileName(range.rolls[0], range.rolls[range.rolls.length - 1]));
      } else {
        setError('No valid student records found in the selected range.');
      }
    } finally {
      setRunning(false);
      setCurrentRoll('');
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-neutral-200">
        <div className="max-w-5xl mx-auto h-16 px-5 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-sm text-white">J</div>
            <span className="text-lg font-black tracking-tight">Bulk PDF Export</span>
          </div>
          <Link
            href="/portal/full"
            className="text-xs font-black px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-100 hover:bg-orange-50 hover:text-orange-600 transition-all"
          >
            Back To Portal
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-8 md:py-10">
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 md:p-6 shadow-sm">
          <h1 className="text-xl md:text-2xl font-black text-neutral-900">Generate One Combined PDF</h1>
          <p className="text-sm text-neutral-500 font-medium mt-1">
            Enter roll range and all valid students will be merged into one PDF in increasing roll order. The output PDF has no password.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-neutral-500">Batch</label>
              <select
                value={view}
                onChange={(e) => setView(e.target.value as ViewKey)}
                className="w-full mt-1 h-11 rounded-xl border border-neutral-300 px-3 text-sm font-semibold"
                disabled={running}
              >
                <option value="1styear">{VIEWS['1styear'].label}</option>
                <option value="2ndyear">{VIEWS['2ndyear'].label}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-neutral-500">Start Roll No</label>
              <input
                value={startRoll}
                onChange={(e) => setStartRoll(e.target.value.toUpperCase())}
                placeholder="Example: 23EJCCS001"
                className="w-full mt-1 h-11 rounded-xl border border-neutral-300 px-3 text-sm font-semibold"
                disabled={running}
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-neutral-500">End Roll No</label>
              <input
                value={endRoll}
                onChange={(e) => setEndRoll(e.target.value.toUpperCase())}
                placeholder="Example: 23EJCCS060"
                className="w-full mt-1 h-11 rounded-xl border border-neutral-300 px-3 text-sm font-semibold"
                disabled={running}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            {!running ? (
              <button
                onClick={startDownload}
                className="h-11 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-black"
              >
                Generate Combined PDF
              </button>
            ) : (
              <button
                onClick={stopDownload}
                className="h-11 px-5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black"
              >
                Stop
              </button>
            )}
            <span className="text-xs font-bold text-neutral-500">
              {processed}/{total} processed
            </span>
            <span className="text-xs font-bold text-emerald-600">Success: {successCount}</span>
            <span className="text-xs font-bold text-red-600">Failed: {failedCount}</span>
          </div>

          {currentRoll && (
            <p className="mt-3 text-sm font-bold text-orange-600">Processing: {currentRoll}</p>
          )}

          {error && (
            <p className="mt-3 text-sm font-bold text-red-600">{error}</p>
          )}
        </div>

        <div className="mt-5 bg-white border border-neutral-200 rounded-2xl p-4 md:p-5 shadow-sm">
          <h2 className="text-sm font-black text-neutral-900">Latest Activity</h2>
          <div className="mt-3 max-h-[380px] overflow-auto">
            {logs.length === 0 ? (
              <p className="text-sm font-semibold text-neutral-400">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {logs.map((l, i) => (
                  <div
                    key={`${l.rollNo}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2"
                  >
                    <span className="text-sm font-bold text-neutral-800">{l.rollNo}</span>
                    <span
                      className={`text-xs font-black ${
                        l.status === 'success' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {l.status === 'success' ? 'Added' : l.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
