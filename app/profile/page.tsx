'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  return (
    <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-neutral-900">{group.semester} Mapping</h2>
          <p className="text-xs font-semibold text-neutral-500">Table: {group.table}</p>
        </div>
        <span className="text-xs font-black bg-orange-50 border border-orange-200 text-orange-600 rounded-lg px-2.5 py-1">
          {group.count} record{group.count === 1 ? '' : 's'}
        </span>
      </div>

      {group.warning && (
        <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {group.warning}
        </div>
      )}

      {group.fieldMap && (
        <div className="mx-5 mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2">Field Mapping</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
            <div className="rounded-lg bg-white border border-neutral-200 px-2 py-1.5"><span className="font-black text-neutral-400">email:</span> <span className="font-semibold text-neutral-700">{group.fieldMap.emailField || '-'}</span></div>
            <div className="rounded-lg bg-white border border-neutral-200 px-2 py-1.5"><span className="font-black text-neutral-400">primary roll:</span> <span className="font-semibold text-neutral-700">{group.fieldMap.primaryRollField || '-'}</span></div>
            <div className="rounded-lg bg-white border border-neutral-200 px-2 py-1.5"><span className="font-black text-neutral-400">secondary roll:</span> <span className="font-semibold text-neutral-700">{group.fieldMap.secondaryRollField || '-'}</span></div>
            <div className="rounded-lg bg-white border border-neutral-200 px-2 py-1.5"><span className="font-black text-neutral-400">name:</span> <span className="font-semibold text-neutral-700">{group.fieldMap.nameField || '-'}</span></div>
            <div className="rounded-lg bg-white border border-neutral-200 px-2 py-1.5"><span className="font-black text-neutral-400">branch:</span> <span className="font-semibold text-neutral-700">{group.fieldMap.branchField || '-'}</span></div>
          </div>
        </div>
      )}

      {group.records.length === 0 ? (
        <div className="px-5 py-8 text-sm font-semibold text-neutral-500">No mapped rows found for this email.</div>
      ) : (
        <div className="p-5 overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="bg-neutral-50 border-y border-neutral-200">
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Roll No</th>
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Secondary Roll</th>
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Name</th>
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Branch</th>
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Mobile</th>
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Father</th>
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Mother</th>
                <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {group.records.map((row) => (
                <tr key={row.id} className="hover:bg-orange-50/40 transition-colors">
                  <td className="px-3 py-2.5 font-black text-neutral-900">{row.rollNo || '-'}</td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-600">{row.secondaryRollNo || '-'}</td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-700">{row.studentName || '-'}</td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-700">{row.branch || '-'}</td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-700">{row.mobile || '-'}</td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-700">{row.fatherName || '-'}</td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-700">{row.motherName || '-'}</td>
                  <td className="px-3 py-2.5 font-semibold text-neutral-500">{fmt(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-neutral-200">
        <div className="max-w-6xl mx-auto h-16 px-5 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-orange-500/30">
              J
            </div>
            <span className="text-lg font-black tracking-tight text-neutral-900">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/portal" className="text-xs font-black border border-neutral-200 bg-neutral-100 hover:bg-orange-50 hover:border-orange-300 rounded-xl px-3 py-1.5 text-neutral-600 hover:text-orange-600 transition-colors">
              Portal
            </Link>
            <Link href="/tracking" className="text-xs font-black border border-neutral-200 bg-neutral-100 hover:bg-orange-50 hover:border-orange-300 rounded-xl px-3 py-1.5 text-neutral-600 hover:text-orange-600 transition-colors">
              Tracking
            </Link>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.replace('/portal');
              }}
              className="text-xs font-black border border-neutral-200 bg-neutral-100 hover:bg-red-50 hover:border-red-300 rounded-xl px-3 py-1.5 text-neutral-600 hover:text-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">Profile</h1>
          <p className="text-sm font-semibold text-neutral-500 mt-1">Session logs, payment history, and mapped entries for your verified college email.</p>
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
            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-5">
              <div className="text-[11px] font-black uppercase tracking-widest text-neutral-500">Verified Email</div>
              <div className="text-lg font-black text-neutral-900 mt-1 break-all">{data.email}</div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-2xl font-black text-neutral-900">{data.totals.sessions}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Sessions</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-2xl font-black text-neutral-900">{data.totals.payments}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Payments</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-2xl font-black text-neutral-900">{data.totals.firstSemRecords}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">1st Sem Rows</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-2xl font-black text-neutral-900">{data.totals.thirdSemRecords}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">3rd Sem Rows</div>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="text-2xl font-black text-orange-600">{moneyFromPaise(totalSpent)}</div>
                <div className="text-[11px] font-black uppercase tracking-wider text-orange-600">Total Spent</div>
              </div>
            </section>

            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                <h2 className="text-sm font-black text-neutral-900">Session Logs</h2>
              </div>
              {data.sessions.length === 0 ? (
                <div className="px-5 py-8 text-sm font-semibold text-neutral-500">No session logs found for this email.</div>
              ) : (
                <div className="p-5 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="bg-neutral-50 border-y border-neutral-200">
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Session ID</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Created</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Expires</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">IP Address</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.sessions.map((row) => (
                        <tr key={row.sessionId} className="hover:bg-orange-50/40 transition-colors">
                          <td className="px-3 py-2.5 font-mono text-xs font-bold text-neutral-800">{shortSessionId(row.sessionId)}</td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-600">{fmt(row.createdAt)}</td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-600">{fmt(row.expiresAt)}</td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-600">{row.ipAddress || '-'}</td>
                          <td className="px-3 py-2.5">
                            {row.active ? (
                              <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">Active</span>
                            ) : (
                              <span className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-black text-neutral-600">Expired</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                <h2 className="text-sm font-black text-neutral-900">Payment Logs</h2>
              </div>
              {data.payments.length === 0 ? (
                <div className="px-5 py-8 text-sm font-semibold text-neutral-500">No payment logs found for this email.</div>
              ) : (
                <div className="p-5 overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="bg-neutral-50 border-y border-neutral-200">
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Plan</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Roll No</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Amount</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Order ID</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Payment ID</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Created</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Expires</th>
                        <th className="px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-neutral-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.payments.map((row, idx) => (
                        <tr key={`${row.orderId}-${idx}`} className="hover:bg-orange-50/40 transition-colors">
                          <td className="px-3 py-2.5 font-semibold text-neutral-700">{row.isCoupon ? 'coupon' : row.plan}</td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-700">{row.rollNo || '-'}</td>
                          <td className="px-3 py-2.5 font-black text-neutral-900">{moneyFromPaise(row.amountPaise)}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-neutral-600">{row.orderId || '-'}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-neutral-600">{row.paymentId || '-'}</td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-600">{fmt(row.createdAt)}</td>
                          <td className="px-3 py-2.5 font-semibold text-neutral-600">{fmt(row.expiresAt)}</td>
                          <td className="px-3 py-2.5">
                            {row.active ? (
                              <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">Active</span>
                            ) : (
                              <span className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-black text-neutral-600">Expired</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <MappingCard group={data.mappings.firstSem} />
            <MappingCard group={data.mappings.thirdSem} />
          </>
        )}
      </main>
    </div>
  );
}
