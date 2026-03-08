'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

/* ── Interfaces ─────────────────────────────────────────── */
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
  summary: {
    totalPapers: number;
    filled: number;
    pending: number;
  };
}

/* ── Component ──────────────────────────────────────────── */
export default function StudentRecords() {
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

  /* ── Fetch ─────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (branch) params.set('branch', branch);

      const res = await fetch(`/api/db/students?${params}`);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const statusColor = (s: string) => {
    const l = s?.toLowerCase() || '';
    if (l.includes('filled') || l.includes('complete') || l.includes('submit'))
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (l.includes('not') || l.includes('pending'))
      return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    return 'text-neutral-400 bg-white/5 border-white/10';
  };

  const openDetail = async (rollNo: string) => {
    setShowModal(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/db/student-detail?roll_no=${encodeURIComponent(rollNo)}`);
      const json = await res.json();
      if (!json.error) setDetail(json);
    } catch { /* noop */ }
    setDetailLoading(false);
  };

  /* ── DB not connected placeholder ──────────────────────── */
  if (error && !data) {
    return (
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold">Student Results</h2>
          <p className="mt-2 text-sm text-neutral-500">Live data from the marks entry database</p>
        </div>
        <div className="bg-neutral-950 border border-white/[0.08] rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Database Not Connected</h3>
          <p className="text-sm text-neutral-500 max-w-md mx-auto">
            Student results will appear once the SQL data is imported into the database.
          </p>
        </div>
      </div>
    );
  }

  /* ── Main render ───────────────────────────────────────── */
  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-16">
      {/* Section Header */}
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold">Student Results</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Browse and search {data?.stats ? <span className="text-orange-400 font-semibold">{data.stats.totalStudents.toLocaleString()}</span> : '…'} students across all branches
        </p>
      </div>

      {/* ─── Stats Row ─────────────────────────────────────── */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Records', value: data.stats.totalRecords, accent: false },
            { label: 'Branches', value: data.stats.totalBranches, accent: false },
            { label: 'Papers', value: data.stats.totalPapers, accent: false },
            { label: 'Students', value: data.stats.totalStudents, accent: true },
          ].map(s => (
            <div
              key={s.label}
              className={`relative overflow-hidden rounded-2xl border p-5 text-center transition-all ${
                s.accent
                  ? 'bg-orange-500/[0.06] border-orange-500/20'
                  : 'bg-neutral-950 border-white/[0.08]'
              }`}
            >
              <div className={`text-3xl font-black ${s.accent ? 'text-orange-400' : 'text-white'}`}>
                {s.value.toLocaleString()}
              </div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-neutral-500 mt-1.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Filters ───────────────────────────────────────── */}
      <div className="bg-neutral-950 border border-white/[0.08] rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by name or roll number…"
                className="w-full bg-black border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-orange-500/20"
            >
              Search
            </button>
          </form>

          {/* Branch filter */}
          <div className="relative">
            <select
              value={branch}
              onChange={e => { setBranch(e.target.value); setPage(1); }}
              className="appearance-none bg-black border border-white/[0.08] rounded-xl pl-4 pr-9 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 transition-all cursor-pointer min-w-[160px]"
            >
              <option value="" className="bg-black">All Branches</option>
              {data?.branches.map(b => (
                <option key={b} value={b} className="bg-black">{b}</option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Active filters */}
        {(search || branch) && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.05]">
            {search && (
              <span className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1 text-xs font-medium text-orange-400">
                &ldquo;{search}&rdquo;
                <button onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }} className="hover:text-white transition-colors">×</button>
              </span>
            )}
            {branch && (
              <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs font-medium text-neutral-300">
                {branch}
                <button onClick={() => { setBranch(''); setPage(1); }} className="hover:text-white transition-colors">×</button>
              </span>
            )}
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setBranch(''); setPage(1); }}
              className="text-xs text-neutral-500 hover:text-orange-400 transition-colors ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ─── Table Card ────────────────────────────────────── */}
      <div className="bg-neutral-950 border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-widest w-12">#</th>
                <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-widest w-16"></th>
                <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Roll No</th>
                <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Student Name</th>
                <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-widest hidden md:table-cell">Father Name</th>
                <th className="px-5 py-4 text-left text-[11px] font-bold text-neutral-500 uppercase tracking-widest hidden lg:table-cell">Branch</th>
                <th className="px-5 py-4 text-center text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Papers</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04] animate-pulse">
                    <td className="px-5 py-4"><div className="h-3.5 bg-white/[0.04] rounded-full w-6" /></td>
                    <td className="px-5 py-3"><div className="w-10 h-10 bg-white/[0.04] rounded-full" /></td>
                    <td className="px-5 py-4"><div className="h-3.5 bg-white/[0.04] rounded-full w-24" /></td>
                    <td className="px-5 py-4"><div className="h-3.5 bg-white/[0.04] rounded-full w-32" /></td>
                    <td className="px-5 py-4 hidden md:table-cell"><div className="h-3.5 bg-white/[0.04] rounded-full w-28" /></td>
                    <td className="px-5 py-4 hidden lg:table-cell"><div className="h-3.5 bg-white/[0.04] rounded-full w-16" /></td>
                    <td className="px-5 py-4"><div className="h-6 bg-white/[0.04] rounded-full w-8 mx-auto" /></td>
                  </tr>
                ))
              ) : data?.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-neutral-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-neutral-500 text-sm font-medium">No students found</span>
                      <span className="text-neutral-600 text-xs mt-1">Try adjusting your search or filters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.rows.map((row, idx) => (
                  <tr
                    key={row.roll_no}
                    onClick={() => openDetail(row.roll_no)}
                    className="border-b border-white/[0.04] hover:bg-orange-500/[0.03] transition-all cursor-pointer group"
                  >
                    <td className="px-5 py-3.5 text-neutral-600 font-mono text-xs">
                      {(page - 1) * LIMIT + idx + 1}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-900 border-2 border-white/[0.06] group-hover:border-orange-500/30 transition-all flex-shrink-0 shadow-sm">
                        <Image
                          src={`/student_photos/photo_${row.roll_no}.jpg`}
                          alt={row.student_name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.avatar-fallback')) {
                              const fb = document.createElement('div');
                              fb.className = 'avatar-fallback w-full h-full flex items-center justify-center text-xs font-bold text-neutral-500 bg-neutral-900';
                              fb.textContent = (row.student_name || '?').charAt(0).toUpperCase();
                              parent.appendChild(fb);
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-orange-400/80 group-hover:text-orange-400 transition-colors">
                      {row.roll_no}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-neutral-200 group-hover:text-white transition-colors">
                      {row.student_name}
                    </td>
                    <td className="px-5 py-3.5 text-neutral-500 hidden md:table-cell">
                      {row.father_name}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="inline-block bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[11px] font-medium text-neutral-400">
                        {row.branch}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-7 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold px-2">
                        {row.paper_count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination ──────────────────────────────────── */}
        {data && data.totalPages > 1 && (
          <div className="border-t border-white/[0.06] px-5 py-3.5 flex items-center justify-between">
            <span className="text-xs text-neutral-600">
              {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} of{' '}
              <span className="text-neutral-400 font-medium">{data.total.toLocaleString()}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-neutral-500 hover:text-white hover:border-orange-500/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs"
                title="First"
              >
                ««
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-neutral-500 hover:text-white hover:border-orange-500/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs"
              >
                ‹
              </button>

              {/* Page numbers */}
              {(() => {
                const pages: number[] = [];
                const total = data.totalPages;
                let start = Math.max(1, page - 2);
                const end = Math.min(total, start + 4);
                start = Math.max(1, end - 4);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      p === page
                        ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                        : 'bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-white hover:border-orange-500/30'
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-neutral-500 hover:text-white hover:border-orange-500/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs"
              >
                ›
              </button>
              <button
                onClick={() => setPage(data.totalPages)}
                disabled={page >= data.totalPages}
                className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-neutral-500 hover:text-white hover:border-orange-500/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-xs"
                title="Last"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Modal ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowModal(false)} />

          <div className="relative bg-neutral-950 border border-white/[0.08] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl shadow-black/50">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-base font-bold text-white">Student Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-neutral-500 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-57px)]">
              {detailLoading ? (
                <div className="flex flex-col items-center py-16">
                  <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mb-4" />
                  <span className="text-sm text-neutral-500">Loading…</span>
                </div>
              ) : !detail ? (
                <div className="text-center py-16 text-neutral-600">
                  Failed to load student details.
                </div>
              ) : (
                <div className="p-6">
                  {/* ── Profile Card ─────────────────────────── */}
                  <div className="bg-black border border-white/[0.06] rounded-2xl p-5 mb-6">
                    <div className="flex items-start gap-5">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-neutral-900 border-2 border-white/[0.08] flex-shrink-0 shadow-lg">
                        <Image
                          src={`/student_photos/photo_${detail.student.roll_no}.jpg`}
                          alt={detail.student.student_name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.avatar-fallback')) {
                              const fb = document.createElement('div');
                              fb.className = 'avatar-fallback w-full h-full flex items-center justify-center text-2xl font-bold text-neutral-500 bg-neutral-900';
                              fb.textContent = (detail.student.student_name || '?').charAt(0).toUpperCase();
                              parent.appendChild(fb);
                            }
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xl font-black text-white leading-tight">{detail.student.student_name}</h4>
                        <p className="text-orange-400 font-mono text-sm font-bold mt-0.5">{detail.student.roll_no}</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
                          <div>
                            <span className="text-neutral-600 text-xs uppercase tracking-wider font-medium">Father</span>
                            <p className="text-neutral-300 font-medium">{detail.student.father_name}</p>
                          </div>
                          <div>
                            <span className="text-neutral-600 text-xs uppercase tracking-wider font-medium">Mother</span>
                            <p className="text-neutral-300 font-medium">{detail.student.mother_name}</p>
                          </div>
                          <div>
                            <span className="text-neutral-600 text-xs uppercase tracking-wider font-medium">Branch</span>
                            <p className="text-neutral-300 font-medium">{detail.student.branch}</p>
                          </div>
                          <div>
                            <span className="text-neutral-600 text-xs uppercase tracking-wider font-medium">Year</span>
                            <p className="text-neutral-300 font-medium">{detail.student.year}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Summary Cards ────────────────────────── */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="bg-black border border-white/[0.06] rounded-xl px-4 py-3 text-center">
                      <div className="text-2xl font-black text-white">{detail.summary.totalPapers}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-1">Total</div>
                    </div>
                    <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl px-4 py-3 text-center">
                      <div className="text-2xl font-black text-emerald-400">{detail.summary.filled}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mt-1">Filled</div>
                    </div>
                    <div className="bg-orange-500/[0.05] border border-orange-500/20 rounded-xl px-4 py-3 text-center">
                      <div className="text-2xl font-black text-orange-400">{detail.summary.pending}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-orange-500/60 mt-1">Pending</div>
                    </div>
                  </div>

                  {/* ── Papers Table ─────────────────────────── */}
                  <div className="bg-black border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.06]">
                      <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Paper-wise Status</h5>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.04]">
                          <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest w-10">#</th>
                          <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Paper</th>
                          <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest hidden sm:table-cell">Type</th>
                          <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest hidden sm:table-cell">Exam</th>
                          <th className="px-5 py-3 text-left text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.papers.map((p, i) => (
                          <tr key={i} className="border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3 text-neutral-600 font-mono text-xs">{i + 1}</td>
                            <td className="px-5 py-3 text-neutral-200 text-xs font-medium">{p.paper_name}</td>
                            <td className="px-5 py-3 hidden sm:table-cell">
                              <span className="inline-block bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-0.5 text-[11px] text-neutral-400">
                                {p.paper_type}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-neutral-500 text-xs hidden sm:table-cell">{p.exam_type}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusColor(p.marks_status)}`}>
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
