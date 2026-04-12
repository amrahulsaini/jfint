'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

/* ── Types ──────────────────────────────────────────────── */
interface StudentRow {
  roll_no: string;
  student_name: string;
  father_name: string;
  mother_name: string;
  branch: string;
  year: string;
  paper_count: number;
  papers: string;
}

interface Stats {
  totalRecords: number;
  totalBranches: number;
  totalPapers: number;
  totalStudents: number;
}

interface ApiResponse {
  rows: StudentRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  branches: string[];
  stats: Stats;
  error?: string;
}

interface PaperDetail {
  paper_name: string;
  paper_type: string;
  exam_type: string;
  marks_status: string;
}

interface StudentDetail {
  student: {
    roll_no: string;
    student_name: string;
    father_name: string;
    mother_name: string;
    branch: string;
    year: string;
  };
  papers: PaperDetail[];
  summary: { totalPapers: number; filled: number; pending: number };
  profile?: StudentProfile | null;
  profileMatch?: {
    confidence: 'high' | 'medium' | 'low';
    strategy: string;
    score: number;
    candidates: number;
  } | null;
}

interface ProfileEducationRow {
  exam?: string;
  rollNo?: string;
  year?: string;
  stream?: string;
  board?: string;
  obtainedMarks?: string;
  maxMarks?: string;
  percentage?: string;
  cgpa?: string;
  result?: string;
}

interface StudentProfile {
  id: number | null;
  source_file: string;
  page_number: number;
  form_type: string;
  session: string;
  college: string;
  branch_name: string;
  applicant_name: string;
  father_name: string;
  mother_name: string;
  gender: string;
  dob: string;
  student_status: string;
  caste: string;
  category_i_ii: string;
  category_iii: string;
  specialization_branch: string;
  admission_status: string;
  earlier_enrollment_no: string;
  permanent_address: string;
  correspondence_address: string;
  mobile_no: string;
  parent_mobile_no: string;
  entrance_exam_roll_no: string;
  entrance_exam_name: string;
  merit_secured: string;
  email: string;
  has_aadhar_card: string;
  aadhar_no: string;
  educational_qualification: string;
  college_shift: string;
  education_rows: ProfileEducationRow[];
  raw_text: string;
  extracted_at: string;
  created_at: string;
  updated_at: string;
}

/* ── helpers ────────────────────────────────────────────── */

/** Returns the full (maximum) marks for a paper given its type and name */
function getFullMarks(paperType: string, paperName: string): number {
  const pt = (paperType || '').toLowerCase();
  if (pt.includes('mid')) return 30;
  if (pt.includes('sessional')) return 60;
  if (pt.includes('practical')) {
    // FEC papers (both tables): out of 100
    return /^FEC/i.test(paperName || '') ? 100 : 40;
  }
  return 0;
}

const statusPill = (s: string) => {
  const l = s?.toLowerCase() || '';
  if (l.includes('filled') || l.includes('complete') || l.includes('submit'))
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (l.includes('not') || l.includes('pending'))
    return 'text-orange-700 bg-orange-50 border-orange-200';
  return 'text-neutral-500 bg-neutral-100 border-neutral-200';
};

/* ── Component ──────────────────────────────────────────── */
export default function StudentRecords({
  table = 'jecr_2ndyear',
  photoDir = 'student_photos',
}: {
  table?: string;
  photoDir?: string;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'marks' | 'profile'>('marks');
  const [exportGenerating, setExportGenerating] = useState(false);
  const [profileExporting, setProfileExporting] = useState(false);
  const [pdfExportError, setPdfExportError] = useState('');

  // Payment state
  const [allAccess, setAllAccess] = useState(false);          // all-access plan or coupon
  const [allAccessExpiresAt, setAllAccessExpiresAt] = useState<string | null>(null);
  const [paidRolls, setPaidRolls] = useState<Set<string>>(new Set()); // per-roll single plan
  const [showPayModal, setShowPayModal] = useState(false);
  const [pendingRollNo, setPendingRollNo] = useState<string | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payPrice, setPayPrice] = useState<number | null>(null);     // single plan price
  const [allPrice, setAllPrice] = useState<number | null>(null);     // all-access plan price
  const [selectedPlan, setSelectedPlan] = useState<'single' | 'all'>('single');
  const [coupon, setCoupon] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const isRollPaid = (rollNo: string) => table === '1styearmaster' || allAccess || paidRolls.has(rollNo);

  const LIMIT = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT), table });
      if (search) p.set('search', search);
      if (branch) p.set('branch', branch);
      const res = await fetch(`/api/db/students?${p}`);
      const json: ApiResponse = await res.json();
      if (json.error) { setError(json.error); setData(null); }
      else { setError(''); setData(json); }
    } catch {
      setError('Failed to connect to database');
      setData(null);
    }
    setLoading(false);
  }, [page, search, branch, table]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page/filters when table switches
  useEffect(() => { setPage(1); setSearch(''); setSearchInput(''); setBranch(''); }, [table]);

  // Check paid status + price on mount
  useEffect(() => {
    fetch('/api/payment/status').then(r => r.json()).then(d => {
      if (d.allAccess) { setAllAccess(true); setAllAccessExpiresAt(d.allAccessExpiresAt ?? null); }
      if (d.paidRolls?.length) setPaidRolls(new Set(d.paidRolls));
    }).catch(() => {});
    fetch('/api/payment/create-order').then(r => r.json()).then(d => {
      if (d.single?.amountRupees) setPayPrice(d.single.amountRupees);
      else if (d.amountRupees) setPayPrice(d.amountRupees); // legacy fallback
      if (d.all?.amountRupees) setAllPrice(d.all.amountRupees);
    }).catch(() => {});
  }, []);

  // Load Razorpay checkout script once
  useEffect(() => {
    if (document.getElementById('rzp-checkout-script')) return;
    const script = document.createElement('script');
    script.id = 'rzp-checkout-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setSearch(searchInput); };

  const valueOrDash = (value?: string | number | null) => {
    const text = String(value ?? '').trim();
    return text || '\u2014';
  };

  const exportStudentPDF = async (pdfOpenPassword?: string | null) => {
    if (!detail || exportGenerating) return;
    setExportGenerating(true);
    try {
      // Dynamically import jsPDF + autotable (client-only)
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const docOptions: {
        unit: 'mm';
        format: 'a4';
        encryption?: {
          userPassword: string;
          ownerPassword: string;
          userPermissions: Array<'print' | 'modify' | 'copy' | 'annot-forms'>;
        };
      } = {
        unit: 'mm',
        format: 'a4',
      };

      if (pdfOpenPassword) {
        docOptions.encryption = {
          userPassword: pdfOpenPassword,
          ownerPassword: `${detail.student.roll_no}-${Date.now()}`,
          userPermissions: ['print'],
        };
      }

      const doc = new jsPDF(docOptions);
      const W = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 14;

      // ── Header bar ──────────────────────────────────────────
      doc.setFillColor(249, 115, 22); // orange-500
      doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setTextColor(255, 237, 213);
      doc.setFont('helvetica', 'bold');
      doc.text('JECRC FOUNDATION', margin + 4, y + 5.5);
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('Internal Marks Report', margin + 4, y + 12);
      const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.setFontSize(7);
      doc.setTextColor(255, 237, 213);
      doc.text(dateStr, W - margin - 4, y + 12, { align: 'right' });
      y += 22;

      // ── Photo ───────────────────────────────────────────────
      const photoUrl = `/${photoDir}/photo_${detail.student.roll_no}.jpg`;
      let photoLoaded = false;
      try {
        const resp = await fetch(photoUrl);
        if (resp.ok) {
          const blob = await resp.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          doc.addImage(dataUrl, 'JPEG', margin, y, 28, 33, undefined, 'FAST');
          // Orange border around photo
          doc.setDrawColor(249, 115, 22);
          doc.setLineWidth(0.5);
          doc.roundedRect(margin, y, 28, 33, 2, 2, 'S');
          photoLoaded = true;
        }
      } catch { /* no photo */ }

      if (!photoLoaded) {
        doc.setFillColor(255, 237, 213);
        doc.roundedRect(margin, y, 28, 33, 2, 2, 'F');
        doc.setFontSize(18);
        doc.setTextColor(249, 115, 22);
        doc.setFont('helvetica', 'bold');
        doc.text((detail.student.student_name || '?').charAt(0).toUpperCase(), margin + 14, y + 19, { align: 'center' });
      }

      // ── Student info ────────────────────────────────────────
      const infoX = margin + 32;
      const infoMaxW = W - margin - infoX - 2; // available width right of photo

      // Name (truncated to fit)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      const nameLines = doc.splitTextToSize(detail.student.student_name, infoMaxW);
      doc.text(nameLines[0], infoX, y + 7);

      // Roll no
      doc.setFontSize(9);
      doc.setTextColor(249, 115, 22);
      doc.text(detail.student.roll_no, infoX, y + 13);

      // Row 1: Father (left) | Mother (right)
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
        const truncated = doc.splitTextToSize(String(val || '\u2014'), halfW);
        doc.text(truncated[0], fx, fy + 4.5);
      });

      // Row 2: Branch (full width, up to 2 lines)
      fy += 10;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(156, 163, 175);
      doc.text('BRANCH', infoX, fy);
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      const branchLines = doc.splitTextToSize(String(detail.student.branch || '\u2014'), infoMaxW);
      doc.text(branchLines.slice(0, 2) as string[], infoX, fy + 4.5);
      const branchH = branchLines.length > 1 ? 5 : 0;

      // Row 3: Year
      fy += 10 + branchH;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(156, 163, 175);
      doc.text('YEAR', infoX, fy);
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      doc.text(String(detail.student.year || '\u2014'), infoX, fy + 4.5);

      y += Math.max(38, fy - y + 10);

      // ── Summary boxes ────────────────────────────────────────
      const boxW = (W - margin * 2 - 8) / 3;
      const summaryItems = [
        { label: 'Total Papers', val: detail.summary.totalPapers, bg: [249,250,251] as [number,number,number], num: [17,24,39] as [number,number,number], lbl: [107,114,128] as [number,number,number] },
        { label: 'Marks Filled', val: detail.summary.filled, bg: [240,253,244] as [number,number,number], num: [22,163,74] as [number,number,number], lbl: [22,163,74] as [number,number,number] },
        { label: 'Pending', val: detail.summary.pending, bg: [255,247,237] as [number,number,number], num: [249,115,22] as [number,number,number], lbl: [249,115,22] as [number,number,number] },
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

      // ── Disclaimer ──────────────────────────────────────────
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

      // ── Papers table ─────────────────────────────────────────
      autoTable(doc, {
        startY: y,
        head: [['#', 'Paper Name', 'Type', 'Exam Type', 'Marks Status']],
        body: detail.papers.map((p, i) => {
          const mv = (p.marks_status || '').trim();
          const isAbsent = mv.toLowerCase() === 'absent';
          const full = getFullMarks(p.paper_type, p.paper_name);
          const marksDisplay = isAbsent ? 'Absent' : (mv && full > 0 ? `${mv} / ${full}` : (mv || '—'));
          return [i + 1, p.paper_name, p.paper_type, p.exam_type, marksDisplay];
        }),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica', textColor: [55, 65, 81] },
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 24 }, 3: { cellWidth: 26 }, 4: { cellWidth: 36, halign: 'center' } },
        didParseCell: (data) => {
          if (data.column.index === 4 && data.section === 'body') {
            const val = String(data.cell.raw || '').toLowerCase();
            if (val === 'absent') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else if (val.includes('/')) {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            } else if (val.includes('not') || val.includes('pending') || val === '—') {
              data.cell.styles.textColor = [234, 88, 12];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      // ── Affiliation Disclaimer box ────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableEndY: number = (doc as any).lastAutoTable?.finalY ?? y;
      const disclaimerH = 34;
      const pageH0 = doc.internal.pageSize.getHeight();
      let dy = tableEndY + 8;
      if (dy + disclaimerH > pageH0 - 18) {
        doc.addPage();
        dy = 14;
      }
      // Red border box
      doc.setFillColor(255, 245, 245);
      doc.roundedRect(margin, dy, W - margin * 2, disclaimerH, 2, 2, 'F');
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.6);
      doc.roundedRect(margin, dy, W - margin * 2, disclaimerH, 2, 2, 'S');
      // Left red accent bar
      doc.setFillColor(220, 38, 38);
      doc.rect(margin, dy, 2.5, disclaimerH, 'F');
      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(220, 38, 38);
      doc.text('[!] IMPORTANT DISCLAIMER', margin + 6, dy + 6.5);
      // Body text
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

      // ── Footer + Watermark ────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pCount: number = (doc as any).getNumberOfPages?.() || 1;
      for (let pg = 1; pg <= pCount; pg++) {
        doc.setPage(pg);
        const pageH = doc.internal.pageSize.getHeight();

        // Diagonal watermark centered on the page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(220, 220, 220);
        doc.text('www.jecrcfoundation.live', W / 2, pageH / 2, { align: 'center', angle: 45 });

        // Footer line & text
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 10, W - margin, pageH - 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(209, 213, 219);
        doc.text('JECRC Foundation, Jaipur  |  Computer-generated report  |  For official use only', W / 2, pageH - 5.5, { align: 'center' });
        doc.text(`Page ${pg} of ${pCount}`, W - margin, pageH - 5.5, { align: 'right' });
      }

      doc.save(`${detail.student.roll_no}_${detail.student.student_name.replace(/\s+/g, '_')}_Marks.pdf`);
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setExportGenerating(false);
    }
  };

  const requestPdfExport = async () => {
    if (!detail || exportGenerating) return;
    setPdfExportError('');
    try {
      const res = await fetch('/api/pdf-auth/verify-dob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo: detail.student.roll_no }),
      });
      const data = await res.json();

      if (res.ok) {
        await exportStudentPDF(data.protect ? String(data.pdfPassword || '') : null);
      } else {
        setPdfExportError(data.error || 'Unable to prepare PDF export.');
      }
    } catch {
      setPdfExportError('Failed to prepare PDF export. Please try again.');
    }
  };

  const exportCompleteInfo = async () => {
    if (!detail || profileExporting || !detail.profile) return;
    setProfileExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;

      const profile = detail.profile;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 12;
      let y = 12;

      doc.setFillColor(17, 24, 39);
      doc.roundedRect(margin, y, pageW - margin * 2, 20, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text('Complete Student Profile', margin + 4, y + 8);
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text('Internal Marks + 2528allinfo Data', margin + 4, y + 14);
      doc.text(new Date().toLocaleString('en-IN'), pageW - margin - 4, y + 14, { align: 'right' });
      y += 24;

      autoTable(doc, {
        startY: y,
        head: [['Student Snapshot', 'Value']],
        body: [
          ['Name', valueOrDash(detail.student.student_name)],
          ['Roll Number', valueOrDash(detail.student.roll_no)],
          ['Father Name', valueOrDash(detail.student.father_name)],
          ['Mother Name', valueOrDash(detail.student.mother_name)],
          ['Branch', valueOrDash(detail.student.branch)],
          ['Year', valueOrDash(detail.student.year)],
          ['Total Papers', String(detail.summary.totalPapers)],
          ['Marks Filled', String(detail.summary.filled)],
          ['Pending', String(detail.summary.pending)],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.6, textColor: [31, 41, 55] },
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
      });

      const tableState = doc as unknown as { lastAutoTable?: { finalY: number } };
      y = (tableState.lastAutoTable?.finalY ?? y) + 4;

      const profileRows: Array<[string, string]> = [
        ['Applicant Name', valueOrDash(profile.applicant_name)],
        ['Gender', valueOrDash(profile.gender)],
        ['Date of Birth', valueOrDash(profile.dob)],
        ['Student Status', valueOrDash(profile.student_status)],
        ['Caste', valueOrDash(profile.caste)],
        ['Category I/II', valueOrDash(profile.category_i_ii)],
        ['Category III', valueOrDash(profile.category_iii)],
        ['Specialization Branch', valueOrDash(profile.specialization_branch)],
        ['Admission Status', valueOrDash(profile.admission_status)],
        ['Earlier Enrollment No', valueOrDash(profile.earlier_enrollment_no)],
        ['Mobile Number', valueOrDash(profile.mobile_no)],
        ['Parent Mobile Number', valueOrDash(profile.parent_mobile_no)],
        ['Entrance Exam Roll No', valueOrDash(profile.entrance_exam_roll_no)],
        ['Entrance Exam Name', valueOrDash(profile.entrance_exam_name)],
        ['Merit Secured', valueOrDash(profile.merit_secured)],
        ['Email', valueOrDash(profile.email)],
        ['Has Aadhar Card', valueOrDash(profile.has_aadhar_card)],
        ['Aadhar Number', valueOrDash(profile.aadhar_no)],
        ['Educational Qualification', valueOrDash(profile.educational_qualification)],
        ['College Shift', valueOrDash(profile.college_shift)],
      ];

      autoTable(doc, {
        startY: y,
        head: [['Complete Profile Fields', 'Value']],
        body: profileRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });

      y = (tableState.lastAutoTable?.finalY ?? y) + 4;

      autoTable(doc, {
        startY: y,
        head: [['Address Type', 'Address']],
        body: [
          ['Permanent Address', valueOrDash(profile.permanent_address)],
          ['Correspondence Address', valueOrDash(profile.correspondence_address)],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.6, textColor: [31, 41, 55], valign: 'top' },
        headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
      });

      y = (tableState.lastAutoTable?.finalY ?? y) + 4;

      const eduBody = profile.education_rows?.length
        ? profile.education_rows.map((r) => [
            valueOrDash(r.exam),
            valueOrDash(r.rollNo),
            valueOrDash(r.year),
            valueOrDash(r.stream),
            valueOrDash(r.board),
            valueOrDash(r.obtainedMarks),
            valueOrDash(r.maxMarks),
            valueOrDash(r.percentage),
            valueOrDash(r.cgpa),
            valueOrDash(r.result),
          ])
        : [['\u2014', '\u2014', '\u2014', '\u2014', '\u2014', '\u2014', '\u2014', '\u2014', '\u2014', 'No rows found']];

      autoTable(doc, {
        startY: y,
        head: [['Exam', 'Roll', 'Year', 'Stream', 'Board', 'Obt.', 'Max', '%', 'CGPA', 'Result']],
        body: eduBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2, textColor: [31, 41, 55] },
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      });

      y = (tableState.lastAutoTable?.finalY ?? y) + 4;

      autoTable(doc, {
        startY: y,
        head: [['#', 'Paper Name', 'Type', 'Exam Type', 'Marks']],
        body: detail.papers.map((p, idx) => {
          const marks = String(p.marks_status || '').trim();
          const isAbsent = marks.toLowerCase() === 'absent';
          const isNumeric = !isAbsent && marks !== '' && !isNaN(Number(marks));
          const full = getFullMarks(p.paper_type, p.paper_name);
          const display = isAbsent ? 'Absent' : isNumeric && full > 0 ? `${marks}/${full}` : (marks || '\u2014');
          return [
            String(idx + 1),
            valueOrDash(p.paper_name),
            valueOrDash(p.paper_type),
            valueOrDash(p.exam_type),
            display,
          ];
        }),
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2.2, textColor: [31, 41, 55] },
        headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 22, halign: 'center' } },
      });

      y = (tableState.lastAutoTable?.finalY ?? y) + 4;

      autoTable(doc, {
        startY: y,
        head: [['Extraction Metadata', 'Value']],
        body: [
          ['Source File', valueOrDash(profile.source_file)],
          ['Page Number', valueOrDash(profile.page_number)],
          ['Form Type', valueOrDash(profile.form_type)],
          ['Session', valueOrDash(profile.session)],
          ['College', valueOrDash(profile.college)],
          ['Branch Name', valueOrDash(profile.branch_name)],
          ['Extracted At', valueOrDash(profile.extracted_at)],
          ['Match Confidence', valueOrDash(detail.profileMatch?.confidence || '')],
          ['Match Strategy', valueOrDash(detail.profileMatch?.strategy || '')],
        ],
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2.4, textColor: [31, 41, 55] },
        headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
      });

      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(156, 163, 175);
        doc.text('JECRC Foundation • Complete profile export', margin, pageH - 5.5);
        doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 5.5, { align: 'right' });
      }

      doc.save(`${detail.student.roll_no}_${detail.student.student_name.replace(/\s+/g, '_')}_Complete_Profile.pdf`);
    } catch (err) {
      console.error('Complete info PDF export failed', err);
      alert('Complete info PDF export failed. Please try again.');
    } finally {
      setProfileExporting(false);
    }
  };

  const openDetailDirect = async (rollNo: string) => {
    setShowModal(true);
    setActiveDetailTab('marks');
    setProfileExporting(false);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/db/student-detail?roll_no=${encodeURIComponent(rollNo)}&table=${encodeURIComponent(table)}`);
      if (res.status === 402) {
        // Cookie expired server-side — show payment modal, but don't remove from client state
        setShowModal(false);
        setDetailLoading(false);
        setPendingRollNo(rollNo);
        setCoupon('');
        setCouponError('');
        setShowPayModal(true);
        return;
      }
      const json = await res.json();
      if (!json.error) setDetail(json);
    } catch { /* noop */ }
    setDetailLoading(false);
  };

  const openDetail = (rollNo: string) => {
    if (!isRollPaid(rollNo)) {
      setPendingRollNo(rollNo);
      setCoupon('');
      setCouponError('');
      setShowPayModal(true);
      return;
    }
    openDetailDirect(rollNo);
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await fetch('/api/payment/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: coupon.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setAllAccess(true);
        setShowPayModal(false);
        setCouponLoading(false);
        if (pendingRollNo) {
          const roll = pendingRollNo;
          setPendingRollNo(null);
          openDetailDirect(roll);
        }
      } else {
        setCouponError(data.error || 'Invalid coupon');
        setCouponLoading(false);
      }
    } catch {
      setCouponError('Failed to apply coupon. Try again.');
      setCouponLoading(false);
    }
  };

  const initiatePayment = async (plan: 'single' | 'all' = selectedPlan) => {
    if (!pendingRollNo && plan === 'single') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).Razorpay === 'undefined') {
      alert('Payment gateway is still loading. Please wait a moment and try again.');
      return;
    }
    setPayLoading(true);
    try {
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const order = await orderRes.json();
      if (order.error) { alert(order.error); setPayLoading(false); return; }

      const rollForPayment = pendingRollNo;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rz = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'JECRC Foundation Portal',
        description: plan === 'all' ? 'All Students Access — 2 Hours' : 'View Student Result',
        image: `${window.location.origin}/logo.png`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              roll_no: rollForPayment,
              plan,
            }),
          });
          const data = await verifyRes.json();
          if (data.success) {
            if (plan === 'all') {
              setAllAccess(true);
            } else {
              setPaidRolls(s => new Set([...s, rollForPayment!]));
            }
            setShowPayModal(false);
            setPayLoading(false);
            setPendingRollNo(null);
            if (rollForPayment) openDetailDirect(rollForPayment);
          } else {
            alert('Payment verification failed. Please contact support.');
            setPayLoading(false);
          }
        },
        modal: { ondismiss: () => { setPayLoading(false); } },
        theme: { color: '#f97316' },
      });
      rz.open();
    } catch {
      alert('Payment initialization failed. Please try again.');
      setPayLoading(false);
    }
  };

  /* ── DB not connected ──────────────────────────────────── */
  if (error && !data) {
    const connRefused = /ECONNREFUSED/i.test(error);
    const accessDenied = /ER_ACCESS_DENIED_ERROR|Access denied/i.test(error);
    const dbMissing = /ER_BAD_DB_ERROR|Unknown database/i.test(error);

    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 text-center">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-12 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-neutral-900 mb-1">Database Not Connected</h3>
          <p className="text-sm text-neutral-500 font-semibold">Unable to load student results right now.</p>
          <p className="mt-3 text-xs font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-all">
            {error}
          </p>
          {connRefused && (
            <p className="mt-3 text-xs font-semibold text-neutral-600">
              Connection refused: check DB server firewall / public access / port mapping.
            </p>
          )}
          {accessDenied && (
            <p className="mt-3 text-xs font-semibold text-neutral-600">
              Access denied: verify DB user/password and host permissions.
            </p>
          )}
          {dbMissing && (
            <p className="mt-3 text-xs font-semibold text-neutral-600">
              Database not found: verify DB_NAME and import SQL data for this environment.
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── Main ──────────────────────────────────────────────── */
  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-6">

      {/* ─── Stats ───────────────────────────────────────── */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Records', val: data.stats.totalRecords, icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            )},
            { label: 'Branches', val: data.stats.totalBranches, icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
            )},
            { label: 'Papers', val: data.stats.totalPapers, icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
            )},
            { label: 'Students', val: data.stats.totalStudents, accent: true, icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
            )},
          ].map(s => (
            <div
              key={s.label}
              className={`rounded-2xl border p-5 flex items-center gap-4 ${
                s.accent
                  ? 'bg-orange-50 border-orange-200 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-200 hover:-translate-y-0.5'
                  : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all duration-200 hover:-translate-y-0.5'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                s.accent ? 'bg-orange-100 text-orange-500' : 'bg-neutral-100 text-neutral-400'
              }`}>
                {s.icon}
              </div>
              <div>
                <div className={`text-2xl font-black leading-none ${s.accent ? 'text-orange-500' : 'text-neutral-900'}`}>
                  {s.val.toLocaleString()}
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mt-1">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Search / Filter Bar ─────────────────────────── */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name or roll number…"
                className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all duration-200"
              />
            </div>
            <button type="submit" className="bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-black px-6 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:-translate-y-0.5">
              Search
            </button>
          </form>
          <div className="relative">
            <select
              value={branch}
              onChange={e => { setBranch(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-neutral-200 rounded-xl pl-4 pr-9 py-2.5 text-sm font-bold text-neutral-700 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all duration-200 cursor-pointer w-full sm:min-w-[160px]"
            >
              <option value="" className="bg-white text-neutral-900">All Branches</option>
              {data?.branches.map(b => <option key={b} value={b} className="bg-white text-neutral-900">{b}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>

        {/* Active filter chips */}
        {(search || branch) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-neutral-200">
            {search && (
              <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 text-xs font-black text-orange-400">
                &ldquo;{search}&rdquo;
                <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="hover:text-orange-200 transition-colors">×</button>
              </span>
            )}
            {branch && (
              <span className="inline-flex items-center gap-1.5 bg-neutral-100 border border-neutral-200 rounded-full px-3 py-1 text-xs font-black text-neutral-600">
                {branch}
                <button onClick={() => { setBranch(''); setPage(1); }} className="hover:text-white transition-colors">×</button>
              </span>
            )}
            <button onClick={() => { setSearch(''); setSearchInput(''); setBranch(''); setPage(1); }} className="text-xs font-bold text-neutral-400 hover:text-orange-500 transition-colors">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ─── Card Grid ───────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-neutral-200" />
                <div className="flex-1">
                  <div className="h-4 bg-neutral-200 rounded-full w-3/4 mb-2" />
                  <div className="h-3 bg-neutral-200 rounded-full w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-neutral-200 rounded-full w-full mb-2" />
              <div className="h-3 bg-neutral-200 rounded-full w-2/3" />
            </div>
          ))}
        </div>
      ) : data?.rows.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-neutral-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p className="text-neutral-500 font-black">No students found</p>
          <p className="text-neutral-400 font-semibold text-sm mt-1">Try a different search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {data?.rows.map((row) => (
            <div
              key={row.roll_no}
              className="group relative bg-white hover:bg-orange-50/30 border border-neutral-200 hover:border-orange-400 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1 overflow-hidden"
            >
              {/* Top accent on hover */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-orange-400/0 to-transparent group-hover:via-orange-400 transition-all duration-300 rounded-t-2xl" />
              {/* Photo + Name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 border-2 border-neutral-200 group-hover:border-orange-400 transition-all duration-300 flex-shrink-0">
                  <Image
                    src={`/${photoDir}/photo_${row.roll_no}.jpg`}
                    alt={row.student_name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const t = e.currentTarget;
                      t.style.display = 'none';
                      const p = t.parentElement;
                      if (p && !p.querySelector('.af')) {
                        const d = document.createElement('div');
                        d.className = 'af w-full h-full flex items-center justify-center text-xl font-black text-neutral-400 bg-neutral-100';
                        d.textContent = (row.student_name || '?').charAt(0).toUpperCase();
                        p.appendChild(d);
                      }
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-neutral-900 text-sm leading-snug truncate group-hover:text-orange-600 transition-colors duration-200">
                    {row.student_name}
                  </h3>
                  <p className="text-orange-400 font-mono text-xs font-bold mt-0.5">{row.roll_no}</p>
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 font-bold">Father</span>
                  <span className="text-neutral-700 font-bold truncate ml-2 text-right max-w-[60%]">{row.father_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 font-bold">Branch</span>
                  <span className="bg-neutral-100 border border-neutral-200 text-neutral-600 rounded-lg px-2 py-0.5 text-[11px] font-black">
                    {row.branch}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 font-bold">Papers</span>
                  <span className="bg-orange-500/10 border border-orange-500/25 text-orange-400 rounded-lg px-2.5 py-0.5 text-[11px] font-black">
                    {row.paper_count}
                  </span>
                </div>
              </div>

              {/* Card action button */}
              <div className="mt-4 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => openDetail(row.roll_no)}
                  className={`w-full rounded-xl px-3 py-2.5 text-xs font-black transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    isRollPaid(row.roll_no)
                      ? 'bg-orange-500 hover:bg-orange-400 text-white shadow-md shadow-orange-500/30'
                      : 'bg-neutral-900 hover:bg-neutral-700 text-white'
                  }`}
                >
                  {isRollPaid(row.roll_no)
                    ? (table === '1styearmaster' ? 'Open Internal + Complete Info' : 'View Internal Marks')
                    : 'Unlock & View'}
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Pagination ──────────────────────────────────── */}
      {data && data.totalPages > 1 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <span className="text-sm text-neutral-400 font-bold">
            Showing <span className="font-black text-neutral-700">{((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)}</span> of <span className="font-black text-neutral-700">{data.total.toLocaleString()}</span>
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {/* First */}
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black"
            >
              ««
            </button>
            {/* Prev */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black"
            >
              ‹
            </button>
            {/* Page numbers */}
            {(() => {
              const pages: number[] = [];
              const t = data.totalPages;
              let s = Math.max(1, page - 2);
              const e = Math.min(t, s + 4);
              s = Math.max(1, e - 4);
              for (let i = s; i <= e; i++) pages.push(i);
              return pages.map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                    p === page
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 border border-orange-500 scale-110'
                      : 'bg-white border border-neutral-200 text-neutral-500 hover:text-orange-500 hover:border-orange-400'
                  }`}
                >
                  {p}
                </button>
              ));
            })()}
            {/* Next */}
            <button
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black"
            >
              ›
            </button>
            {/* Last */}
            <button
              onClick={() => setPage(data.totalPages)}
              disabled={page >= data.totalPages}
              className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black">
              »»
            </button>
          </div>
        </div>
      )}

      {/* ─── Payment Gate Modal ──────────────────────── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowPayModal(false); setPendingRollNo(null); setPayLoading(false); setCoupon(''); setCouponError(''); }} />
          <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl shadow-black/20 border border-neutral-200 overflow-hidden">
            {/* Orange top bar */}
            <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />

            <div className="p-7 text-center">
              {/* Lock icon */}
              <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
                </svg>
              </div>

              <h2 className="text-xl font-black text-neutral-900 mb-1">Choose a Plan</h2>
              <p className="text-sm text-neutral-500 font-semibold mb-5">Select how you want to access student results</p>

              {/* Plan selector cards */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {/* Single plan */}
                <button
                  onClick={() => setSelectedPlan('single')}
                  className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                    selectedPlan === 'single'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  {selectedPlan === 'single' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                      </svg>
                    </div>
                  )}
                  <div className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-1">Single</div>
                  <div className="text-2xl font-black text-orange-500">
                    {payPrice !== null ? `₹${payPrice}` : '…'}
                  </div>
                  <div className="text-xs text-neutral-500 font-semibold mt-1">Per student result</div>
                  <div className="text-[10px] text-neutral-400 font-medium mt-0.5">Valid until browser closes</div>
                </button>

                {/* All-access plan */}
                <button
                  onClick={() => setSelectedPlan('all')}
                  className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                    selectedPlan === 'all'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  {selectedPlan === 'all' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                      </svg>
                    </div>
                  )}
                  <div className="absolute -top-2.5 left-3">
                    <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Best Value</span>
                  </div>
                  <div className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-1 mt-1">All Access</div>
                  <div className="text-2xl font-black text-orange-500">
                    {allPrice !== null ? `₹${allPrice}` : '₹200'}
                  </div>
                  <div className="text-xs text-neutral-500 font-semibold mt-1">Unlimited students</div>
                  <div className="text-[10px] text-neutral-400 font-medium mt-0.5">Valid for 2 hours</div>
                </button>
              </div>

              {/* Selected plan features */}
              <ul className="text-left space-y-1.5 mb-5">
                {(selectedPlan === 'single' ? [
                  'View internal marks for this student',
                  'Access complete profile (1st sem)',
                  'Access valid until browser closes',
                ] : [
                  'Unlimited student results for 2 hours',
                  'Export any result to PDF',
                  'Access all batches seamlessly',
                ]).map((f: string) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-neutral-600 font-semibold">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => initiatePayment(selectedPlan)}
                disabled={payLoading || couponLoading}
                className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-2xl text-base shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-200 hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                {payLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Processing…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/>
                    </svg>
                    Pay {selectedPlan === 'all'
                      ? (allPrice !== null ? `₹${allPrice}` : '₹200')
                      : (payPrice !== null ? `₹${payPrice}` : '')} — Secure Checkout
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>

              {/* Coupon input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={e => { setCoupon(e.target.value); setCouponError(''); }}
                  onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                  placeholder="Enter coupon code…"
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
                <button
                  onClick={applyCoupon}
                  disabled={couponLoading || !coupon.trim()}
                  className="bg-neutral-900 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-1.5"
                >
                  {couponLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : 'Apply'}
                </button>
              </div>
              {couponError && (
                <p className="text-xs text-red-500 font-semibold mt-2 text-left">{couponError}</p>
              )}

              <p className="text-[11px] text-neutral-400 font-medium mt-4">
                Powered by Razorpay · 100% secure payment
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          <div className={`relative bg-white rounded-2xl sm:rounded-3xl w-full ${activeDetailTab === 'profile' ? 'max-w-5xl' : 'max-w-2xl'} max-h-[92vh] sm:max-h-[90vh] overflow-hidden shadow-2xl shadow-black/20 border border-neutral-200`}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-100 bg-gradient-to-r from-orange-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-orange-500/30">
                  J
                </div>
                <div>
                  <div className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.15em]">JECRC Foundation</div>
                  <h3 className="text-sm font-extrabold text-neutral-900 leading-none">Student Details</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {detail && (
                  <>
                    <button
                      onClick={requestPdfExport}
                      disabled={exportGenerating}
                      className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-extrabold px-2.5 sm:px-3.5 py-2 rounded-xl shadow-md shadow-orange-500/30 hover:shadow-orange-500/50 transition-all duration-200 hover:-translate-y-0.5 min-w-[36px] sm:min-w-[132px] justify-center"
                    >
                      {exportGenerating ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          <span className="hidden sm:inline">Preparing…</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          <span className="hidden sm:inline">Export Internal PDF</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={exportCompleteInfo}
                      disabled={profileExporting || !detail.profile}
                      className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-700 active:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold px-2.5 sm:px-3.5 py-2 rounded-xl shadow-md shadow-neutral-900/20 transition-all duration-200 hover:-translate-y-0.5 min-w-[36px] sm:min-w-[132px] justify-center"
                      title={detail.profile ? 'Download complete student profile PDF' : 'No matched profile found in 2528allinfo'}
                    >
                      {profileExporting ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          <span className="hidden sm:inline">Preparing…</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5v-9m0 9l-3-3m3 3l3-3M4.5 19.5h15" />
                          </svg>
                          <span className="hidden sm:inline">Export Complete PDF</span>
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-all duration-200">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {pdfExportError && (
              <div className="px-4 sm:px-6 pt-3">
                <p className="text-xs font-bold text-red-500">{pdfExportError}</p>
              </div>
            )}

            <div className="overflow-y-auto max-h-[calc(92vh-60px)] sm:max-h-[calc(90vh-65px)]">
              {detailLoading ? (
                <div className="flex flex-col items-center py-16">
                  <div className="w-10 h-10 border-[3px] border-orange-200 border-t-orange-500 rounded-full animate-spin mb-4" />
                  <span className="text-sm text-neutral-400 font-semibold">Loading student data…</span>
                </div>
              ) : !detail ? (
                <div className="text-center py-16 text-neutral-400 font-semibold">Failed to load student details.</div>
              ) : (
                <div className="p-5 space-y-4">

                  {/* Profile card */}
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50/50 border border-orange-100 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-orange-100 border-2 border-orange-200 flex-shrink-0 shadow-md">
                        <Image
                          src={`/${photoDir}/photo_${detail.student.roll_no}.jpg`}
                          alt={detail.student.student_name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const t = e.currentTarget; t.style.display = 'none';
                            const p = t.parentElement;
                            if (p && !p.querySelector('.af')) {
                              const d = document.createElement('div');
                              d.className = 'af w-full h-full flex items-center justify-center text-2xl font-extrabold text-orange-400 bg-orange-100';
                              d.textContent = (detail.student.student_name || '?').charAt(0).toUpperCase();
                              p.appendChild(d);
                            }
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base sm:text-xl font-extrabold text-neutral-900 leading-tight">{detail.student.student_name}</h4>
                        <p className="text-orange-500 font-mono text-xs sm:text-sm font-bold mt-0.5 tracking-wide">{detail.student.roll_no}</p>
                        <div className="grid grid-cols-2 gap-x-3 sm:gap-x-5 gap-y-2 sm:gap-y-3 mt-3 sm:mt-4">
                          {[
                            { l: 'Father', v: detail.student.father_name },
                            { l: 'Mother', v: detail.student.mother_name },
                            { l: 'Branch', v: detail.student.branch },
                            { l: 'Year', v: detail.student.year },
                          ].map(f => (
                            <div key={f.l}>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">{f.l}</span>
                              <p className="text-neutral-800 font-bold text-sm mt-0.5">{f.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Highlighted mode switch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => setActiveDetailTab('marks')}
                      className={`rounded-xl px-4 py-2.5 text-left border transition-all duration-200 ${
                        activeDetailTab === 'marks'
                          ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-orange-300'
                      }`}
                    >
                      <div className={`text-[10px] font-black uppercase tracking-widest ${activeDetailTab === 'marks' ? 'text-orange-100' : 'text-neutral-400'}`}>
                        Highlighted View
                      </div>
                      <div className="text-sm font-extrabold">Internal Marks</div>
                    </button>
                    {(table === '1styearmaster' || detail.profile) && (
                      <button
                        onClick={() => setActiveDetailTab('profile')}
                        className={`rounded-xl px-4 py-2.5 text-left border transition-all duration-200 ${
                          activeDetailTab === 'profile'
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg shadow-neutral-900/20'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        <div className={`text-[10px] font-black uppercase tracking-widest ${activeDetailTab === 'profile' ? 'text-neutral-300' : 'text-neutral-400'}`}>
                          2528allinfo
                        </div>
                        <div className="text-sm font-extrabold">Complete User Profile</div>
                      </button>
                    )}
                  </div>

                  {activeDetailTab === 'marks' ? (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="bg-neutral-50 border border-neutral-200 rounded-xl sm:rounded-2xl px-2 sm:px-4 py-3 sm:py-3.5 text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900">{detail.summary.totalPapers}</div>
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-1">Total Papers</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl sm:rounded-2xl px-2 sm:px-4 py-3 sm:py-3.5 text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{detail.summary.filled}</div>
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-1">Marks Filled</div>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl sm:rounded-2xl px-2 sm:px-4 py-3 sm:py-3.5 text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-orange-600">{detail.summary.pending}</div>
                          <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-orange-400 mt-1">Pending</div>
                        </div>
                      </div>

                      {/* Disclaimer */}
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                        <div className="flex items-center gap-2 mb-2.5">
                          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-700">Marks Scheme</span>
                        </div>
                        <ul className="space-y-1.5">
                          {[
                            { label: 'Mid Term', max: '/ 30', color: 'text-blue-600', bg: 'bg-blue-100' },
                            { label: 'Sessional', max: '/ 60', color: 'text-emerald-600', bg: 'bg-emerald-100' },
                            { label: 'Practical (regular)', max: '/ 40', color: 'text-purple-600', bg: 'bg-purple-100' },
                            { label: 'Practical (FEC papers)', max: '/ 100', color: 'text-orange-600', bg: 'bg-orange-100' },
                          ].map(item => (
                            <li key={item.label} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                <span className="text-xs font-semibold text-amber-800">{item.label}</span>
                              </div>
                              <span className={`${item.color} ${item.bg} text-xs font-extrabold px-2.5 py-0.5 rounded-lg flex-shrink-0 tabular-nums`}>{item.max}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Papers table */}
                      <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white flex items-center justify-between">
                          <h5 className="text-xs font-extrabold text-neutral-500 uppercase tracking-widest">Paper-wise Internal Marks</h5>
                          <span className="text-xs font-bold text-neutral-400">{detail.papers.length} papers</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200">
                              <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest w-7">#</th>
                              <th className="px-3 py-2.5 text-left text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest">Paper</th>
                              <th className="px-3 py-2.5 text-right text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest whitespace-nowrap">Marks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.papers.map((p, i) => {
                              const mv = (p.marks_status || '').trim();
                              const isAbsent = mv.toLowerCase() === 'absent';
                              const isNumeric = !isAbsent && mv !== '' && !isNaN(Number(mv));
                              const full = getFullMarks(p.paper_type, p.paper_name);
                              return (
                                <tr key={i} className="border-b border-neutral-100 last:border-b-0 hover:bg-orange-50/40 transition-colors duration-150">
                                  <td className="px-3 py-3 text-neutral-400 font-bold text-xs align-top pt-3.5">{i + 1}</td>
                                  <td className="px-3 py-3">
                                    <div className="text-neutral-800 text-xs font-semibold leading-snug">{p.paper_name}</div>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      <span className="inline-block bg-neutral-100 border border-neutral-200 rounded-md px-1.5 py-0.5 text-[10px] text-neutral-500 font-bold">{p.paper_type}</span>
                                      {p.exam_type && <span className="inline-block bg-neutral-50 border border-neutral-200 rounded-md px-1.5 py-0.5 text-[10px] text-neutral-400 font-semibold">{p.exam_type}</span>}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-right align-top pt-3.5">
                                    {isAbsent ? (
                                      <span className="text-red-600 font-extrabold text-xs">Absent</span>
                                    ) : isNumeric && full > 0 ? (
                                      <span className="font-extrabold text-xs tabular-nums">
                                        <span className="text-neutral-900">{mv}</span>
                                        <span className="text-neutral-400 font-bold">/{full}</span>
                                      </span>
                                    ) : (
                                      <span className="text-neutral-400 text-xs font-semibold">{mv || '—'}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <>
                      {!detail.profile ? (
                        <div className="border border-neutral-200 bg-neutral-50 rounded-2xl p-6 text-center">
                          <div className="text-sm font-extrabold text-neutral-700">No matched record found in 2528allinfo.</div>
                          <div className="text-xs font-semibold text-neutral-500 mt-1">Run extraction ingest for missing branches, then reopen this student.</div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl p-4 text-white border border-neutral-700 shadow-xl shadow-neutral-900/20">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300">2528allinfo Profile</div>
                                <h5 className="text-lg font-extrabold mt-1">{valueOrDash(detail.profile.applicant_name)}</h5>
                                <p className="text-xs font-semibold text-neutral-300 mt-1">{valueOrDash(detail.profile.email)} · {valueOrDash(detail.profile.mobile_no)}</p>
                              </div>
                              {detail.profileMatch && (
                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider border ${
                                  detail.profileMatch.confidence === 'high'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                                    : detail.profileMatch.confidence === 'medium'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                      : 'bg-orange-500/20 text-orange-300 border-orange-400/40'
                                }`}>
                                  Match {detail.profileMatch.confidence}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { l: 'Applicant Name', v: detail.profile.applicant_name },
                              { l: 'Father Name', v: detail.profile.father_name },
                              { l: 'Mother Name', v: detail.profile.mother_name },
                              { l: 'Gender', v: detail.profile.gender },
                              { l: 'DOB', v: detail.profile.dob },
                              { l: 'Student Status', v: detail.profile.student_status },
                              { l: 'Caste', v: detail.profile.caste },
                              { l: 'Category I/II', v: detail.profile.category_i_ii },
                              { l: 'Category III', v: detail.profile.category_iii },
                              { l: 'Specialization Branch', v: detail.profile.specialization_branch },
                              { l: 'Admission Status', v: detail.profile.admission_status },
                              { l: 'Earlier Enrollment No', v: detail.profile.earlier_enrollment_no },
                              { l: 'Mobile No', v: detail.profile.mobile_no },
                              { l: 'Parent Mobile No', v: detail.profile.parent_mobile_no },
                              { l: 'Entrance Exam Roll No', v: detail.profile.entrance_exam_roll_no },
                              { l: 'Entrance Exam Name', v: detail.profile.entrance_exam_name },
                              { l: 'Merit Secured', v: detail.profile.merit_secured },
                              { l: 'Email', v: detail.profile.email },
                              { l: 'Has Aadhar Card', v: detail.profile.has_aadhar_card },
                              { l: 'Aadhar No', v: detail.profile.aadhar_no },
                              { l: 'Educational Qualification', v: detail.profile.educational_qualification },
                              { l: 'College Shift', v: detail.profile.college_shift },
                            ].map(item => (
                              <div key={item.l} className="bg-white border border-neutral-200 rounded-xl p-3.5">
                                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{item.l}</div>
                                <div className="text-sm font-bold text-neutral-800 mt-1 break-words">{valueOrDash(item.v)}</div>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                              <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">Permanent Address</div>
                              <p className="text-sm font-semibold text-orange-900 mt-2 leading-relaxed break-words">{valueOrDash(detail.profile.permanent_address)}</p>
                            </div>
                            <div className="border border-sky-200 bg-sky-50 rounded-xl p-4">
                              <div className="text-[10px] font-black uppercase tracking-widest text-sky-600">Correspondence Address</div>
                              <p className="text-sm font-semibold text-sky-900 mt-2 leading-relaxed break-words">{valueOrDash(detail.profile.correspondence_address)}</p>
                            </div>
                          </div>

                          <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                            <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2">
                              <h5 className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">Education Details</h5>
                              <span className="text-xs font-bold text-neutral-400">{detail.profile.education_rows?.length || 0} rows</span>
                            </div>
                            {detail.profile.education_rows && detail.profile.education_rows.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs min-w-[700px]">
                                  <thead>
                                    <tr className="bg-neutral-50 border-b border-neutral-200">
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Exam</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Roll</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Year</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Stream</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Board</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Obt.</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Max</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">%</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">CGPA</th>
                                      <th className="px-3 py-2 text-left font-extrabold text-neutral-400 uppercase tracking-widest">Result</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.profile.education_rows.map((row, idx) => (
                                      <tr key={idx} className="border-b border-neutral-100 last:border-b-0">
                                        <td className="px-3 py-2 font-semibold text-neutral-700">{valueOrDash(row.exam)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.rollNo)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.year)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.stream)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.board)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.obtainedMarks)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.maxMarks)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.percentage)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.cgpa)}</td>
                                        <td className="px-3 py-2 text-neutral-600">{valueOrDash(row.result)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="px-4 py-4 text-sm text-neutral-500 font-semibold">Education rows were not detected in this extracted form.</div>
                            )}
                          </div>

                          <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50">
                            <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Extraction Metadata</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {[
                                { l: 'Source File', v: detail.profile.source_file },
                                { l: 'Page Number', v: detail.profile.page_number },
                                { l: 'Form Type', v: detail.profile.form_type },
                                { l: 'Session', v: detail.profile.session },
                                { l: 'College', v: detail.profile.college },
                                { l: 'Branch Name', v: detail.profile.branch_name },
                                { l: 'Extracted At', v: detail.profile.extracted_at },
                              ].map(item => (
                                <div key={item.l} className="rounded-lg border border-neutral-200 bg-white p-2.5">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{item.l}</div>
                                  <div className="font-semibold text-neutral-700 mt-1 break-words">{valueOrDash(item.v)}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      )}
                    </>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
