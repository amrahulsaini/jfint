'use client';

import { useState, useRef } from 'react';

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
}

interface ExtractResult {
  totalPages: number;
  totalPhotosFound: number;
  totalStudentPhotos: number;
  students: StudentRecord[];
}

export default function DataInsertionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (f && f.type === 'application/pdf') {
      setFile(f);
      setError('');
      setResult(null);
      setSaveMsg('');
    } else if (f) {
      setError('Please select a PDF file');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setProgress('Uploading PDF…');
    setError('');
    setResult(null);
    setSaveMsg('');

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      setProgress(`Processing ${(file.size / 1024 / 1024).toFixed(1)} MB — this may take a minute…`);

      const res = await fetch('/api/pdf-extract', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        setResult(json);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setLoading(false);
    setProgress('');
  };

  const handleExportSQL = () => {
    if (!result) return;
    const TABLE = '`1styearmaster`';
    const lines: string[] = [
      `-- Generated on ${new Date().toISOString()}`,
      `-- ${result.students.filter(s => s.rollNo && s.name).length} records\n`,
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
    for (const s of result.students) {
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
    setSaveMsg(`SQL file downloaded — ${result.students.filter(s => s.rollNo && s.name).length} records`);
  };

  const handleSavePhotos = async () => {
    if (!result) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/pdf-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: result.students }),
      });
      const json = await res.json();
      if (json.error) setSaveMsg(`Error: ${json.error}`);
      else setSaveMsg(`Saved ${json.photosSaved} photos to student_photos/`);
    } catch {
      setSaveMsg('Failed to save photos');
    }
    setSaving(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    handleFile(f || null);
  };

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
          <h1 className="text-2xl md:text-3xl font-black text-neutral-900">
            PDF Data Extraction
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Upload RTU admission card PDF to extract student photos &amp; details.
            Verify the extracted data, then save to database.
          </p>
        </div>

        {/* Upload Area */}
        {!result && (
          <div className="mb-8">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                file
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-neutral-300 bg-neutral-50 hover:border-orange-400 hover:bg-orange-50/50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />

              {file ? (
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="font-bold text-neutral-900">{file.name}</p>
                  <p className="text-sm text-neutral-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB — Ready to process
                  </p>
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

            {/* Process button */}
            {file && (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold px-8 py-3 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing…' : 'Extract Data'}
                </button>
                {!loading && (
                  <button
                    onClick={() => { setFile(null); setResult(null); setError(''); }}
                    className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors"
                  >
                    Clear
                  </button>
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

        {/* Results */}
        {result && (
          <>
            {/* Summary bar */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-2xl font-black text-neutral-900">{result.totalPages}</div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Pages</div>
                </div>
                <div className="w-px h-10 bg-neutral-200" />
                <div>
                  <div className="text-2xl font-black text-orange-500">{result.totalStudentPhotos}</div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Photos Found</div>
                </div>
                <div className="w-px h-10 bg-neutral-200" />
                <div>
                  <div className="text-2xl font-black text-emerald-600">
                    {result.students.filter(s => s.rollNo && s.name).length}
                  </div>
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Valid Records</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setResult(null); setFile(null); }}
                  className="border border-neutral-200 text-neutral-600 hover:text-neutral-900 font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
                >
                  Upload New
                </button>
                <button
                  onClick={handleExportSQL}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md"
                >
                  Export SQL
                </button>
                <button
                  onClick={handleSavePhotos}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : 'Save Photos'}
                </button>
              </div>
            </div>

            {saveMsg && (
              <div className={`mb-6 rounded-2xl p-4 text-sm font-medium ${
                saveMsg.startsWith('Error')
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}>
                {saveMsg}
              </div>
            )}

            {/* Student Preview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {result.students.map((s, i) => (
                <div
                  key={i}
                  className={`bg-white border rounded-2xl overflow-hidden transition-all ${
                    s.rollNo && s.name
                      ? 'border-neutral-200'
                      : 'border-red-200 bg-red-50/30'
                  }`}
                >
                  {/* Photo */}
                  <div className="bg-neutral-50 border-b border-neutral-100 p-6 flex justify-center">
                    {s.photoBase64 ? (
                      <img
                        src={s.photoBase64}
                        alt={s.name || `Page ${s.pageNum}`}
                        className="w-28 h-36 object-cover rounded-xl border-2 border-neutral-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-28 h-36 rounded-xl bg-neutral-200 flex items-center justify-center">
                        <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        Page {s.pageNum}
                      </span>
                      {s.rollNo && s.name ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          OK
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                          INCOMPLETE
                        </span>
                      )}
                    </div>

                    {s.rollNo && (
                      <p className="text-orange-500 font-mono text-xs font-bold">{s.rollNo}</p>
                    )}
                    {s.name && (
                      <p className="text-neutral-900 font-bold text-sm leading-snug">{s.name}</p>
                    )}

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
