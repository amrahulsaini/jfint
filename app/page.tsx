'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

/* ── Types ── */
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

/* ── Prank Reveal ── */
function AprilFoolReveal({ student, onBack }: { student: StudentRow; onBack: () => void }) {
  const [confetti, setConfetti] = useState<{ id: number; left: number; delay: number; color: string; size: number }[]>([]);

  useEffect(() => {
    const colors = ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#14b8a6'];
    setConfetti(
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
      }))
    );
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onBack} />
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
      {confetti.map(p => (
        <div
          key={p.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: `${p.left}%`,
            top: -20,
            width: p.size,
            height: p.size * 1.5,
            background: p.color,
            borderRadius: '2px',
            animation: `confettiFall ${3 + Math.random() * 2}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
      <div
        className="relative z-50 max-w-lg w-full text-center"
        style={{ animation: 'bounceIn 0.8s ease-out forwards' }}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-orange-200 shadow-2xl shadow-orange-500/20 p-8 md:p-12">
          <div
            className="text-7xl md:text-8xl mb-6"
            style={{ animation: 'pulse 2s ease-in-out infinite' }}
          >
            🎉
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 mb-4">
            APRIL FOOL!
          </h1>
          <p className="text-lg md:text-xl font-bold text-neutral-600 mb-2">
            Gotcha, <span className="text-orange-500 font-extrabold">{student.student_name}</span>! 😜
          </p>
          <p className="text-sm font-semibold text-neutral-400 mb-6 leading-relaxed">
            Did you really think 3rd semester results would be available for free?
            <br />
            <span className="text-orange-500">Happy April Fool&apos;s Day! 🤡</span>
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Your &quot;Result&quot;</p>
            <div className="grid grid-cols-2 gap-3 text-left">
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Roll No</p>
                <p className="text-sm font-extrabold text-neutral-800">{student.roll_no}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase">Branch</p>
                <p className="text-sm font-extrabold text-neutral-800">{student.branch}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-neutral-400 uppercase">SGPA</p>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
                  April Fool 😂
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold py-3 px-6 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-orange-500/30 text-sm"
          >
            Go Back 😈
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Fake Loading Modal ── */
function FakeLoadingModal({ student, onLoaded }: { student: StudentRow; onLoaded: () => void }) {
  useEffect(() => {
    const t = setTimeout(onLoaded, 2500);
    return () => clearTimeout(t);
  }, [onLoaded]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-neutral-200 overflow-hidden z-10">
        <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-10 h-10 border-[3px] border-orange-200 border-t-orange-500 rounded-full animate-spin mb-5" />
          <h3 className="text-base font-black text-neutral-900 mb-1">Fetching Result</h3>
          <p className="text-sm text-neutral-500 font-semibold">Loading marks for {student.student_name}…</p>
          <p className="text-xs text-neutral-400 font-medium mt-2">{student.roll_no}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [prankStudent, setPrankStudent] = useState<StudentRow | null>(null);
  const [fakeLoading, setFakeLoading] = useState(false);

  const TABLE = 'jecr_2ndyear';
  const PHOTO_DIR = 'student_photos';
  const LIMIT = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT), table: TABLE });
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
  }, [page, search, branch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setSearch(searchInput); };

  const handleViewResult = (row: StudentRow) => {
    setFakeLoading(true);
    setPrankStudent(row);
  };

  if (error && !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-12 max-w-lg mx-auto text-center">
          <h3 className="text-lg font-black text-neutral-900 mb-1">Database Not Connected</h3>
          <p className="text-sm text-neutral-500 font-semibold">Results will appear once the data is available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-neutral-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-orange-500/30">
              J
            </div>
            <span className="text-lg font-black tracking-tight text-neutral-900">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-bold text-neutral-500">
            <span className="text-orange-500">3rd Sem Results</span>
          </div>
        </div>
      </nav>

      {/* ── Header Banner ── */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              Free Access
            </span>
            <span className="bg-white/20 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
              3rd Semester
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black leading-tight">
            3rd Sem Internal Marks — JECRC Foundation
          </h1>
          <p className="text-orange-100 text-sm font-semibold mt-2">
            View your 3rd semester internal marks entry status. Search by name or roll number below.
          </p>
        </div>
      </div>

      {/* ── Notice ── */}
      <div className="bg-emerald-50 border-b border-emerald-200">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-2.5 flex items-center gap-2.5">
          <span className="text-emerald-600 text-sm">🎁</span>
          <p className="text-xs font-bold text-emerald-700">
            <span className="font-extrabold">Special:</span> All 3rd semester results are now available for <span className="underline underline-offset-2">free</span> — no payment required! Click any student to view their marks.
          </p>
        </div>
      </div>

      <section className="max-w-7xl mx-auto px-5 md:px-8 py-6">

        {/* ── Stats ── */}
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
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-white border-neutral-200'
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

        {/* ── Search / Filter Bar ── */}
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
                <option value="">All Branches</option>
                {data?.branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </div>
          </div>

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

        {/* ── Card Grid ── */}
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
                onClick={() => handleViewResult(row)}
                className="group relative bg-white hover:bg-orange-50/30 border border-neutral-200 hover:border-orange-400 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1 active:translate-y-0 overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-orange-400/0 to-transparent group-hover:via-orange-400 transition-all duration-300 rounded-t-2xl" />
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-neutral-100 border-2 border-neutral-200 group-hover:border-orange-400 transition-all duration-300 flex-shrink-0">
                    <Image
                      src={`/${PHOTO_DIR}/photo_${row.roll_no}.jpg`}
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

                <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-500 uppercase tracking-wider group-hover:text-orange-500 transition-colors duration-200">
                    View Result — Free
                  </span>
                  <svg className="w-4 h-4 text-emerald-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {data && data.totalPages > 1 && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <span className="text-sm text-neutral-400 font-bold">
              Showing <span className="font-black text-neutral-700">{((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)}</span> of <span className="font-black text-neutral-700">{data.total.toLocaleString()}</span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <button onClick={() => setPage(1)} disabled={page <= 1} className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black">
                ««
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black">
                ‹
              </button>
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
              <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black">
                ›
              </button>
              <button onClick={() => setPage(data.totalPages)} disabled={page >= data.totalPages} className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-400 hover:text-orange-500 hover:border-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black">
                »»
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-neutral-200 px-5 py-5 bg-white mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-neutral-400">
          <span>&copy; {new Date().getFullYear()} JECRC Foundation</span>
          <span>
            Built with <span className="text-orange-500">&hearts;</span> for JECRC
          </span>
        </div>
      </footer>

      {/* ── Fake Loading → April Fool Reveal ── */}
      {prankStudent && fakeLoading && (
        <FakeLoadingModal
          student={prankStudent}
          onLoaded={() => setFakeLoading(false)}
        />
      )}
      {prankStudent && !fakeLoading && (
        <AprilFoolReveal
          student={prankStudent}
          onBack={() => setPrankStudent(null)}
        />
      )}
    </div>
  );
}
