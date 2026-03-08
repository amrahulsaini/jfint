'use client';

import { useState, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Static data extracted from real RTU HTML source ─────────────────────────

const COOKIE_DEFAULT = process.env.NEXT_PUBLIC_RTU_COOKIE ?? '';
const COLLEGE_ID     = process.env.NEXT_PUBLIC_RTU_COLLEGE_ID ?? '140';
const COLLEGE_NAME   = process.env.NEXT_PUBLIC_RTU_COLLEGE_NAME ?? '';

const SESSIONS = [
  { value: '23', label: '2026 - 2027' },
  { value: '22', label: '2025 - 2026' },
  { value: '21', label: '2024 - 2025' },
  { value: '9',  label: '2023 - 2024' },
  { value: '8',  label: '2022 - 2023' },
  { value: '7',  label: '2021 - 2022' },
  { value: '6',  label: '2020 - 2021' },
];

const DEGREES = [
  { value: '2',  label: 'B. Arch' },
  { value: '12', label: 'B. Des' },
  { value: '1',  label: 'B. Tech' },
  { value: '10', label: 'B. Tech UD' },
  { value: '16', label: 'BBA' },
  { value: '15', label: 'BCA' },
  { value: '13', label: 'BFA' },
  { value: '11', label: 'BFAD' },
  { value: '3',  label: 'BHMCT' },
  { value: '14', label: 'BVE' },
  { value: '5',  label: 'M. Arch' },
  { value: '4',  label: 'M. Tech' },
  { value: '17', label: 'M. TECH (PART TIME)' },
  { value: '8',  label: 'MAM' },
  { value: '6',  label: 'MBA' },
  { value: '7',  label: 'MCA' },
  { value: '9',  label: 'Ph. D.' },
];

const PAPER_TYPES  = [
  { value: 'M', label: 'Mid-Term' },
  { value: 'P', label: 'Practical' },
  { value: 'S', label: 'Sessional' },
];

const STUDENT_CATS = [{ value: '1', label: 'REGULAR' }];

const EXAM_TYPES   = [
  { value: '1', label: 'Main' },
  { value: '2', label: 'Back' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectOption { value: string; label: string }

interface DetailGrid { columns: string[]; rows: Record<string, string>[] }
interface DetailData {
  title: string;
  studentGrid: DetailGrid;
  addMoreGrid:  DetailGrid;
}

// ─── SelectField Component ────────────────────────────────────────────────────

function SelectField({
  label, id, value, onChange, options, placeholder,
  disabled = false, required = false, loading = false,
}: {
  label: string; id: string; value: string;
  onChange: (v: string) => void;
  options: SelectOption[]; placeholder: string;
  disabled?: boolean; required?: boolean; loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
        {loading && (
          <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
        )}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className={`w-full border rounded px-2 py-1.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition
          ${disabled || loading ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'hover:border-blue-400'}
          ${required && !value ? 'border-orange-300' : 'border-gray-300'}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarksEntryPage() {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [cookie, setCookie]         = useState(COOKIE_DEFAULT);
  const [cookieDraft, setCookieDraft] = useState(COOKIE_DEFAULT);
  const [showCookiePanel, setShowCookiePanel] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [session,     setSession]     = useState('');
  const [examConfig,  setExamConfig]  = useState('');
  const [degree,      setDegree]      = useState('');
  const [degreeCycle, setDegreeCycle] = useState('');
  const [subject,     setSubject]     = useState('');
  const [paperType,   setPaperType]   = useState('');
  const [batch,       setBatch]       = useState('');
  const [paperName,   setPaperName]   = useState('');
  const [studentCat,  setStudentCat]  = useState('');
  const [examType,    setExamType]    = useState('');

  // ── Cascaded options (live from RTU) ──────────────────────────────────────
  const [examConfigs,  setExamConfigs]  = useState<SelectOption[]>([]);
  const [degreeCycles, setDegreeCycles] = useState<SelectOption[]>([]);
  const [subjects,     setSubjects]     = useState<SelectOption[]>([]);
  const [batches,      setBatches]      = useState<SelectOption[]>([]);
  const [paperNames,   setPaperNames]   = useState<SelectOption[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [cascadingField, setCascadingField] = useState('');
  const [viewLoading,    setViewLoading]    = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── Results ───────────────────────────────────────────────────────────────
  const [columns,   setColumns]   = useState<string[]>([]);
  const [rows,      setRows]      = useState<Record<string, string>[]>([]);
  const [viewMsg,   setViewMsg]   = useState('');
  const [hasViewed, setHasViewed] = useState(false);

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData,    setDetailData]    = useState<DetailData | null>(null);
  const [detailError,   setDetailError]   = useState('');

  // ── Export All state ──────────────────────────────────────────────────────
  const [exportingAll, setExportingAll] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  // ── Navigation ────────────────────────────────────────────────────────────
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [activeNav, setActiveNav] = useState<string | null>(null);

  const vsRef = useRef('');
  const evRef = useRef(''); // __EVENTVALIDATION from last VIEW response
  const detailClickedIdx = useRef<number>(0); // tracks which summary row was clicked for detail modal

  // ─── Generic cascade API call ─────────────────────────────────────────────
  const cascade = useCallback(async (
    fieldKey: string,
    eventTarget: string,
    formValues: Record<string, string>,
  ): Promise<Record<string, SelectOption[]> | null> => {
    setCascadingField(fieldKey);
    setSessionExpired(false);
    try {
      const res  = await fetch('/api/rtu/cascade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie,
          eventTarget,
          __VIEWSTATE: vsRef.current,
          __VIEWSTATEGENERATOR: '68EA6D12',
          ...formValues,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { setSessionExpired(true); return null; }
      if (!res.ok) { console.error('cascade error:', data.error); return null; }
      if (data.viewState) vsRef.current = data.viewState;
      return data.options as Record<string, SelectOption[]>;
    } catch (e) {
      console.error('cascade network error', e);
      return null;
    } finally {
      setCascadingField('');
    }
  }, [cookie]);

  // ─── Dropdown handlers ────────────────────────────────────────────────────

  const onSessionChange = useCallback(async (v: string) => {
    setSession(v);
    setExamConfig(''); setExamConfigs([]);
    if (!v) return;
    const opts = await cascade('session', 'ctl00$ContentPlaceHolder1$D_ddlsession', {
      'ctl00$ContentPlaceHolder1$ddlcollegename': COLLEGE_ID,
      'ctl00$ContentPlaceHolder1$D_ddlsession': v,
    });
    if (opts?.examConfig)  setExamConfigs(opts.examConfig);
  }, [cascade]);

  const onExamConfigChange = useCallback(async (v: string) => {
    setExamConfig(v);
    if (!v) return;
    await cascade('examConfig', 'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration', {
      'ctl00$ContentPlaceHolder1$ddlcollegename': COLLEGE_ID,
      'ctl00$ContentPlaceHolder1$D_ddlsession': session,
      'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': v,
    });
  }, [cascade, session]);

  const onDegreeChange = useCallback(async (v: string) => {
    setDegree(v);
    setDegreeCycle(''); setDegreeCycles([]);
    setSubject(''); setSubjects([]);
    setBatch(''); setBatches([]);
    setPaperName(''); setPaperNames([]);
    if (!v) return;
    const opts = await cascade('degree', 'ctl00$ContentPlaceHolder1$D_ddlDegree', {
      'ctl00$ContentPlaceHolder1$ddlcollegename': COLLEGE_ID,
      'ctl00$ContentPlaceHolder1$D_ddlsession': session,
      'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
      'ctl00$ContentPlaceHolder1$D_ddlDegree': v,
    });
    if (opts?.degreeCycle) setDegreeCycles(opts.degreeCycle);
    if (opts?.batch)       setBatches(opts.batch);
  }, [cascade, session, examConfig]);

  const onDegreeCycleChange = useCallback(async (v: string) => {
    setDegreeCycle(v);
    setSubject(''); setSubjects([]);
    setPaperName(''); setPaperNames([]);
    if (!v) return;
    const opts = await cascade('degreeCycle', 'ctl00$ContentPlaceHolder1$D_ddlDegreecycle', {
      'ctl00$ContentPlaceHolder1$ddlcollegename': COLLEGE_ID,
      'ctl00$ContentPlaceHolder1$D_ddlsession': session,
      'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
      'ctl00$ContentPlaceHolder1$D_ddlDegree': degree,
      'ctl00$ContentPlaceHolder1$D_ddlDegreecycle': v,
    });
    if (opts?.subject) setSubjects(opts.subject);
  }, [cascade, session, examConfig, degree]);

  const onSubjectChange = useCallback(async (v: string) => {
    setSubject(v);
    setPaperName(''); setPaperNames([]);
    if (!v) return;
    const opts = await cascade('subject', 'ctl00$ContentPlaceHolder1$ddlSubject', {
      'ctl00$ContentPlaceHolder1$ddlcollegename': COLLEGE_ID,
      'ctl00$ContentPlaceHolder1$D_ddlsession': session,
      'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
      'ctl00$ContentPlaceHolder1$D_ddlDegree': degree,
      'ctl00$ContentPlaceHolder1$D_ddlDegreecycle': degreeCycle,
      'ctl00$ContentPlaceHolder1$ddlSubject': v,
    });
    if (opts?.paperName) setPaperNames(opts.paperName);
  }, [cascade, session, examConfig, degree, degreeCycle]);

  const onPaperTypeChange = useCallback(async (v: string) => {
    setPaperType(v);
    setPaperName(''); setPaperNames([]);
    if (!v) return;
    const opts = await cascade('paperType', 'ctl00$ContentPlaceHolder1$ddlPaperType', {
      'ctl00$ContentPlaceHolder1$ddlcollegename': COLLEGE_ID,
      'ctl00$ContentPlaceHolder1$D_ddlsession': session,
      'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
      'ctl00$ContentPlaceHolder1$D_ddlDegree': degree,
      'ctl00$ContentPlaceHolder1$D_ddlDegreecycle': degreeCycle,
      'ctl00$ContentPlaceHolder1$ddlSubject': subject,
      'ctl00$ContentPlaceHolder1$ddlPaperType': v,
    });
    if (opts?.paperName) setPaperNames(opts.paperName);
  }, [cascade, session, examConfig, degree, degreeCycle, subject]);

  const onBatchChange = useCallback(async (v: string) => {
    setBatch(v);
    // NOTE: Do NOT clear paperNames here. The Batch cascade returns full HTML
    // where ddlCourse is empty (the server only populates it during PaperType callback).
    // Clearing here would wipe out the user's course selection.
    if (!v) return;
    await cascade('batch', 'ctl00$ContentPlaceHolder1$ddlBatch', {
      'ctl00$ContentPlaceHolder1$ddlcollegename': COLLEGE_ID,
      'ctl00$ContentPlaceHolder1$D_ddlsession': session,
      'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
      'ctl00$ContentPlaceHolder1$D_ddlDegree': degree,
      'ctl00$ContentPlaceHolder1$D_ddlDegreecycle': degreeCycle,
      'ctl00$ContentPlaceHolder1$ddlSubject': subject,
      'ctl00$ContentPlaceHolder1$ddlPaperType': paperType,
      'ctl00$ContentPlaceHolder1$ddlBatch': v,
    });
  }, [cascade, session, examConfig, degree, degreeCycle, subject, paperType]);

  // ─── VIEW submit ──────────────────────────────────────────────────────────
  const handleView = useCallback(async () => {
    setViewMsg('');
    setViewLoading(true);
    setHasViewed(false);
    setSessionExpired(false);
    try {
      const res  = await fetch('/api/rtu/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie,
          __VIEWSTATE:          vsRef.current,
          __VIEWSTATEGENERATOR: '68EA6D12',
          'ctl00$ContentPlaceHolder1$ddlcollegename':         COLLEGE_ID,
          'ctl00$ContentPlaceHolder1$D_ddlsession':           session,
          'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
          'ctl00$ContentPlaceHolder1$D_ddlDegree':            degree,
          'ctl00$ContentPlaceHolder1$D_ddlDegreecycle':       degreeCycle,
          'ctl00$ContentPlaceHolder1$ddlSubject':             subject,
          'ctl00$ContentPlaceHolder1$ddlPaperType':           paperType || '0',
          'ctl00$ContentPlaceHolder1$ddlBatch':               batch || '0',
          'ctl00$ContentPlaceHolder1$ddlCourse':              paperName || '0',
          'ctl00$ContentPlaceHolder1$D_ddlStucategory':       studentCat || '',
          'ctl00$ContentPlaceHolder1$ddlexamtype':            examType || '0',
        }),
      });
      const data = await res.json();
      if (res.status === 401) { setSessionExpired(true); setViewLoading(false); return; }
      if (!res.ok) { setViewMsg(data.error ?? 'Submit failed'); setViewLoading(false); return; }
      if (data.newViewState) vsRef.current = data.newViewState;
      if (data.eventValidation) evRef.current = data.eventValidation;
      setColumns(data.columns ?? []);
      setRows(data.rows ?? []);
      setViewMsg(data.message ?? '');
      setHasViewed(true);
    } catch { setViewMsg('Network error'); }
    setViewLoading(false);
  }, [cookie, session, examConfig, degree, degreeCycle, subject, paperType, batch, paperName, studentCat, examType]);

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSession(''); setExamConfig(''); setDegree(''); setDegreeCycle('');
    setSubject(''); setPaperType(''); setBatch(''); setPaperName('');
    setStudentCat(''); setExamType('');
    setExamConfigs([]); setDegreeCycles([]); setSubjects([]); setBatches([]); setPaperNames([]);
    setColumns([]); setRows([]); setViewMsg(''); setHasViewed(false);
    setSessionExpired(false);
  }, []);

  // ─── Export CSV (summary grid) ────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!rows.length) return;
    const header = columns.join(',');
    const body   = rows.map((r) => columns.map((c) => `"${(r[c] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv    = [header, ...body].join('\n');
    const url    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a      = Object.assign(document.createElement('a'), { href: url, download: 'rtu_marks.csv' });
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, columns]);

  // ─── Helper: build a flat CSV string from column headers + row arrays ─────
  const csvLine = (cols: string[]) => cols.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',');

  // ─── Helper: detect if column name is S.No. (case-insensitive) ────────────
  const isSnoCol = (name: string) => /^s\.?\s*no\.?$/i.test(name.trim());

  // ─── Get Paper Name, Type, Subject & Year from summary grid row ─────────
  const getPaperInfo = useCallback((idx: number) => {
    const r = rows[idx] ?? {};
    const pName   = r['Paper Name'] || r['PAPER NAME'] || r['Course'] || '—';
    const pType   = r['Paper Type'] || r['PAPER TYPE'] || '—';
    const subject = r['Subject Name'] || r['SUBJECT NAME'] || r['Branch'] || '—';
    // Year comes from VIEW grid's YEAR column (e.g. "B. Tech IIIrd Sem")
    const year    = r['Year'] || r['YEAR'] || r['year'] || '—';
    return { pName, pType, subject, year };
  }, [rows]);

  // ─── Export detail modal student data (CSV) ───────────────────────────────
  const handleExportDetail = useCallback(() => {
    if (!detailData || detailClickedIdx.current == null) return;
    const { studentGrid, addMoreGrid } = detailData;
    const { pName, pType, subject } = getPaperInfo(detailClickedIdx.current);

    const baseCols = studentGrid.columns.length > 0 ? studentGrid.columns : addMoreGrid.columns;
    const exportCols = ['Subject Name (Branch)', 'Paper Name', 'Paper Type', ...baseCols];
    const lines: string[] = [csvLine(exportCols)];

    let sno = 1;
    for (const r of studentGrid.rows) {
      const vals = baseCols.map(c => isSnoCol(c) ? String(sno++) : (r[c] ?? ''));
      lines.push(csvLine([subject, pName, pType, ...vals]));
    }
    for (const r of addMoreGrid.rows) {
      const vals = baseCols.map(c => isSnoCol(c) ? String(sno++) : (r[c] ?? ''));
      lines.push(csvLine([subject, pName, pType, ...vals]));
    }

    const csv = lines.join('\n');
    const safeName = pName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a   = Object.assign(document.createElement('a'), { href: url, download: `rtu_students_${safeName}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }, [detailData, getPaperInfo, isSnoCol]);

  // ─── Export detail modal (PDF) ────────────────────────────────────────────
  const handleExportDetailPdf = useCallback(() => {
    if (!detailData || detailClickedIdx.current == null) return;
    const { studentGrid, addMoreGrid } = detailData;
    const { pName, pType, subject } = getPaperInfo(detailClickedIdx.current);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(12);
    doc.text('RTU - Student Details', 14, 15);
    doc.setFontSize(9);
    doc.text(`Branch: ${subject}  |  ${pName}`, 14, 21);

    const baseCols = studentGrid.columns.length > 0 ? studentGrid.columns : addMoreGrid.columns;
    const head = [['Branch', 'Paper Name', 'Paper Type', ...baseCols]];
    const body: string[][] = [];

    let sno = 1;
    for (const r of studentGrid.rows) {
      body.push([subject, pName, pType, ...baseCols.map(c => isSnoCol(c) ? String(sno++) : (r[c] ?? ''))]);
    }
    for (const r of addMoreGrid.rows) {
      body.push([subject, pName, pType, ...baseCols.map(c => isSnoCol(c) ? String(sno++) : (r[c] ?? ''))]);
    }

    autoTable(doc, {
      startY: 25,
      head,
      body,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    const safeName = pName.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60);
    doc.save(`rtu_students_${safeName}.pdf`);
  }, [detailData, getPaperInfo, isSnoCol]);

  // ─── Export ALL details — continuous flat table (CSV) ─────────────────────
  const handleExportAll = useCallback(async () => {
    if (!rows.length) return;
    setExportingAll(true);

    const toFetch = rows
      .map((r, i) => ({ idx: i, val: r['Total Form Filled'] }))
      .filter(x => x.val && x.val !== '—' && x.val !== '0' && parseInt(x.val, 10) > 0);

    setExportProgress({ current: 0, total: toFetch.length });

    let headerWritten = false;
    let allCols: string[] = [];
    const lines: string[] = [];
    let globalSno = 1;

    for (let i = 0; i < toFetch.length; i++) {
      const { idx } = toFetch[i];
      setExportProgress({ current: i + 1, total: toFetch.length });

      const rowCtl      = String(idx + 2).padStart(2, '0');
      const eventTarget = `ctl00$ContentPlaceHolder1$gvcollegemarksdtl$ctl${rowCtl}$lblformfilled`;

      try {
        const res = await fetch('/api/rtu/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookie,
            eventTarget,
            __VIEWSTATE:          vsRef.current,
            __VIEWSTATEGENERATOR: '68EA6D12',
            __EVENTVALIDATION:    evRef.current,
            'ctl00$ContentPlaceHolder1$ddlcollegename':         COLLEGE_ID,
            'ctl00$ContentPlaceHolder1$D_ddlsession':           session,
            'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
            'ctl00$ContentPlaceHolder1$D_ddlDegree':            degree,
            'ctl00$ContentPlaceHolder1$D_ddlDegreecycle':       degreeCycle,
            'ctl00$ContentPlaceHolder1$ddlSubject':             subject,
            'ctl00$ContentPlaceHolder1$ddlPaperType':           paperType || '0',
            'ctl00$ContentPlaceHolder1$ddlBatch':               batch || '0',
            'ctl00$ContentPlaceHolder1$ddlCourse':              paperName || '0',
            'ctl00$ContentPlaceHolder1$D_ddlStucategory':       studentCat || '',
            'ctl00$ContentPlaceHolder1$ddlexamtype':            examType || '0',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.newViewState) vsRef.current = data.newViewState;

          const { pName, pType, subject } = getPaperInfo(idx);

          const grids = [
            ...(data.studentGrid?.rows?.length > 0 ? [data.studentGrid] : []),
            ...(data.addMoreGrid?.rows?.length > 0 ? [data.addMoreGrid] : []),
          ];

          for (const grid of grids) {
            if (!headerWritten) {
              allCols = ['Subject Name (Branch)', 'Paper Name', 'Paper Type', ...grid.columns];
              lines.push(csvLine(allCols));
              headerWritten = true;
            }
            for (const r of grid.rows) {
              const vals = (grid.columns as string[]).map((c: string) => isSnoCol(c) ? String(globalSno++) : (r[c] ?? ''));
              lines.push(csvLine([subject, pName, pType, ...vals]));
            }
          }
        }
      } catch {
        // skip failed rows silently
      }
    }

    const csv = lines.join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a   = Object.assign(document.createElement('a'), { href: url, download: 'rtu_all_details.csv' });
    a.click();
    URL.revokeObjectURL(url);

    setExportingAll(false);
    setExportProgress({ current: 0, total: 0 });
  }, [rows, columns, cookie, session, examConfig, degree, degreeCycle, subject, paperType, batch, paperName, studentCat, examType, getPaperInfo, isSnoCol]);

  // ─── Export ALL details — continuous flat table (PDF) ─────────────────────
  const handleExportAllPdf = useCallback(async () => {
    if (!rows.length) return;
    setExportingAll(true);

    const toFetch = rows
      .map((r, i) => ({ idx: i, val: r['Total Form Filled'] }))
      .filter(x => x.val && x.val !== '—' && x.val !== '0' && parseInt(x.val, 10) > 0);

    setExportProgress({ current: 0, total: toFetch.length });

    let headCols: string[] = [];
    const allRows: string[][] = [];
    let globalSno = 1;

    for (let i = 0; i < toFetch.length; i++) {
      const { idx } = toFetch[i];
      setExportProgress({ current: i + 1, total: toFetch.length });

      const rowCtl      = String(idx + 2).padStart(2, '0');
      const eventTarget = `ctl00$ContentPlaceHolder1$gvcollegemarksdtl$ctl${rowCtl}$lblformfilled`;

      try {
        const res = await fetch('/api/rtu/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookie,
            eventTarget,
            __VIEWSTATE:          vsRef.current,
            __VIEWSTATEGENERATOR: '68EA6D12',
            __EVENTVALIDATION:    evRef.current,
            'ctl00$ContentPlaceHolder1$ddlcollegename':         COLLEGE_ID,
            'ctl00$ContentPlaceHolder1$D_ddlsession':           session,
            'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
            'ctl00$ContentPlaceHolder1$D_ddlDegree':            degree,
            'ctl00$ContentPlaceHolder1$D_ddlDegreecycle':       degreeCycle,
            'ctl00$ContentPlaceHolder1$ddlSubject':             subject,
            'ctl00$ContentPlaceHolder1$ddlPaperType':           paperType || '0',
            'ctl00$ContentPlaceHolder1$ddlBatch':               batch || '0',
            'ctl00$ContentPlaceHolder1$ddlCourse':              paperName || '0',
            'ctl00$ContentPlaceHolder1$D_ddlStucategory':       studentCat || '',
            'ctl00$ContentPlaceHolder1$ddlexamtype':            examType || '0',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.newViewState) vsRef.current = data.newViewState;

          const { pName, pType, subject } = getPaperInfo(idx);

          const grids = [
            ...(data.studentGrid?.rows?.length > 0 ? [data.studentGrid] : []),
            ...(data.addMoreGrid?.rows?.length > 0 ? [data.addMoreGrid] : []),
          ];

          for (const grid of grids) {
            if (headCols.length === 0) {
              headCols = ['Branch', 'Paper Name', 'Paper Type', ...grid.columns];
            }
            for (const r of grid.rows) {
              const vals = (grid.columns as string[]).map((c: string) => isSnoCol(c) ? String(globalSno++) : (r[c] ?? ''));
              allRows.push([subject, pName, pType, ...vals]);
            }
          }
        }
      } catch {
        // skip failed rows
      }
    }

    // Build PDF
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text('RTU - All Student Details', 14, 15);
    doc.setFontSize(9);
    doc.text(`${allRows.length} students across ${toFetch.length} papers`, 14, 21);

    if (headCols.length > 0 && allRows.length > 0) {
      autoTable(doc, {
        startY: 25,
        head: [headCols],
        body: allRows,
        styles: { fontSize: 6, cellPadding: 1.2 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
    }

    doc.save('rtu_all_details.pdf');

    setExportingAll(false);
    setExportProgress({ current: 0, total: 0 });
  }, [rows, columns, cookie, session, examConfig, degree, degreeCycle, subject, paperType, batch, paperName, studentCat, examType, getPaperInfo, isSnoCol]);

  // ─── Export ALL details — SQL INSERT statements ───────────────────────────
  const handleExportSQL = useCallback(async () => {
    if (!rows.length) return;
    setExportingAll(true);

    const toFetch = rows
      .map((r, i) => ({ idx: i, val: r['Total Form Filled'] }))
      .filter(x => x.val && x.val !== '—' && x.val !== '0' && parseInt(x.val, 10) > 0);

    setExportProgress({ current: 0, total: toFetch.length });

    const TABLE = '`jecr_2ndyear`';
    const COLS  = '(`sno`, `year`, `branch`, `paper_name`, `paper_type`, `roll_no`, `exam_type`, `student_name`, `father_name`, `mother_name`, `marks_status`)';

    const sqlEsc = (s: string) => (s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const sqlLines: string[] = [
      '-- RTU Marks Export',
      `-- Generated: ${new Date().toISOString()}`,
      `-- Table: ${TABLE}`,
      '',
      `CREATE TABLE IF NOT EXISTS ${TABLE} (`,
      '  `id` INT AUTO_INCREMENT PRIMARY KEY,',
      '  `sno` INT NOT NULL,',
      '  `year` VARCHAR(100) DEFAULT NULL,',
      '  `branch` VARCHAR(200) DEFAULT NULL,',
      '  `paper_name` VARCHAR(300) DEFAULT NULL,',
      '  `paper_type` VARCHAR(50) DEFAULT NULL,',
      '  `roll_no` VARCHAR(50) DEFAULT NULL,',
      '  `exam_type` VARCHAR(50) DEFAULT NULL,',
      '  `student_name` VARCHAR(200) DEFAULT NULL,',
      '  `father_name` VARCHAR(200) DEFAULT NULL,',
      '  `mother_name` VARCHAR(200) DEFAULT NULL,',
      '  `marks_status` VARCHAR(100) DEFAULT NULL',
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
      '',
      `INSERT INTO ${TABLE} ${COLS} VALUES`,
    ];

    let globalSno = 1;
    const valueRows: string[] = [];

    for (let i = 0; i < toFetch.length; i++) {
      const { idx } = toFetch[i];
      setExportProgress({ current: i + 1, total: toFetch.length });

      const rowCtl      = String(idx + 2).padStart(2, '0');
      const eventTarget = `ctl00$ContentPlaceHolder1$gvcollegemarksdtl$ctl${rowCtl}$lblformfilled`;

      try {
        const res = await fetch('/api/rtu/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookie,
            eventTarget,
            __VIEWSTATE:          vsRef.current,
            __VIEWSTATEGENERATOR: '68EA6D12',
            __EVENTVALIDATION:    evRef.current,
            'ctl00$ContentPlaceHolder1$ddlcollegename':         COLLEGE_ID,
            'ctl00$ContentPlaceHolder1$D_ddlsession':           session,
            'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
            'ctl00$ContentPlaceHolder1$D_ddlDegree':            degree,
            'ctl00$ContentPlaceHolder1$D_ddlDegreecycle':       degreeCycle,
            'ctl00$ContentPlaceHolder1$ddlSubject':             subject,
            'ctl00$ContentPlaceHolder1$ddlPaperType':           paperType || '0',
            'ctl00$ContentPlaceHolder1$ddlBatch':               batch || '0',
            'ctl00$ContentPlaceHolder1$ddlCourse':              paperName || '0',
            'ctl00$ContentPlaceHolder1$D_ddlStucategory':       studentCat || '',
            'ctl00$ContentPlaceHolder1$ddlexamtype':            examType || '0',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.newViewState) vsRef.current = data.newViewState;

          const { pName, pType, subject: branch, year } = getPaperInfo(idx);

          const grids = [
            ...(data.studentGrid?.rows?.length > 0 ? [data.studentGrid] : []),
            ...(data.addMoreGrid?.rows?.length > 0 ? [data.addMoreGrid] : []),
          ];

          for (const grid of grids) {
            const cols = grid.columns as string[];
            // Detect column names case-insensitively
            const rollCol   = cols.find((c: string) => /roll/i.test(c))       || 'Roll No.';
            const examCol   = cols.find((c: string) => /exam.*type/i.test(c)) || 'Exam Type';
            const nameCol   = cols.find((c: string) => /student/i.test(c))    || 'Student Name';
            const fatherCol = cols.find((c: string) => /father/i.test(c))     || 'Father Name';
            const motherCol = cols.find((c: string) => /mother/i.test(c))     || 'Mother Name';
            const marksCol  = cols.find((c: string) => /marks|status/i.test(c)) || 'Marks Status';

            for (const r of grid.rows) {
              const sno = globalSno++;
              valueRows.push(
                `(${sno}, '${sqlEsc(year)}', '${sqlEsc(branch)}', '${sqlEsc(pName)}', '${sqlEsc(pType)}', '${sqlEsc(r[rollCol] ?? '')}', '${sqlEsc(r[examCol] ?? '')}', '${sqlEsc(r[nameCol] ?? '')}', '${sqlEsc(r[fatherCol] ?? '')}', '${sqlEsc(r[motherCol] ?? '')}', '${sqlEsc(r[marksCol] ?? '')}')`
              );
            }
          }
        }
      } catch {
        // skip failed rows
      }
    }

    // Join all value rows with commas, end with semicolon
    if (valueRows.length > 0) {
      sqlLines.push(valueRows.join(',\n') + ';');
    } else {
      // Remove the INSERT INTO line if no data
      sqlLines.pop();
      sqlLines.push('-- No data found to export.');
    }

    sqlLines.push('');
    sqlLines.push(`-- Total rows: ${valueRows.length}`);

    const sql = sqlLines.join('\n');
    const url = URL.createObjectURL(new Blob([sql], { type: 'text/sql' }));
    const a   = Object.assign(document.createElement('a'), { href: url, download: 'rtu_marks_insert.sql' });
    a.click();
    URL.revokeObjectURL(url);

    setExportingAll(false);
    setExportProgress({ current: 0, total: 0 });
  }, [rows, columns, cookie, session, examConfig, degree, degreeCycle, subject, paperType, batch, paperName, studentCat, examType, getPaperInfo]);

  // ─── Detail — click Total Form Filled number ─────────────────────────────
  const handleDetailClick = useCallback(async (rowIdx: number) => {
    detailClickedIdx.current = rowIdx;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    setDetailError('');
    const rowCtl      = String(rowIdx + 2).padStart(2, '0');
    const eventTarget = `ctl00$ContentPlaceHolder1$gvcollegemarksdtl$ctl${rowCtl}$lblformfilled`;
    try {
      const res = await fetch('/api/rtu/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie,
          eventTarget,
          __VIEWSTATE:          vsRef.current,
          __VIEWSTATEGENERATOR: '68EA6D12',
          __EVENTVALIDATION:    evRef.current,
          'ctl00$ContentPlaceHolder1$ddlcollegename':         COLLEGE_ID,
          'ctl00$ContentPlaceHolder1$D_ddlsession':           session,
          'ctl00$ContentPlaceHolder1$d_ddlexamconfiguration': examConfig,
          'ctl00$ContentPlaceHolder1$D_ddlDegree':            degree,
          'ctl00$ContentPlaceHolder1$D_ddlDegreecycle':       degreeCycle,
          'ctl00$ContentPlaceHolder1$ddlSubject':             subject,
          'ctl00$ContentPlaceHolder1$ddlPaperType':           paperType || '0',
          'ctl00$ContentPlaceHolder1$ddlBatch':               batch || '0',
          'ctl00$ContentPlaceHolder1$ddlCourse':              paperName || '0',
          'ctl00$ContentPlaceHolder1$D_ddlStucategory':       studentCat || '',
          'ctl00$ContentPlaceHolder1$ddlexamtype':            examType || '0',
        }),
      });
      const data = await res.json();
      if (res.status === 401) { setSessionExpired(true); setDetailOpen(false); setDetailLoading(false); return; }
      if (!res.ok) { setDetailError(data.error ?? 'Failed to load'); setDetailLoading(false); return; }
      setDetailData(data as DetailData);
    } catch { setDetailError('Network error'); }
    finally   { setDetailLoading(false); }
  }, [cookie, session, examConfig, degree, degreeCycle, subject, paperType, batch, paperName, studentCat, examType]);

  const isCascading = cascadingField !== '';

  const navItems = [
    { label: 'Examination Form',    children: ['Exam Form Payment Report Collegewise'] },
    { label: 'Track Marks Feeding', children: ['Track Marks Entry (RTU)'] },
    { label: 'Result',              children: ['Result Dashboard'] },
    { label: 'Revaluation',         children: ['Revaluation Form Details'] },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 font-sans">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 text-white shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          {/* Logo + name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow flex-shrink-0">
              <span className="text-blue-800 font-extrabold text-sm leading-none">RTU</span>
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">RTU</div>
              <div className="text-xs text-blue-200">Rajasthan Technical University</div>
            </div>
          </div>
          {/* User / college pill */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-blue-200 text-xs uppercase tracking-wide">Monitoring System</span>
            <div className="relative group">
              <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-full transition text-xs">
                <div className="w-6 h-6 rounded-full bg-blue-300 flex items-center justify-center font-bold text-blue-900 text-xs flex-shrink-0">
                  1217
                </div>
                <span className="hidden sm:block max-w-[200px] truncate">JAIPUR ENGINEERING COLLEGE &amp; RC</span>
                <span className="text-xs">▾</span>
              </button>
              <div className="absolute right-0 mt-1 w-72 bg-white text-gray-700 rounded-lg shadow-2xl hidden group-hover:block z-50 text-xs border border-gray-100">
                <div className="px-4 py-3 border-b text-gray-400 text-xs">{COLLEGE_NAME}</div>
                <a
                  href="https://rtu.sumsraj.com/UMM/ChangePassword.aspx"
                  target="_blank" rel="noreferrer"
                  className="block px-4 py-2.5 hover:bg-gray-50 text-gray-700"
                >
                  🔑 Change Password
                </a>
                <a
                  href="https://rtu.sumsraj.com/Logout.aspx?State=Out"
                  target="_blank" rel="noreferrer"
                  className="block px-4 py-2.5 hover:bg-gray-50 text-red-500"
                >
                  ⬡ Log Out
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="bg-blue-700 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white py-3 text-sm flex items-center gap-1"
          >
            ☰ Menu
          </button>
          <ul className={`${menuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row`}>
            {navItems.map((item) => (
              <li key={item.label} className="relative group">
                <button
                  onClick={() => setActiveNav(activeNav === item.label ? null : item.label)}
                  className="px-4 py-3 text-sm text-white hover:bg-blue-600 flex items-center gap-1 w-full md:w-auto transition"
                >
                  {item.label}
                  <span className="text-xs opacity-70">▾</span>
                </button>
                <ul className={`${activeNav === item.label ? 'block' : 'hidden'} md:group-hover:block md:hidden absolute left-0 w-56 bg-white shadow-xl rounded-b z-50`}>
                  {item.children.map((c) => (
                    <li key={c}>
                      <a href="#" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-50 last:border-0">{c}</a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

        {/* Session Expired Banner */}
        {sessionExpired && (
          <div className="bg-red-50 border border-red-400 rounded-xl p-5">
            <p className="text-red-700 font-bold text-sm mb-2">⚠️ RTU Session Expired</p>
            <p className="text-red-600 text-xs mb-3">
              RTU sessions expire in minutes. Get fresh cookies:
            </p>
            <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1 mb-3">
              <li>Open <a href="https://rtu.sumsraj.com/Monitoring/Examination/ACD_Track_PaperMarksEntry_RTU.aspx" target="_blank" rel="noreferrer" className="text-blue-600 underline">this RTU link</a> while logged in.</li>
              <li>Press <kbd className="bg-gray-200 px-1.5 py-0.5 rounded font-mono text-xs">F12</kbd> → <strong>Application</strong> → <strong>Cookies</strong> → <strong>rtu.sumsraj.com</strong></li>
              <li>Copy both <code className="bg-gray-100 px-1 rounded">ASP.NET_SessionId</code> and <code className="bg-gray-100 px-1 rounded">AuthToken</code> values.</li>
              <li>Paste as: <code className="bg-gray-100 px-1 rounded text-xs">ASP.NET_SessionId=xxx; AuthToken=yyy</code></li>
            </ol>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={cookieDraft}
                onChange={(e) => setCookieDraft(e.target.value)}
                placeholder="ASP.NET_SessionId=xxx; AuthToken=yyy"
                className="flex-1 border border-red-300 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={() => { setCookie(cookieDraft); setSessionExpired(false); }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap"
              >
                💾 Apply &amp; Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Filter Form ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow border border-blue-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-blue-800 leading-tight">
              📋 Track Theory, Practical &amp; Sessional Marks Entry of Colleges
            </h2>
            <button
              onClick={() => { setShowCookiePanel(!showCookiePanel); setCookieDraft(cookie); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0 ml-2"
            >
              🔑 Update Cookie
            </button>
          </div>

          {/* Inline cookie update panel */}
          {showCookiePanel && (
            <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg p-3">
              <p className="text-xs text-amber-700 font-medium mb-2">
                Paste fresh cookies from: DevTools → Application → Cookies → rtu.sumsraj.com
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={cookieDraft}
                  onChange={(e) => setCookieDraft(e.target.value)}
                  placeholder="ASP.NET_SessionId=xxx; AuthToken=yyy"
                  className="flex-1 border border-amber-300 rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={() => { setCookie(cookieDraft); setShowCookiePanel(false); setSessionExpired(false); }}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded transition whitespace-nowrap"
                >
                  💾 Apply
                </button>
              </div>
            </div>
          )}

          {/* College name - pre-filled, read-only */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">College Name</label>
            <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-1.5 text-sm text-gray-700">
              {COLLEGE_NAME}
            </div>
          </div>

          {/* Dropdowns grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SelectField
              label="Academic Session" id="session" required
              value={session}
              onChange={onSessionChange}
              options={SESSIONS}
              placeholder="-- Select Academic Session --"
              loading={cascadingField === 'session'}
            />
            <SelectField
              label="Exam Config" id="examConfig" required
              value={examConfig}
              onChange={onExamConfigChange}
              options={examConfigs}
              placeholder="-- Select Exam Config --"
              disabled={!session}
              loading={cascadingField === 'examConfig'}
            />
            <SelectField
              label="Degree" id="degree" required
              value={degree}
              onChange={onDegreeChange}
              options={DEGREES}
              placeholder="-- Select Degree --"
              disabled={!examConfig}
              loading={cascadingField === 'degree'}
            />
            <SelectField
              label="Degree Cycle" id="degreeCycle" required
              value={degreeCycle}
              onChange={onDegreeCycleChange}
              options={degreeCycles}
              placeholder="-- Select Degree Cycle --"
              disabled={!degree}
              loading={cascadingField === 'degreeCycle'}
            />
            <SelectField
              label="Subject" id="subject"
              value={subject}
              onChange={onSubjectChange}
              options={subjects}
              placeholder="-- Select Subject --"
              disabled={!degreeCycle}
              loading={cascadingField === 'subject'}
            />
            <SelectField
              label="Paper Type" id="paperType"
              value={paperType}
              onChange={onPaperTypeChange}
              options={PAPER_TYPES}
              placeholder="-- Select Paper Type --"
              loading={cascadingField === 'paperType'}
            />
            <SelectField
              label="Batch" id="batch" required
              value={batch}
              onChange={onBatchChange}
              options={batches}
              placeholder="-- Select Batch --"
              disabled={!degree}
              loading={cascadingField === 'batch'}
            />
            <SelectField
              label="Paper Name" id="paperName" required
              value={paperName}
              onChange={setPaperName}
              options={paperNames}
              placeholder="-- Select Paper Name --"
              disabled={!batch && !subject}
            />
            <SelectField
              label="Student Category" id="studentCat"
              value={studentCat}
              onChange={setStudentCat}
              options={STUDENT_CATS}
              placeholder="-- Select Student Category --"
            />
            <SelectField
              label="Exam Type" id="examType" required
              value={examType}
              onChange={setExamType}
              options={EXAM_TYPES}
              placeholder="-- Select Exam Type --"
            />
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={handleView}
              disabled={viewLoading || isCascading}
              className="px-6 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg shadow transition flex items-center gap-2"
            >
              {viewLoading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Loading…</>
                : '🔍 VIEW'}
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg shadow transition"
            >
              ↺ RESET
            </button>
            {hasViewed && rows.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow transition"
                >
                  📥 Export Summary
                </button>
                <button
                  onClick={handleExportAll}
                  disabled={exportingAll}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm font-semibold rounded-lg shadow transition flex items-center gap-2"
                >
                  {exportingAll
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Exporting {exportProgress.current}/{exportProgress.total}…</>
                    : '📊 Export All (CSV)'}
                </button>
                <button
                  onClick={handleExportAllPdf}
                  disabled={exportingAll}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-lg shadow transition flex items-center gap-2"
                >
                  {exportingAll
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Exporting {exportProgress.current}/{exportProgress.total}…</>
                    : '📄 Export All (PDF)'}
                </button>
                <button
                  onClick={handleExportSQL}
                  disabled={exportingAll}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-semibold rounded-lg shadow transition flex items-center gap-2"
                >
                  {exportingAll
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Exporting {exportProgress.current}/{exportProgress.total}…</>
                    : '🗃️ Export All (SQL)'}
                </button>
              </>
            )}
            {isCascading && (
              <span className="text-xs text-blue-500 italic flex items-center gap-1">
                <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                Fetching live data from RTU…
              </span>
            )}
          </div>

          {/* View message */}
          {viewMsg && (
            <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg">
              ℹ️ {viewMsg}
            </div>
          )}
        </div>

        {/* ── Results Table ─────────────────────────────────────────────────── */}
        {hasViewed && rows.length > 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-x-auto">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-blue-800 text-sm">
                Student Marks Data &nbsp;·&nbsp;
                <span className="text-gray-500 font-normal">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  className="text-xs text-green-600 hover:text-green-800 hover:underline font-medium"
                >
                  📥 Summary CSV
                </button>
                <button
                  onClick={handleExportAll}
                  disabled={exportingAll}
                  className="text-xs text-purple-600 hover:text-purple-800 hover:underline font-medium disabled:text-purple-400"
                >
                  {exportingAll ? `📊 ${exportProgress.current}/${exportProgress.total}…` : '📊 All CSV'}
                </button>
                <button
                  onClick={handleExportAllPdf}
                  disabled={exportingAll}
                  className="text-xs text-red-600 hover:text-red-800 hover:underline font-medium disabled:text-red-400"
                >
                  {exportingAll ? `📄 ${exportProgress.current}/${exportProgress.total}…` : '📄 All PDF'}
                </button>
                <button
                  onClick={handleExportSQL}
                  disabled={exportingAll}
                  className="text-xs text-amber-600 hover:text-amber-800 hover:underline font-medium disabled:text-amber-400"
                >
                  {exportingAll ? `🗃️ ${exportProgress.current}/${exportProgress.total}…` : '🗃️ All SQL'}
                </button>
              </div>
            </div>
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-800 text-white">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide whitespace-nowrap border-b border-blue-700"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 border-b border-gray-100 whitespace-nowrap"
                      >
                        {col === 'Total Form Filled' && row[col] && row[col] !== '—' ? (
                          <button
                            onClick={() => handleDetailClick(idx)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer"
                            title="Click to view student list"
                          >
                            {row[col]}
                          </button>
                        ) : (
                          row[col] ?? '—'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
              {rows.length} rows · Live data from rtu.sumsraj.com
            </div>
          </div>
        )}

        {/* Empty state after VIEW */}
        {hasViewed && rows.length === 0 && !viewLoading && (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium text-sm">{viewMsg || 'No records found for the selected criteria.'}</p>
          </div>
        )}

      </main>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      {detailOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="font-bold text-blue-800 text-sm truncate max-w-[90%]">
                {detailData?.title || 'Student List'}
              </h3>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                {detailData && (
                  <>
                    <button
                      onClick={handleExportDetail}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow transition"
                    >
                      📥 CSV
                    </button>
                    <button
                      onClick={handleExportDetailPdf}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow transition"
                    >
                      📄 PDF
                    </button>
                  </>
                )}
                <button
                  onClick={() => setDetailOpen(false)}
                  className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {detailLoading && (
                <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                  <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
                  Loading student list from RTU…
                </div>
              )}
              {detailError && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">{detailError}</div>
              )}
              {detailData && !detailLoading && (
                <>
                  {/* List of Students */}
                  <section>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                      📋 List of Students
                      <span className="ml-2 text-blue-600 font-normal normal-case">
                        ({detailData.studentGrid.rows.length} record{detailData.studentGrid.rows.length !== 1 ? 's' : ''})
                      </span>
                    </h4>
                    {detailData.studentGrid.rows.length === 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 italic">No student records found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded border border-gray-200">
                        <table className="min-w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-blue-700 text-white">
                              {detailData.studentGrid.columns.map((c) => (
                                <th key={c} className="px-3 py-2 text-left font-semibold uppercase tracking-wide whitespace-nowrap">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.studentGrid.rows.map((r, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {detailData!.studentGrid.columns.map((c) => (
                                  <td key={c} className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap">{r[c] ?? '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* List of Add More Students */}
                  {detailData.addMoreGrid.rows.length > 0 && (
                    <section>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        ➕ List of Add More Students
                        <span className="ml-2 text-orange-600 font-normal normal-case">
                          ({detailData.addMoreGrid.rows.length} record{detailData.addMoreGrid.rows.length !== 1 ? 's' : ''})
                        </span>
                      </h4>
                      <div className="overflow-x-auto rounded border border-gray-200">
                        <table className="min-w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-orange-600 text-white">
                              {detailData.addMoreGrid.columns.map((c) => (
                                <th key={c} className="px-3 py-2 text-left font-semibold uppercase tracking-wide whitespace-nowrap">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.addMoreGrid.rows.map((r, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-orange-50'}>
                                {detailData!.addMoreGrid.columns.map((c) => (
                                  <td key={c} className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap">{r[c] ?? '—'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>

            {/* Modal footer */}
            {detailData && (
              <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-400 flex-shrink-0">
                {detailData.studentGrid.rows.length} student(s)
                {detailData.addMoreGrid.rows.length > 0 && ` · ${detailData.addMoreGrid.rows.length} add-more student(s)`}
                {' · Live from rtu.sumsraj.com'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="mt-10 bg-blue-900 text-blue-200 text-xs text-center py-4 px-4">
        © Rajasthan Technical University · Jaipur Engineering College &amp; Research Centre ·
        Data sourced live from <a href="https://rtu.sumsraj.com" target="_blank" rel="noreferrer" className="underline">rtu.sumsraj.com</a>
      </footer>

    </div>
  );
}
