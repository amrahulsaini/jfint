'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface SessionLog {
  sessionId: string;
  createdAt: string | null;
  expiresAt: string | null;
  ipAddress: string | null;
  active: boolean;
}

interface PaymentLog {
  plan: string;
  rollNo: string | null;
  amountPaise: number;
  amountRupees: string;
  orderId: string;
  paymentId: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  isCoupon: boolean;
  active: boolean;
}

interface MappedRecord {
  id: string;
  table: string;
  semester: string;
  rollNo: string;
  secondaryRollNo: string | null;
  studentName: string | null;
  branch: string | null;
  mobile: string | null;
  fatherName: string | null;
  motherName: string | null;
  photoUrl: string | null;
  updatedAt: string | null;
}

interface MappingGroup {
  table: string;
  semester: string;
  count: number;
  fieldMap: {
    emailField: string | null;
    primaryRollField: string | null;
    secondaryRollField: string | null;
    nameField: string | null;
    branchField: string | null;
  } | null;
  records: MappedRecord[];
  warning: string | null;
}

interface ProfileResponse {
  email: string;
  totals: {
    sessions: number;
    payments: number;
    firstSemRecords: number;
    thirdSemRecords: number;
  };
  sessions: SessionLog[];
  payments: PaymentLog[];
  mappings: {
    firstSem: MappingGroup;
    thirdSem: MappingGroup;
  };
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

function moneyFromPaise(paise: number): string {
  return `Rs ${Number(paise || 0) / 100}`;
}

function shortSessionId(id: string): string {
  if (!id) return '-';
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function MappingCard({ group }: { group: MappingGroup }) {
  if (group.records.length === 0) return null;

  return (
    <section className="bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-[20px] shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-neutral-900">{group.semester} Mapping</h2>
          <p className="text-xs font-semibold text-neutral-500 mt-0.5">Table: <span className="font-mono text-neutral-700 bg-white border border-neutral-200 px-1.5 py-0.5 rounded">{group.table}</span></p>
        </div>
        <span className="inline-flex text-xs font-black bg-orange-50 border border-orange-200 text-orange-600 rounded-[10px] px-3 py-1.5 self-start sm:self-auto shadow-sm">
          {group.count} record{group.count === 1 ? '' : 's'}
        </span>
      </div>

      {group.fieldMap && (
        <div className="mx-5 mt-5 rounded-[16px] border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Field Mapping
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div className="rounded-[10px] bg-white border border-neutral-200/80 px-3 py-2 shadow-sm"><span className="block font-black text-neutral-400 text-[10px] uppercase tracking-wider mb-0.5">Email</span> <span className="font-bold text-neutral-800">{group.fieldMap.emailField || '-'}</span></div>
            <div className="rounded-[10px] bg-white border border-neutral-200/80 px-3 py-2 shadow-sm"><span className="block font-black text-neutral-400 text-[10px] uppercase tracking-wider mb-0.5">Primary Roll</span> <span className="font-bold text-neutral-800">{group.fieldMap.primaryRollField || '-'}</span></div>
            <div className="rounded-[10px] bg-white border border-neutral-200/80 px-3 py-2 shadow-sm"><span className="block font-black text-neutral-400 text-[10px] uppercase tracking-wider mb-0.5">Secondary Roll</span> <span className="font-bold text-neutral-800">{group.fieldMap.secondaryRollField || '-'}</span></div>
            <div className="rounded-[10px] bg-white border border-neutral-200/80 px-3 py-2 shadow-sm"><span className="block font-black text-neutral-400 text-[10px] uppercase tracking-wider mb-0.5">Name</span> <span className="font-bold text-neutral-800">{group.fieldMap.nameField || '-'}</span></div>
            <div className="rounded-[10px] bg-white border border-neutral-200/80 px-3 py-2 shadow-sm"><span className="block font-black text-neutral-400 text-[10px] uppercase tracking-wider mb-0.5">Branch</span> <span className="font-bold text-neutral-800">{group.fieldMap.branchField || '-'}</span></div>
          </div>
        </div>
      )}

      <div className="p-5 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm border-separate border-spacing-0">
          <thead>
            <tr className="bg-neutral-50/50">
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tl-xl">Photo</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Roll No</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Secondary Roll</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Name</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Branch</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Mobile</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Father</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Mother</th>
              <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tr-xl">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {group.records.map((row) => (
              <tr key={row.id} className="hover:bg-orange-50/40 transition-colors group">
                <td className="px-4 py-3">
                  <div className="relative w-10 h-10 rounded-[12px] overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-200 border border-neutral-200 group-hover:border-orange-300 transition-colors shadow-sm">
                    <span className="absolute inset-0 flex items-center justify-center text-[13px] font-black text-neutral-400">
                      {String(row.studentName || row.rollNo || '?').charAt(0).toUpperCase()}
                    </span>
                    {row.photoUrl && (
                      <Image
                        src={row.photoUrl}
                        alt={row.studentName || row.rollNo || 'student photo'}
                        fill
                        sizes="40px"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-black text-neutral-900 group-hover:text-orange-600 transition-colors">{row.rollNo || '-'}</td>
                <td className="px-4 py-3 font-bold text-neutral-600">{row.secondaryRollNo || '-'}</td>
                <td className="px-4 py-3 font-bold text-neutral-700">{row.studentName || '-'}</td>
                <td className="px-4 py-3 font-bold text-neutral-700"><span className="bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 text-xs">{row.branch || '-'}</span></td>
                <td className="px-4 py-3 font-bold text-neutral-700">{row.mobile || '-'}</td>
                <td className="px-4 py-3 font-bold text-neutral-700">{row.fatherName || '-'}</td>
                <td className="px-4 py-3 font-bold text-neutral-700">{row.motherName || '-'}</td>
                <td className="px-4 py-3 font-bold text-neutral-500 text-xs">{fmt(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [data, setData] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch('/api/profile');
        if (res.status === 401) {
          if (!mounted) return;
          setNeedsVerify(true);
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (!res.ok) {
          throw new Error(String(json?.error || 'Failed to load profile data.'));
        }

        if (!mounted) return;
        setData(json as ProfileResponse);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load profile data.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totalSpent = useMemo(() => {
    if (!data) return 0;
    return data.payments.reduce((sum, p) => sum + (Number(p.amountPaise) || 0), 0);
  }, [data]);

  const hasMappedRecords = useMemo(() => {
    if (!data) return false;
    return (data.mappings.firstSem.count + data.mappings.thirdSem.count) > 0;
  }, [data]);

  const mappedGroups = useMemo(() => {
    if (!data) return [] as MappingGroup[];
    return [data.mappings.thirdSem, data.mappings.firstSem].filter((g) => g.count > 0);
  }, [data]);

  return (
    <div className="min-h-screen ui-aurora text-neutral-900">
      <nav className="sticky top-0 z-40 bg-white/60 backdrop-blur-2xl border-b border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-[72px]">
          <div className="flex items-center gap-3.5 group cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 flex items-center justify-center font-black text-lg text-white shadow-[0_8px_16px_-4px_rgba(249,115,22,0.4)] group-hover:scale-105 group-active:scale-95 transition-all duration-300">
              J
            </div>
            <span className="text-xl font-black tracking-tight text-neutral-900 group-hover:text-orange-600 transition-colors duration-300">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/" className="text-xs font-black border border-neutral-200 bg-white/80 hover:bg-orange-50 hover:border-orange-300 rounded-xl px-4 py-2 text-neutral-600 hover:text-orange-600 transition-colors shadow-sm">
              Chat
            </Link>
            <Link href="/tracking" className="text-xs font-black border border-neutral-200 bg-white/80 hover:bg-orange-50 hover:border-orange-300 rounded-xl px-4 py-2 text-neutral-600 hover:text-orange-600 transition-colors shadow-sm">
              Tracking
            </Link>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.replace('/');
              }}
              className="text-xs font-black border border-neutral-200 bg-white/80 hover:bg-red-50 hover:border-red-300 rounded-xl px-4 py-2 text-neutral-600 hover:text-red-600 transition-colors shadow-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-10 space-y-8 ui-rise">
        <header className="mb-10">
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 mb-2">Profile Dashboard</h1>
          <p className="text-sm font-semibold text-neutral-500 bg-white/50 inline-block px-3 py-1.5 rounded-lg border border-neutral-200/50">Session logs, payment history, and mapped entries for your verified college email.</p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && needsVerify && (
          <div className="border border-orange-200 bg-orange-50 rounded-2xl p-6">
            <h2 className="text-lg font-black text-orange-700">Verification Required</h2>
            <p className="text-sm font-semibold text-orange-700 mt-1">Please verify your @jecrc.ac.in email first. After verification, your profile mapping and logs will appear here.</p>
            <Link href="/verify?from=/profile" className="inline-flex mt-4 items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-black rounded-xl px-4 py-2.5 transition-colors">
              Verify Email
            </Link>
          </div>
        )}

        {!loading && error && (
          <div className="border border-red-200 bg-red-50 rounded-2xl p-5 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            <section className="bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-[20px] shadow-sm p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
                <svg className="w-24 h-24 -mt-6 -mr-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-2 relative z-10">Verified Email</div>
              <div className="text-xl font-black text-neutral-900 break-all relative z-10">{data.email}</div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="rounded-[20px] border border-neutral-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <div className="text-3xl font-black text-neutral-900">{data.totals.sessions}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mt-1.5">Sessions</div>
              </div>
              <div className="rounded-[20px] border border-neutral-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <div className="text-3xl font-black text-neutral-900">{data.totals.payments}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mt-1.5">Payments</div>
              </div>
              <div className="rounded-[20px] border border-neutral-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <div className="text-3xl font-black text-neutral-900">{data.totals.firstSemRecords}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mt-1.5">1st Sem Rows</div>
              </div>
              <div className="rounded-[20px] border border-neutral-200/80 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <div className="text-3xl font-black text-neutral-900">{data.totals.thirdSemRecords}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mt-1.5">3rd Sem Rows</div>
              </div>
              <div className="rounded-[20px] border border-orange-400 bg-gradient-to-br from-orange-500 to-orange-600 p-5 shadow-[0_8px_16px_-4px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_24px_-4px_rgba(249,115,22,0.5)] hover:-translate-y-1 transition-all duration-300 text-white">
                <div className="text-3xl font-black">{moneyFromPaise(totalSpent)}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-orange-200 mt-1.5">Total Spent</div>
              </div>
            </section>

            {hasMappedRecords && (
              <section className="bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-[20px] shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
                <h2 className="text-sm font-black text-neutral-900">Session Logs</h2>
              </div>
              {data.sessions.length === 0 ? (
                <div className="px-5 py-8 text-sm font-semibold text-neutral-500">No session logs found for this email.</div>
              ) : (
                <div className="p-5 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-neutral-50/50">
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tl-xl">Session ID</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Created</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Expires</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">IP Address</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tr-xl">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.sessions.map((row) => (
                        <tr key={row.sessionId} className="hover:bg-orange-50/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-neutral-800">{shortSessionId(row.sessionId)}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-600 text-xs">{fmt(row.createdAt)}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-600 text-xs">{fmt(row.expiresAt)}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-600 text-xs">{row.ipAddress || '-'}</td>
                          <td className="px-4 py-3">
                            {row.active ? (
                              <span className="inline-flex items-center rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-600 shadow-sm">Active</span>
                            ) : (
                              <span className="inline-flex items-center rounded-[8px] border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-black text-neutral-500 shadow-sm">Expired</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </section>
            )}

            {hasMappedRecords && (
              <section className="bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-[20px] shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
                <h2 className="text-sm font-black text-neutral-900">Payment Logs</h2>
              </div>
              {data.payments.length === 0 ? (
                <div className="px-5 py-8 text-sm font-semibold text-neutral-500">No payment logs found for this email.</div>
              ) : (
                <div className="p-5 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-neutral-50/50">
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tl-xl">Plan</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Roll No</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Amount</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Order ID</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Payment ID</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Created</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Expires</th>
                        <th className="px-4 py-3 border-y border-neutral-200 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500 rounded-tr-xl">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.payments.map((row, idx) => (
                        <tr key={`${row.orderId}-${idx}`} className="hover:bg-orange-50/40 transition-colors">
                          <td className="px-4 py-3 font-bold text-neutral-700">{row.isCoupon ? <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">Coupon</span> : row.plan}</td>
                          <td className="px-4 py-3 font-bold text-neutral-700">{row.rollNo || '-'}</td>
                          <td className="px-4 py-3 font-black text-neutral-900">{moneyFromPaise(row.amountPaise)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-500">{row.orderId || '-'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-neutral-500">{row.paymentId || '-'}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-600 text-xs">{fmt(row.createdAt)}</td>
                          <td className="px-4 py-3 font-semibold text-neutral-600 text-xs">{fmt(row.expiresAt)}</td>
                          <td className="px-4 py-3">
                            {row.active ? (
                              <span className="inline-flex items-center rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-600 shadow-sm">Active</span>
                            ) : (
                              <span className="inline-flex items-center rounded-[8px] border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-black text-neutral-500 shadow-sm">Expired</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </section>
            )}

            {!hasMappedRecords && (
              <section className="bg-white/80 backdrop-blur-md border border-neutral-200/80 rounded-[20px] shadow-sm p-8 text-center">
                <svg className="w-12 h-12 text-neutral-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-bold text-neutral-500">
                  No student data found for this email in <span className="font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">2428main.student_emailid</span> or <span className="font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">2528allinfo.student_email</span>.
                </p>
              </section>
            )}

            {mappedGroups.map((group) => (
              <MappingCard key={`${group.table}-${group.semester}`} group={group} />
            ))}
          </>
        )}
      </main>
    </div>
  );
}
