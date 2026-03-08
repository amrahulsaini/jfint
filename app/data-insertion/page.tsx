'use client';

import { useState, useRef, useCallback } from 'react';

interface StudentRecord {
  pageNum: number;
  rollNo: string;
  enrollmentNo: string;
  name: string;
  fatherName: string;
  motherName: string;
  branch: string;
  exam: string;
  photoBase64: string | null;
  photoWidth: number;
  photoHeight: number;
  alternatives: string[];
}

export default function DataInsertionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [savingPhotoIdx, setSavingPhotoIdx] = useState<number | null>(null);
  const [savedRollNos, setSavedRollNos] = useState<string[]>([]);
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (f && f.type === 'application/pdf') {
      setFile(f);
      setError('');
      setStudents([]);
      setDone(false);
      setTotalPages(0);
      setTotalPhotos(0);
      setSaveMsg('');
      setSavedRollNos([]);
    } else if (f) {
      setError('Please select a PDF file');
    }
  };

  /* ── Stream SSE page-by-page ── */
  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setProgress('Uploading…');
    setError('');
    setStudents([]);
    setDone(false);
    setTotalPages(0);
    setTotalPhotos(0);
    setSaveMsg('');
    setSavedRollNos([]);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      setProgress(`Processing ${(file.size / 1024 / 1024).toFixed(1)} MB…`);

      const res = await fetch('/api/pdf-extract', { method: 'POST', body: formData });

      if (!res.ok || !res.body) {
        const text = await res.text();
        try { setError(JSON.parse(text).error || text); } catch { setError(text); }
        setLoading(false);
        setProgress('');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';

        for (const part of parts) {
          const eventMatch = part.match(/^event:\s*(.+)$/m);
          const dataMatch = part.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === 'init') {
            setTotalPages(data.totalPages);
            setProgress(`Extracting 0 / ${data.totalPages} pages…`);
          } else if (event === 'page') {
            setStudents(prev => {
              const next = [...prev, data as StudentRecord];
              setProgress(`Extracting ${next.length} / ${data.pageNum <= totalPages ? totalPages : '?'} pages…`);
              return next;
            });
          } else if (event === 'done') {
            setTotalPhotos(data.totalStudentPhotos);
            setTotalPages(data.totalPages);
            setDone(true);
          } else if (event === 'error') {
            setError(data.error);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setLoading(false);
    setProgress('');
  }, [file, totalPages]);

  /* ── Pick alternative photo for a student ── */
  const pickPhoto = (studentIdx: number, altBase64: string) => {
    setStudents(prev => {
      const next = [...prev];
      next[studentIdx] = { ...next[studentIdx], photoBase64: altBase64 };
      return next;
    });
    const rollNo = students[studentIdx]?.rollNo;
    if (rollNo) setSavedRollNos(prev => prev.filter(r => r !== rollNo));
    setPickerIdx(null);
  };

  /* ── Clear photo ── */
  const clearPhoto = (studentIdx: number) => {
    setStudents(prev => {
      const next = [...prev];
      next[studentIdx] = { ...next[studentIdx], photoBase64: null };
      return next;
    });
    const rollNo = students[studentIdx]?.rollNo;
    if (rollNo) setSavedRollNos(prev => prev.filter(r => r !== rollNo));
    setPickerIdx(null);
  };

  /* ── Export SQL (client-side download) ── */
  const handleExportSQL = () => {
    if (students.length === 0) return;
    const TABLE = '`1styearmaster`';
    const lines: string[] = [
      `-- Generated on ${new Date().toISOString()}`,
      `-- ${students.filter(s => s.rollNo && s.name).length} records\n`,
      `CREATE TABLE IF NOT EXISTS ${TABLE} (`,
      `  id INT AUTO_INCREMENT PRIMARY KEY,`,
      `  roll_no VARCHAR(50) NOT NULL,`,
      `  enrollment_no VARCHAR(50) DEFAULT '',`,
      `  student_name VARCHAR(200) NOT NULL,`,
      `  father_name VARCHAR(200) DEFAULT '',`,
      `  mother_name VARCHAR(200) DEFAULT '',`,
      `  branch VARCHAR(100) DEFAULT '',`,
      `  exam VARCHAR(200) DEFAULT '',`,
      `  photo_saved TINYINT(1) DEFAULT 0,`,
      `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,`,
      `  UNIQUE KEY uk_roll (roll_no)`,
      `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n`,
    ];
    for (const s of students) {
      if (!s.rollNo || !s.name) continue;
      const esc = (v: string) => v.replace(/'/g, "''");
      lines.push(
        `REPLACE INTO ${TABLE} (roll_no, enrollment_no, student_name, father_name, mother_name, branch, exam, photo_saved) VALUES ('${esc(s.rollNo)}', '${esc(s.enrollmentNo)}', '${esc(s.name)}', '${esc(s.fatherName)}', '${esc(s.motherName)}', '${esc(s.branch)}', '${esc(s.exam)}', ${s.photoBase64 ? 1 : 0});`
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/sql' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `1styearmaster_${Date.now()}.sql`;
    a.click();
    URL.revokeObjectURL(a.href);
    setSaveMsg(`SQL file downloaded — ${students.filter(s => s.rollNo && s.name).length} records`);
  };

  /* ── Save photos to disk ── */
  const handleSavePhotos = async () => {
    if (students.length === 0) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/pdf-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students }),
      });
      const json = await res.json();
      if (json.error) setSaveMsg(`Error: ${json.error}`);
      else {
        setSaveMsg(`Saved ${json.photosSaved} photos to 1styearphotos/`);
        setSavedRollNos(students.filter(s => s.rollNo && s.photoBase64).map(s => s.rollNo));
      }
    } catch {
      setSaveMsg('Failed to save photos');
    }
    setSaving(false);
  };

  const handleSaveSinglePhoto = async (studentIdx: number) => {
    const student = students[studentIdx];
    if (!student?.rollNo || !student?.name || !student?.photoBase64) return;

    setSavingPhotoIdx(studentIdx);
    setSaveMsg('');
    try {
      const res = await fetch('/api/pdf-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: [student] }),
      });
      const json = await res.json();
      if (json.error) {
        setSaveMsg(`Error: ${json.error}`);
      } else {
        setSavedRollNos(prev => Array.from(new Set([...prev, student.rollNo])));
        setSaveMsg(`Saved photo for ${student.rollNo} to 1styearphotos/`);
      }
    } catch {
      setSaveMsg(`Failed to save photo for ${student.rollNo}`);
    }
    setSavingPhotoIdx(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0] || null);
  };

  const handleReset = () => {
    setFile(null);
    setStudents([]);
    setDone(false);
    setTotalPages(0);
    setTotalPhotos(0);
    setError('');
    setSaveMsg('');
    setSavedRollNos([]);
    setSavingPhotoIdx(null);
    setPickerIdx(null);
  };

  const validCount = students.filter(s => s.rollNo && s.name).length;
  const showResults = students.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <a href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center font-extrabold text-sm text-white shadow-lg shadow-orange-500/25">
              J
            </div>
            <span className="text-lg font-bold tracking-tight text-neutral-900">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </a>
          <span className="text-sm font-semibold text-neutral-400">Data Insertion</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-neutral-900">PDF Data Extraction</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Upload RTU admission card PDF — click any photo to change it.
          </p>
        </div>

        {/* Upload Area */}
        {!showResults && (
          <div className="mb-8">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                file ? 'border-orange-300 bg-orange-50' : 'border-neutral-300 bg-neutral-50 hover:border-orange-400 hover:bg-orange-50/50'
              }`}
            >
              <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
              {file ? (
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="font-bold text-neutral-900">{file.name}</p>
                  <p className="text-sm text-neutral-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB — Ready</p>
                </div>
              ) : (
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="font-bold text-neutral-700">Drop PDF here or click to browse</p>
                  <p className="text-sm text-neutral-400 mt-1">Supports admission card PDFs up to 100 MB</p>
                </div>
              )}
            </div>
            {file && (
              <div className="mt-4 flex items-center gap-3">
                <button onClick={handleUpload} disabled={loading} className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed">
                  {loading ? 'Processing…' : 'Extract Data'}
                </button>
                {!loading && (
                  <button onClick={() => { setFile(null); setError(''); }} className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors">Clear</button>
                )}
                {progress && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                    {progress}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Live progress bar during streaming */}
        {loading && totalPages > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 mb-1">
              <span>Extracting pages…</span>
              <span>{students.length} / {totalPages}</span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${(students.length / totalPages) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <>
            {/* Summary bar */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-2xl font-black text-neutral-900">{totalPages || students.length}</div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Pages</div>
                </div>
                <div className="w-px h-10 bg-neutral-200" />
                <div>
                  <div className="text-2xl font-black text-orange-500">{students.filter(s => s.photoBase64).length}</div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Photos</div>
                </div>
                <div className="w-px h-10 bg-neutral-200" />
                <div>
                  <div className="text-2xl font-black text-emerald-600">{validCount}</div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Valid</div>
                </div>
                {!done && (
                  <>
                    <div className="w-px h-10 bg-neutral-200" />
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <div className="w-4 h-4 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                      Processing…
                    </div>
                  </>
                )}
              </div>
              {done && (
                <div className="flex items-center gap-3">
                  <button onClick={handleReset} className="border border-neutral-200 text-neutral-600 hover:text-neutral-900 font-semibold px-5 py-2.5 rounded-xl text-sm transition-all">Upload New</button>
                  <button onClick={handleExportSQL} className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md">Export SQL</button>
                  <button onClick={handleSavePhotos} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed">
                    {saving ? 'Saving…' : 'Save Photos'}
                  </button>
                </div>
              )}
            </div>

            {saveMsg && (
              <div className={`mb-6 rounded-2xl p-4 text-sm font-medium ${saveMsg.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
                {saveMsg}
              </div>
            )}

            {done && (
              <p className="mb-4 text-xs text-neutral-400 font-medium">
                Click any photo to pick a different image from that page. Wrong photo or signature? Click it and choose the right one.
              </p>
            )}

            {/* Student Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {students.map((s, i) => (
                <div key={i} className={`bg-white border rounded-2xl overflow-hidden transition-all animate-[fadeIn_0.3s_ease] ${s.rollNo && s.name ? 'border-neutral-200' : 'border-red-200 bg-red-50/30'}`}>
                  {/* Photo — clickable */}
                  <div
                    className="bg-neutral-50 border-b border-neutral-100 p-6 flex justify-center cursor-pointer group relative"
                    onClick={() => done && s.alternatives?.length > 0 && setPickerIdx(i)}
                  >
                    {s.photoBase64 ? (
                      <div className="relative">
                        <img src={s.photoBase64} alt={s.name || `Page ${s.pageNum}`} className="w-28 h-36 object-contain bg-white rounded-xl border-2 border-neutral-200 shadow-sm" />
                        {done && s.alternatives?.length > 1 && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <span className="text-white text-xs font-bold bg-black/60 px-2 py-1 rounded-lg">Change</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-28 h-36 rounded-xl bg-neutral-200 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                        {done && s.alternatives?.length > 0 ? (
                          <span className="text-xs font-bold text-neutral-400 group-hover:text-orange-500 text-center px-2">Click to pick photo</span>
                        ) : (
                          <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    {done && (
                      <div className="flex items-center justify-end gap-2">
                        {savedRollNos.includes(s.rollNo) && s.rollNo ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
                            Saved
                          </span>
                        ) : null}
                        <button
                          onClick={() => handleSaveSinglePhoto(i)}
                          disabled={!s.rollNo || !s.name || !s.photoBase64 || savingPhotoIdx === i}
                          className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-200 disabled:text-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-all disabled:cursor-not-allowed"
                        >
                          {savingPhotoIdx === i ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Page {s.pageNum}</span>
                      {s.rollNo && s.name ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">OK</span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">INCOMPLETE</span>
                      )}
                    </div>
                    {s.rollNo && <p className="text-orange-500 font-mono text-xs font-bold">{s.rollNo}</p>}
                    {s.name && <p className="text-neutral-900 font-bold text-sm leading-snug">{s.name}</p>}
                    <div className="space-y-1.5 text-xs pt-1">
                      <Row label="Father" value={s.fatherName} />
                      <Row label="Mother" value={s.motherName} />
                      <Row label="Branch" value={s.branch} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Photo Picker Modal ── */}
      {pickerIdx !== null && students[pickerIdx] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPickerIdx(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-neutral-900">Pick photo for Page {students[pickerIdx].pageNum}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {students[pickerIdx].name || students[pickerIdx].rollNo || `Student #${pickerIdx + 1}`}
                </p>
              </div>
              <button onClick={() => setPickerIdx(null)} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
              {students[pickerIdx].alternatives?.map((alt, ai) => (
                <button
                  key={ai}
                  onClick={() => pickPhoto(pickerIdx!, alt)}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                    alt === students[pickerIdx!].photoBase64
                      ? 'border-orange-500 ring-2 ring-orange-200'
                      : 'border-neutral-200 hover:border-orange-300'
                  }`}
                >
                  <img src={alt} alt={`Option ${ai + 1}`} className="w-full aspect-[3/4] object-contain bg-white" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                    <span className="text-[10px] font-bold text-white">#{ai + 1}</span>
                  </div>
                  {alt === students[pickerIdx!].photoBase64 && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => clearPhoto(pickerIdx!)}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                Remove photo
              </button>
              <button
                onClick={() => setPickerIdx(null)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold px-5 py-2 rounded-xl text-sm transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-neutral-400 font-medium flex-shrink-0 w-14">{label}</span>
      <span className="text-neutral-700 font-medium">{value}</span>
    </div>
  );
}
