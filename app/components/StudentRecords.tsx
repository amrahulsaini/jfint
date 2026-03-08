'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (branch) params.set('branch', branch);

      const res = await fetch(`/api/db/students?${params}`);
      const json: ApiResponse = await res.json();

      if (json.error) {
        setError(json.error);
        setData(null);
      } else {
        setError('');
        setData(json);
      }
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
    const lower = s?.toLowerCase() || '';
    if (lower.includes('filled') || lower.includes('complete') || lower.includes('submit'))
      return 'text-green-400 bg-green-400/10';
    if (lower.includes('not') || lower.includes('pending'))
      return 'text-amber-400 bg-amber-400/10';
    return 'text-slate-300 bg-white/5';
  };

  const openDetail = async (rollNo: string) => {
    setShowModal(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/db/student-detail?roll_no=${encodeURIComponent(rollNo)}`);
      const json = await res.json();
      if (json.error) {
        setDetail(null);
      } else {
        setDetail(json);
      }
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  };

  // Show placeholder if DB not connected yet
  if (error && !data) {
    return (
      <section id="records" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">Student Records</h2>
          <p className="mt-3 text-slate-400">
            Live data from the marks entry database
          </p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">Database Not Connected</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            The student records database will be available once the SQL export data is imported.
            Run the SQL file to populate the <code className="text-amber-400/80 bg-white/5 px-1.5 py-0.5 rounded text-xs">jecr_2ndyear</code> table.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="records" className="max-w-7xl mx-auto px-6 py-20">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold">Student Records</h2>
        <p className="mt-3 text-slate-400">
          Live data from the marks entry database
        </p>
      </div>

      {/* Stats Cards */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Records', value: data.stats.totalRecords, icon: '📊' },
            { label: 'Branches', value: data.stats.totalBranches, icon: '🏛️' },
            { label: 'Papers', value: data.stats.totalPapers, icon: '📝' },
            { label: 'Students', value: data.stats.totalStudents, icon: '🎓' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-white">{s.value.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or roll no…"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Search
          </button>
        </form>
        <select
          value={branch}
          onChange={e => { setBranch(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-900">All Branches</option>
          {data?.branches.map(b => (
            <option key={b} value={b} className="bg-slate-900">{b}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Photo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Roll No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Student Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Father Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Branch</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Papers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-white/5 rounded w-8" /></td>
                    <td className="px-4 py-3"><div className="w-10 h-10 bg-white/5 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-white/5 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-white/5 rounded w-32" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-white/5 rounded w-28" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-white/5 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-white/5 rounded w-8 mx-auto" /></td>
                  </tr>
                ))
              ) : data?.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No records found
                  </td>
                </tr>
              ) : (
                data?.rows.map((row, idx) => (
                  <tr
                    key={row.roll_no}
                    onClick={() => openDetail(row.roll_no)}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {(page - 1) * (data?.limit || 15) + idx + 1}
                    </td>
                    <td className="px-4 py-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 flex-shrink-0 group-hover:border-blue-500/40 transition-colors">
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
                              const fallback = document.createElement('div');
                              fallback.className = 'avatar-fallback w-full h-full flex items-center justify-center text-xs font-bold text-slate-400';
                              fallback.textContent = (row.student_name || '?').charAt(0).toUpperCase();
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-blue-400 font-mono text-xs font-medium group-hover:text-blue-300">{row.roll_no}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium group-hover:text-white">{row.student_name}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{row.father_name}</td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                      <span className="inline-block bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs">
                        {row.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                        {row.paper_count}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between bg-white/[0.01]">
            <span className="text-xs text-slate-500">
              Showing {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} of {data.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
              <h3 className="text-lg font-semibold text-white">Student Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-6">
              {detailLoading ? (
                <div className="flex flex-col items-center py-12">
                  <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                  <span className="text-sm text-slate-400">Loading student data…</span>
                </div>
              ) : !detail ? (
                <div className="text-center py-12 text-slate-500">
                  Failed to load student details.
                </div>
              ) : (
                <>
                  {/* Student Profile */}
                  <div className="flex items-start gap-5 mb-8">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
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
                            const fallback = document.createElement('div');
                            fallback.className = 'avatar-fallback w-full h-full flex items-center justify-center text-2xl font-bold text-slate-400';
                            fallback.textContent = (detail.student.student_name || '?').charAt(0).toUpperCase();
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xl font-bold text-white">{detail.student.student_name}</h4>
                      <p className="text-blue-400 font-mono text-sm mt-0.5">{detail.student.roll_no}</p>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
                        <div>
                          <span className="text-slate-500">Father:</span>{' '}
                          <span className="text-slate-300">{detail.student.father_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Mother:</span>{' '}
                          <span className="text-slate-300">{detail.student.mother_name}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm">
                        <div>
                          <span className="text-slate-500">Branch:</span>{' '}
                          <span className="text-slate-300">{detail.student.branch}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Year:</span>{' '}
                          <span className="text-slate-300">{detail.student.year}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Pills */}
                  <div className="flex gap-3 mb-6">
                    <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-center">
                      <div className="text-xl font-bold text-white">{detail.summary.totalPapers}</div>
                      <div className="text-xs text-slate-500">Total Papers</div>
                    </div>
                    <div className="flex-1 bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 text-center">
                      <div className="text-xl font-bold text-green-400">{detail.summary.filled}</div>
                      <div className="text-xs text-green-500/70">Marks Filled</div>
                    </div>
                    <div className="flex-1 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
                      <div className="text-xl font-bold text-amber-400">{detail.summary.pending}</div>
                      <div className="text-xs text-amber-500/70">Pending</div>
                    </div>
                  </div>

                  {/* Papers Table */}
                  <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03]">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Paper Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Type</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Exam</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {detail.papers.map((p, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{i + 1}</td>
                            <td className="px-4 py-2.5 text-slate-200 text-xs">{p.paper_name}</td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell">
                              <span className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                                {p.paper_type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs hidden sm:table-cell">{p.exam_type}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(p.marks_status)}`}>
                                {p.marks_status || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
