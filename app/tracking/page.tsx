'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Payment {
  plan: string;
  rollNo: string | null;
  amountPaise: number;
  amountRupees: string;
  orderId: string;
  paymentId: string | null;
  expiresAt: string | null;
  createdAt: string;
  isCoupon: boolean;
}

interface TrackingData {
  sessionId: string;
  email: string | null;
  loginAt: string | null;
  sessionExpiresAt: string | null;
  ipAddress: string | null;
  payments: Payment[];
  totalSpent: number;
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
    hour12: true,
  });
}

function timeLeft(iso: string | null, nowMs: number): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - nowMs;
  if (diff <= 0) return 'Expired';
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m left`;
  }
  return `${m}m ${s}s left`;
}

export default function TrackingPage() {
  const router = useRouter();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    fetch('/api/tracking')
      .then(r => {
        if (r.status === 401) {
          setNeedsVerify(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        if (d?.error) setError(d.error);
        else if (d) setData(d);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load. Please refresh.'); setLoading(false); });
  }, [router]);

  // Live countdown tick
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const singlePays = data?.payments.filter(p => p.plan === 'single') ?? [];
  const allPays = data?.payments.filter(p => p.plan === 'all') ?? [];

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-neutral-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-orange-500/30">
              J
            </div>
            <span className="text-lg font-black tracking-tight text-neutral-900">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-orange-50 border border-neutral-200 hover:border-orange-300 text-neutral-500 hover:text-orange-600 text-xs font-black px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              ← Portal
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-orange-50 border border-neutral-200 hover:border-orange-300 text-neutral-500 hover:text-orange-600 text-xs font-black px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              Chat
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-orange-50 border border-neutral-200 hover:border-orange-300 text-neutral-500 hover:text-orange-600 text-xs font-black px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              Profile
            </Link>
            <button
              onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.replace('/portal'); }}
              className="flex items-center gap-1.5 bg-neutral-100 hover:bg-red-50 border border-neutral-200 hover:border-red-300 text-neutral-500 hover:text-red-600 text-xs font-black px-3 py-1.5 rounded-xl transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">Session Tracking</h1>
          <p className="text-sm text-neutral-400 mt-1 font-medium">Your session details and payment history</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-600 font-semibold text-sm">
            {error}
          </div>
        )}

        {needsVerify && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
            <h2 className="text-lg font-black text-orange-700">Session Expired</h2>
            <p className="text-sm text-orange-700 font-semibold mt-1">Verify your email again to view tracking logs.</p>
            <Link
              href="/verify?from=/tracking"
              className="inline-flex mt-4 bg-orange-500 hover:bg-orange-400 text-white text-sm font-black px-4 py-2 rounded-xl transition-colors"
            >
              Verify Email
            </Link>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-6">

            {/* ── Session info card ── */}
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-neutral-200 px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-500 text-sm">
                  🔐
                </div>
                <div>
                  <h2 className="font-black text-neutral-900 text-sm">Active Session</h2>
                  <p className="text-xs text-neutral-400 font-medium">Session ID: {data.sessionId}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-neutral-100">
                <div className="px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Email</p>
                  <p className="text-sm font-bold text-neutral-800 truncate">{data.email ?? '—'}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Logged In</p>
                  <p className="text-sm font-bold text-neutral-800">{fmt(data.loginAt)}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Session Expires</p>
                  <p className="text-sm font-bold text-neutral-800">{fmt(data.sessionExpiresAt)}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Time Left</p>
                  {/* tick dep forces re-render every second */}
                  <p className={`text-sm font-black tabular-nums ${
                    data.sessionExpiresAt && (new Date(data.sessionExpiresAt).getTime() - nowMs) < 120000
                      ? 'text-red-500'
                      : 'text-orange-500'
                  }`} key={tick}>{timeLeft(data.sessionExpiresAt, nowMs)}</p>
                </div>
              </div>
            </div>

            {/* ── Stats row ── */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Spent', value: `₹${(data.totalSpent / 100).toFixed(2)}`, icon: '💰' },
                { label: 'Results Unlocked', value: String(singlePays.length), icon: '🔓' },
                { label: 'All-Access Plans', value: String(allPays.length), icon: '⚡' },
              ].map(stat => (
                <div key={stat.label} className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 shadow-sm">
                  <div className="text-xl mb-1">{stat.icon}</div>
                  <p className="text-2xl font-black text-neutral-900">{stat.value}</p>
                  <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* ── All-Access plans ── */}
            {allPays.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-neutral-100 px-6 py-4">
                  <h2 className="font-black text-neutral-900 text-sm">All-Access Plans</h2>
                  <p className="text-xs text-neutral-400 font-medium mt-0.5">Unlocks all student results for 72 hours</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Type</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Amount</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Purchased</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Expires</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {allPays.map((p, i) => {
                        const expired = p.expiresAt ? new Date(p.expiresAt) < new Date() : false;
                        return (
                          <tr key={i} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-5 py-3.5">
                              {p.isCoupon ? (
                                <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[11px] font-black px-2 py-0.5 rounded-lg">
                                  🎁 Coupon
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-black px-2 py-0.5 rounded-lg">
                                  ⚡ All Access
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-neutral-900">
                              {p.amountPaise === 0 ? <span className="text-green-600">FREE</span> : `₹${p.amountRupees}`}
                            </td>
                            <td className="px-5 py-3.5 text-neutral-500 font-medium">{fmt(p.createdAt)}</td>
                            <td className="px-5 py-3.5 text-neutral-500 font-medium">{fmt(p.expiresAt)}</td>
                            <td className="px-5 py-3.5">
                              {expired ? (
                                <span className="inline-flex items-center gap-1 bg-neutral-100 border border-neutral-200 text-neutral-500 text-[11px] font-black px-2 py-0.5 rounded-lg">
                                  Expired
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[11px] font-black px-2 py-0.5 rounded-lg" key={tick}>
                                  ✓ {timeLeft(p.expiresAt, nowMs)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Individual results ── */}
            {singlePays.length > 0 ? (
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-neutral-100 px-6 py-4">
                  <h2 className="font-black text-neutral-900 text-sm">Unlocked Results</h2>
                  <p className="text-xs text-neutral-400 font-medium mt-0.5">{singlePays.length} individual result{singlePays.length > 1 ? 's' : ''} unlocked</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">#</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Roll No.</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Amount Paid</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Unlocked At</th>
                        <th className="text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest text-neutral-400">Payment ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {singlePays.map((p, i) => (
                        <tr key={i} className="hover:bg-orange-50/30 transition-colors">
                          <td className="px-5 py-3.5 text-neutral-400 font-bold">{i + 1}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-800 text-xs font-black px-2.5 py-1 rounded-lg font-mono">
                              🔓 {p.rollNo ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-neutral-900">₹{p.amountRupees}</td>
                          <td className="px-5 py-3.5 text-neutral-500 font-medium">{fmt(p.createdAt)}</td>
                          <td className="px-5 py-3.5 text-neutral-400 font-mono text-[11px]">
                            {p.paymentId ? p.paymentId.slice(0, 20) + '…' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl px-6 py-10 text-center">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-sm font-bold text-neutral-500">No results unlocked yet</p>
                <p className="text-xs text-neutral-400 mt-1">Purchase access to individual results or an all-access plan from the portal.</p>
                <Link
                  href="/"
                  className="inline-block mt-4 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors"
                >
                  Go to Portal →
                </Link>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
