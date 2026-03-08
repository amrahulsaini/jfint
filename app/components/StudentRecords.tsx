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
}

/* ── helpers ────────────────────────────────────────────── */
const statusPill = (s: string) => {
  const l = s?.toLowerCase() || '';
  if (l.includes('filled') || l.includes('complete') || l.includes('submit'))
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (l.includes('not') || l.includes('pending'))
    return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
  return 'text-white/40 bg-white/[0.04] border-white/10';
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

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); setSearch(searchInput); };

  const openDetail = async (rollNo: string) => {
    setShowModal(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/db/student-detail?roll_no=${encodeURIComponent(rollNo)}&table=${encodeURIComponent(table)}`);
      const json = await res.json();
      if (!json.error) setDetail(json);
    } catch { /* noop */ }
    setDetailLoading(false);
  };

  /* ── DB not connected ──────────────────────────────────── */
  if (error && !data) {
    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 text-center">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-12 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-white mb-1">Database Not Connected</h3>
          <p className="text-sm text-white/40 font-semibold">Student results will appear once the SQL data is imported.</p>
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
                  ? 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-200 hover:-translate-y-0.5'
                  : 'bg-white/[0.03] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200 hover:-translate-y-0.5'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                s.accent ? 'bg-orange-500/20 text-orange-400' : 'bg-white/[0.06] text-white/40'
              }`}>
                {s.icon}
              </div>
              <div>
                <div className={`text-2xl font-black leading-none ${s.accent ? 'text-orange-400' : 'text-white'}`}>
                  {s.val.toLocaleString()}
                </div>
                <div className="text-[11px] font-black uppercase tracking-wider text-white/30 mt-1">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Search / Filter Bar ─────────────────────────── */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name or roll number…"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all duration-200"
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
              className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-4 pr-9 py-2.5 text-sm font-bold text-white/70 focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all duration-200 cursor-pointer min-w-[160px]"
            >
              <option value="" className="bg-[#111118] text-white">All Branches</option>
              {data?.branches.map(b => <option key={b} value={b} className="bg-[#111118] text-white">{b}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </div>

        {/* Active filter chips */}
        {(search || branch) && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
            {search && (
              <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 text-xs font-black text-orange-400">
                &ldquo;{search}&rdquo;
                <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="hover:text-orange-200 transition-colors">×</button>
              </span>
            )}
            {branch && (
              <span className="inline-flex items-center gap-1.5 bg-white/[0.05] border border-white/[0.10] rounded-full px-3 py-1 text-xs font-black text-white/60">
                {branch}
                <button onClick={() => { setBranch(''); setPage(1); }} className="hover:text-white transition-colors">×</button>
              </span>
            )}
            <button onClick={() => { setSearch(''); setSearchInput(''); setBranch(''); setPage(1); }} className="text-xs font-bold text-white/25 hover:text-orange-400 transition-colors">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ─── Card Grid ───────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.06]" />
                <div className="flex-1">
                  <div className="h-4 bg-white/[0.06] rounded-full w-3/4 mb-2" />
                  <div className="h-3 bg-white/[0.06] rounded-full w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-white/[0.06] rounded-full w-full mb-2" />
              <div className="h-3 bg-white/[0.06] rounded-full w-2/3" />
            </div>
          ))}
        </div>
      ) : data?.rows.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-white/10 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <p className="text-white/50 font-black">No students found</p>
          <p className="text-white/25 font-semibold text-sm mt-1">Try a different search or filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {data?.rows.map((row) => (
            <div
              key={row.roll_no}
              onClick={() => openDetail(row.roll_no)}
              className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-orange-500/40 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1 active:translate-y-0 overflow-hidden"
            >
              {/* Top glow on hover */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/0 to-transparent group-hover:via-orange-500/50 transition-all duration-300" />
              {/* Photo + Name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/[0.06] border-2 border-white/[0.08] group-hover:border-orange-500/40 transition-all duration-300 flex-shrink-0">
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
                        d.className = 'af w-full h-full flex items-center justify-center text-xl font-black text-white/20 bg-white/[0.04]';
                        d.textContent = (row.student_name || '?').charAt(0).toUpperCase();
                        p.appendChild(d);
                      }
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-white text-sm leading-snug truncate group-hover:text-orange-300 transition-colors duration-200">
                    {row.student_name}
                  </h3>
                  <p className="text-orange-400 font-mono text-xs font-bold mt-0.5">{row.roll_no}</p>
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/30 font-bold">Father</span>
                  <span className="text-white/70 font-bold truncate ml-2 text-right max-w-[60%]">{row.father_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/30 font-bold">Branch</span>
                  <span className="bg-white/[0.06] border border-white/[0.10] text-white/60 rounded-lg px-2 py-0.5 text-[11px] font-black">
                    {row.branch}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/30 font-bold">Papers</span>
                  <span className="bg-orange-500/10 border border-orange-500/25 text-orange-400 rounded-lg px-2.5 py-0.5 text-[11px] font-black">
                    {row.paper_count}
                  </span>
                </div>
              </div>

              {/* View arrow */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <span className="text-[11px] font-black text-white/20 uppercase tracking-wider group-hover:text-orange-400/70 transition-colors duration-200">View Details</span>
                <svg className="w-4 h-4 text-white/15 group-hover:text-orange-400 group-hover:translate-x-1 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Pagination ──────────────────────────────────── */}
      {data && data.totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-white/30 font-bold">
            Showing <span className="font-black text-white/70">{((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)}</span> of <span className="font-black text-white/70">{data.total.toLocaleString()}</span>
          </span>
          <div className="flex items-center gap-1.5">
            {/* First */}
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black"
            >
              ««
            </button>
            {/* Prev */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black"
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
                      : 'bg-white/[0.03] border border-white/[0.08] text-white/40 hover:text-orange-400 hover:border-orange-500/40'
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
              className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black"
            >
              ›
            </button>
            {/* Last */}
            <button
              onClick={() => setPage(data.totalPages)}
              disabled={page >= data.totalPages}
              className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-white/30 hover:text-orange-400 hover:border-orange-500/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 text-xs font-black">
              »»
            </button>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowModal(false)} />

          <div className="relative bg-[#111118] border border-white/[0.10] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-base font-black text-white">Student Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/40 hover:text-white transition-all duration-200">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-57px)]">
              {detailLoading ? (
                <div className="flex flex-col items-center py-16">
                  <div className="w-10 h-10 border-[3px] border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4" />
                  <span className="text-sm text-white/30 font-bold">Loading…</span>
                </div>
              ) : !detail ? (
                <div className="text-center py-16 text-white/30 font-bold">Failed to load student details.</div>
              ) : (
                <div className="p-6">
                  {/* Profile */}
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 mb-6">
                    <div className="flex items-start gap-5">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/[0.06] border-2 border-white/[0.10] flex-shrink-0">
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
                              d.className = 'af w-full h-full flex items-center justify-center text-2xl font-black text-white/20 bg-white/[0.04]';
                              d.textContent = (detail.student.student_name || '?').charAt(0).toUpperCase();
                              p.appendChild(d);
                            }
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xl font-black text-white">{detail.student.student_name}</h4>
                        <p className="text-orange-400 font-mono text-sm font-bold mt-0.5">{detail.student.roll_no}</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                          {[
                            { l: 'Father', v: detail.student.father_name },
                            { l: 'Mother', v: detail.student.mother_name },
                            { l: 'Branch', v: detail.student.branch },
                            { l: 'Year', v: detail.student.year },
                          ].map(f => (
                            <div key={f.l}>
                              <span className="text-white/25 text-[11px] uppercase tracking-wider font-black">{f.l}</span>
                              <p className="text-white font-black text-sm mt-0.5">{f.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-center">
                      <div className="text-2xl font-black text-white">{detail.summary.totalPapers}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-1">Total</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                      <div className="text-2xl font-black text-emerald-400">{detail.summary.filled}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500/50 mt-1">Filled</div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 text-center">
                      <div className="text-2xl font-black text-orange-400">{detail.summary.pending}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-orange-500/50 mt-1">Pending</div>
                    </div>
                  </div>

                  {/* Papers table */}
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                      <h5 className="text-xs font-black text-white/30 uppercase tracking-widest">Paper-wise Status</h5>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="px-5 py-3 text-left text-[10px] font-black text-white/25 uppercase tracking-widest w-10">#</th>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-white/25 uppercase tracking-widest">Paper</th>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-white/25 uppercase tracking-widest hidden sm:table-cell">Type</th>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-white/25 uppercase tracking-widest hidden sm:table-cell">Exam</th>
                          <th className="px-5 py-3 text-left text-[10px] font-black text-white/25 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.papers.map((p, i) => (
                          <tr key={i} className="border-b border-white/[0.04] last:border-b-0 hover:bg-orange-500/[0.03] transition-colors duration-150">
                            <td className="px-5 py-3 text-white/25 font-mono text-xs font-bold">{i + 1}</td>
                            <td className="px-5 py-3 text-white/80 text-xs font-bold">{p.paper_name}</td>
                            <td className="px-5 py-3 hidden sm:table-cell">
                              <span className="inline-block bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-0.5 text-[11px] text-white/40 font-bold">{p.paper_type}</span>
                            </td>
                            <td className="px-5 py-3 text-white/35 text-xs font-bold hidden sm:table-cell">{p.exam_type}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-black ${statusPill(p.marks_status)}`}>
                                {p.marks_status || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
