'use client';

import { useState, useEffect, useCallback } from 'react';

interface Student {
  id: number;
  sno: number;
  year: string;
  branch: string;
  paper_name: string;
  paper_type: string;
  roll_no: string;
  exam_type: string;
  student_name: string;
  father_name: string;
  mother_name: string;
  marks_status: string;
}

interface Stats {
  totalRecords: number;
  totalBranches: number;
  totalPapers: number;
  totalStudents: number;
}

interface ApiResponse {
  rows: Student[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  branches: string[];
  stats: Stats;
  error?: string;
}

export default function StudentRecords() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');
  const [searchInput, setSearchInput] = useState('');

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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">S.No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Roll No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Student Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Father Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Paper</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className={`px-4 py-3 ${j === 3 ? 'hidden md:table-cell' : ''} ${j >= 4 && j <= 5 ? 'hidden lg:table-cell' : ''}`}>
                        <div className="h-4 bg-white/5 rounded w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No records found
                  </td>
                </tr>
              ) : (
                data?.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{row.sno}</td>
                    <td className="px-4 py-3 text-blue-400 font-mono text-xs font-medium">{row.roll_no}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{row.student_name}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{row.father_name}</td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                      <span className="inline-block bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs">
                        {row.branch}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell text-xs max-w-[200px] truncate" title={row.paper_name}>
                      {row.paper_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(row.marks_status)}`}>
                        {row.marks_status || '—'}
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
    </section>
  );
}
