'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Activity {
  id: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
}

function fmt(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
    hour12: true,
  });
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
          setActivities(json.activities || []);
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

          <div className="flex items-center gap-2.5">
            <Link href="/portal" className="text-xs font-black border border-neutral-200 bg-white/80 hover:bg-orange-50 hover:border-orange-300 rounded-xl px-4 py-2 text-neutral-600 hover:text-orange-600 transition-colors shadow-sm">
              Portal
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8 flex-1 w-full ui-rise">
        <header className="mb-10">
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 mb-2">Verification Activity</h1>
          <p className="text-sm font-semibold text-neutral-500 bg-white/50 inline-block px-3 py-1.5 rounded-lg border border-neutral-200/50">Recent logins and OTP verifications.</p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-9 h-9 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && (
          <section className="bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-[20px] shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-neutral-900">Session Logs</h2>
              <span className="inline-flex text-xs font-black bg-orange-50 border border-orange-200 text-orange-600 rounded-[10px] px-3 py-1.5 shadow-sm">
                {activities.length} record{activities.length === 1 ? '' : 's'}
              </span>
            </div>
            
            {activities.length === 0 ? (
              <div className="px-5 py-8 text-sm font-semibold text-neutral-500">No activity found.</div>
            ) : (
              <div className="p-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-neutral-50/50">
                      <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tl-xl">Session ID</th>
                      <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Email Verified</th>
                      <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Login Time</th>
                      <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Expires</th>
                      <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">IP Address</th>
                      <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tr-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {activities.map((row) => {
                      const isActive = new Date(row.expiresAt).getTime() > Date.now();
                      return (
                        <tr key={row.id} className="hover:bg-orange-50/40 transition-colors group">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-neutral-500 group-hover:text-neutral-800 transition-colors">{shortId(row.id)}</td>
                          <td className="px-4 py-3 font-black text-neutral-900 group-hover:text-orange-600 transition-colors">{row.email || '-'}</td>
                          <td className="px-4 py-3 font-bold text-neutral-600 text-xs">{fmt(row.createdAt)}</td>
                          <td className="px-4 py-3 font-bold text-neutral-500 text-xs">{fmt(row.expiresAt)}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-500 text-xs">{row.ipAddress || '-'}</td>
                          <td className="px-4 py-3">
                            {isActive ? (
                              <span className="inline-flex items-center rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-600 shadow-sm">Active</span>
                            ) : (
                              <span className="inline-flex items-center rounded-[8px] border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-black text-neutral-500 shadow-sm">Expired</span>
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
