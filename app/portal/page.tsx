'use client';

import Link from 'next/link';
import { useState } from 'react';
import TopTicker from '@/app/components/TopTicker';
import {
  LEGACY_RESULTS_PORTAL_PATH,
  MAIN_CHAT_PATH,
  SITE_CONTACT_EMAIL,
} from '@/lib/site-config';

export default function PortalPage() {
  const [showDialog, setShowDialog] = useState(true);

  return (
    <div className="min-h-[100dvh] ui-aurora text-neutral-900">
      <TopTicker />

      {showDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-neutral-950/50 p-3 backdrop-blur-md">
          <div className="w-full max-w-xl overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)]">
            <div className="bg-[linear-gradient(140deg,#f97316,#fb923c)] px-6 py-5 text-white">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-50">
                Temporary Dialog
              </div>
              <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em]">
                Marks and info are hidden for now.
              </h2>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-sm font-semibold leading-6 text-neutral-700">
                If anyone wants to see anything, kindly drop a mail to <span className="font-black text-neutral-950">{SITE_CONTACT_EMAIL}</span> or place a request in the main chat room.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href={MAIN_CHAT_PATH}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-black text-white transition-colors hover:bg-neutral-800"
                >
                  Open Main Chat
                </Link>
                <button
                  onClick={() => setShowDialog(false)}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm font-black text-neutral-700 transition-colors hover:border-orange-300 hover:text-orange-600"
                >
                  Keep Browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="sticky top-[34px] z-40 border-b border-white/60 bg-white/80 shadow-[0_16px_36px_-26px_rgba(15,23,42,0.5)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={MAIN_CHAT_PATH} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 font-black text-lg text-white shadow-[0_16px_36px_-18px_rgba(249,115,22,0.85)]">
              J
            </div>
            <div>
              <div className="font-display text-lg font-black tracking-[-0.04em] text-neutral-950 sm:text-xl">
                JECRC<span className="text-orange-500">.</span> Portal
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400">
                Temporary Hold Page
              </div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={MAIN_CHAT_PATH}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-700 transition-colors hover:border-orange-300 hover:text-orange-600"
            >
              Main Chat
            </Link>
            <Link
              href={LEGACY_RESULTS_PORTAL_PATH}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 text-xs font-black text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100"
            >
              Full Results
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="ui-rise overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(140deg,rgba(255,255,255,0.88),rgba(255,255,255,0.68))] shadow-[0_26px_90px_-42px_rgba(15,23,42,0.42)] backdrop-blur-xl">
          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.1fr)_340px] xl:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-orange-700">
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500" />
                Portal temporarily restricted
              </div>
              <div className="space-y-3">
                <h1 className="font-display text-3xl font-black tracking-[-0.05em] text-neutral-950 sm:text-4xl lg:text-[3.1rem]">
                  Results stay separated here, but public marks and info are paused for now.
                </h1>
                <p className="max-w-3xl text-sm font-semibold leading-7 text-neutral-600 sm:text-base">
                  The main website now focuses on the chat experience. This portal is acting as the controlled access point while sensitive student details stay hidden from open browsing.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Main Website</div>
                  <div className="mt-2 text-lg font-black text-neutral-950">Live Chat</div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">Requests and support now open on the homepage.</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Temporary State</div>
                  <div className="mt-2 text-lg font-black text-amber-900">Marks Hidden</div>
                  <p className="mt-1 text-xs font-semibold text-amber-800">Sensitive data is not publicly listed right now.</p>
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Full Route</div>
                  <div className="mt-2 text-lg font-black text-sky-900">/portal/full</div>
                  <p className="mt-1 text-xs font-semibold text-sky-800">That is where the complete old website view now lives.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[28px] border border-neutral-200/80 bg-white/90 p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Contact Path</div>
                <h2 className="mt-1 font-display text-xl font-black tracking-[-0.04em] text-neutral-950">
                  Ask for access by mail or in chat.
                </h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
                  Mail <span className="font-black text-neutral-950">{SITE_CONTACT_EMAIL}</span> or request directly in the live chat if someone needs hidden marks or detailed info.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <a
                    href={`mailto:${SITE_CONTACT_EMAIL}`}
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-black text-white transition-colors hover:bg-neutral-800"
                  >
                    Mail Support
                  </a>
                  <Link
                    href={MAIN_CHAT_PATH}
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm font-black text-neutral-700 transition-colors hover:border-orange-300 hover:text-orange-600"
                  >
                    Open Main Chat
                  </Link>
                </div>
              </div>

              <div className="rounded-[28px] border border-sky-200 bg-sky-50/80 p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Need The Whole Website</div>
                <p className="mt-2 text-sm font-semibold leading-6 text-sky-900">
                  The complete previous portal, including the old results interface, is preserved separately so you can switch back later without rebuilding it.
                </p>
                <Link
                  href={LEGACY_RESULTS_PORTAL_PATH}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-sky-500"
                >
                  Open /portal/full
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-xl">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Why Hidden</div>
            <h2 className="mt-2 font-display text-xl font-black tracking-[-0.04em] text-neutral-950">
              Temporary privacy hold
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
              This keeps detailed student records out of open public browsing while still allowing manual support when needed.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-xl">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Admin Route</div>
            <h2 className="mt-2 font-display text-xl font-black tracking-[-0.04em] text-neutral-950">
              Reversible setup
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
              The original results interface was moved instead of removed, so it can be brought back to the main website later with minimal changes.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur-xl">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Best Route Now</div>
            <h2 className="mt-2 font-display text-xl font-black tracking-[-0.04em] text-neutral-950">
              Use the chat first
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
              The homepage chat is now the fastest way to request access, ask questions, or leave moderation notes.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
