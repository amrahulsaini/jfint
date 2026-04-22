'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ActivityApiRow = Partial<{
  id: string | number;
  email: string | null;
  createdAt: string | null;
  createdAtMs: string | number | null;
  expiresAt: string | null;
  expiresAtMs: string | number | null;
  ipAddress: string | null;
}>;

interface Activity {
  id: string;
  email: string | null;
  createdAt: string | null;
  createdAtMs: number | null;
  expiresAt: string | null;
  expiresAtMs: number | null;
  ipAddress: string | null;
}

function parseTimestampMs(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
  }

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const parsed = new Date(hasZone ? normalized : `${normalized}+05:30`);
  const ms = parsed.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function fmt(ms: number | null, formatter: Intl.DateTimeFormat): string {
  if (ms === null) return '-';
  return `${formatter.format(ms)} (IST)`;
}

function timeAgo(ms: number | null, nowMs: number): string {
  if (ms === null) return '-';
  const seconds = Math.floor((nowMs - ms) / 1000);
  if (seconds < 0) return 'Just now';
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shortId(id: string): string {
  if (!id) return '-';
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const istFormatter = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch('/api/activity');
        const json = await res.json();
        
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load activities.');
        }

        if (mounted) {
          const rows: ActivityApiRow[] = Array.isArray(json.activities) ? json.activities : [];
          const normalized = rows
            .map((row): Activity => {
              const createdAt = typeof row.createdAt === 'string' ? row.createdAt : null;
              const expiresAt = typeof row.expiresAt === 'string' ? row.expiresAt : null;
              return {
                id: String(row.id ?? ''),
                email: typeof row.email === 'string' ? row.email : null,
                createdAt,
                createdAtMs: parseTimestampMs(row.createdAtMs ?? createdAt),
                expiresAt,
                expiresAtMs: parseTimestampMs(row.expiresAtMs ?? expiresAt),
                ipAddress: typeof row.ipAddress === 'string' ? row.ipAddress : null,
              };
            })
            .filter((row) => row.id);

          setActivities(normalized);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load activities.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-[100dvh] ui-aurora text-neutral-900 flex flex-col overflow-hidden">
      <nav className="shrink-0 z-40 bg-white/60 backdrop-blur-2xl border-b border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-[72px]">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 flex items-center justify-center font-black text-lg text-white shadow-[0_8px_16px_-4px_rgba(249,115,22,0.4)] group-hover:scale-105 transition-all duration-300">
              J
            </div>
            <span className="text-xl font-black tracking-tight text-neutral-900 group-hover:text-orange-600 transition-colors duration-300">
              JECRC<span className="text-orange-500">.</span> Activity
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <Link href="/portal" className="text-[10px] sm:text-xs font-black border border-neutral-200 bg-white/80 hover:bg-orange-50 hover:border-orange-300 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 text-neutral-600 hover:text-orange-600 transition-colors shadow-sm">
              Portal
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8 flex-1 w-full ui-rise">
        <header className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 mb-1.5 sm:mb-2">Verification Activity</h1>
          <p className="text-[12px] sm:text-sm font-semibold text-neutral-500 bg-white/50 inline-block px-3 py-1.5 rounded-lg border border-neutral-200/50">Recent logins and OTP verifications.</p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-xs sm:text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && (
          <section className="bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-[20px] sm:rounded-[24px] shadow-sm overflow-hidden mb-6">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-neutral-900">Session Logs</h2>
              <span className="inline-flex text-[10px] sm:text-xs font-black bg-orange-50 border border-orange-200 text-orange-600 rounded-[8px] sm:rounded-[10px] px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-sm">
                {activities.length} record{activities.length === 1 ? '' : 's'}
              </span>
            </div>

            {activities.length === 0 ? (
              <div className="px-5 py-8 text-sm font-semibold text-neutral-500">No activity found.</div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[700px] text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-neutral-50/50">
                      <th className="px-3 sm:px-4 py-3 border-y border-neutral-200 text-left text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-400 rounded-tl-xl">ID</th>
                      <th className="px-3 sm:px-4 py-3 border-y border-neutral-200 text-left text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-400">Email & IP</th>
                      <th className="px-3 sm:px-4 py-3 border-y border-neutral-200 text-left text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-400">Login (IST)</th>
                      <th className="px-3 sm:px-4 py-3 border-y border-neutral-200 text-left text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-400">Expires (IST)</th>
                      <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tr-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {activities.map((row) => {
                      const createdAtMs = row.createdAtMs ?? parseTimestampMs(row.createdAt);
                      const expiresAtMs = row.expiresAtMs ?? parseTimestampMs(row.expiresAt);
                      const isActive = expiresAtMs !== null && expiresAtMs > nowMs;

                      return (
                        <tr key={row.id} className="hover:bg-orange-50/40 transition-colors group">
                          <td className="px-3 sm:px-4 py-3 font-mono text-[9px] sm:text-[10px] font-bold text-neutral-400 group-hover:text-neutral-600 transition-colors">{shortId(row.id)}</td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="font-black text-neutral-900 group-hover:text-orange-600 transition-colors text-[13px] sm:text-sm">{row.email || '-'}</div>
                            <div className="text-[9px] sm:text-[10px] font-bold text-neutral-400 uppercase tracking-tight mt-0.5">{row.ipAddress || 'unknown ip'}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-3">
                            <div className="font-bold text-neutral-700 text-[11px] sm:text-xs leading-tight">{fmt(createdAtMs, istFormatter)}</div>
                            <div className="text-[9px] sm:text-[10px] font-black text-orange-500 uppercase mt-1">{timeAgo(createdAtMs, nowMs)}</div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 font-bold text-neutral-500 text-[10px] sm:text-[11px]">{fmt(expiresAtMs, istFormatter)}</td>
                          <td className="px-3 sm:px-4 py-3">
                            {isActive ? (
                              <span className="inline-flex items-center rounded-[6px] sm:rounded-[8px] border border-emerald-200 bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-black text-emerald-600 shadow-sm">Active</span>
                            ) : (
                              <span className="inline-flex items-center rounded-[6px] sm:rounded-[8px] border border-neutral-200 bg-neutral-100 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-black text-neutral-500 shadow-sm">Expired</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
