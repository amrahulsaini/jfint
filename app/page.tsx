'use client';

import { useState, useEffect } from 'react';
import StudentRecords from "./components/StudentRecords";

type View = '1styear' | '2ndyear' | null;

const VIEWS = {
  '1styear': { table: 'jecr_1styear', photoDir: '1styearphotos', sem: '1st Sem', year: '1st Year' },
  '2ndyear': { table: 'jecr_2ndyear', photoDir: 'student_photos', sem: '3rd Sem', year: '2nd Year' },
};

const BANNERS = [
  {
    icon: '⚠️',
    text: 'All marks displayed are based on facts and are accurate. Do not dig up finding whether they are correct or not — please mind it!',
    bg: 'bg-amber-500',
    border: 'border-amber-600',
  },
  {
    icon: '🔒',
    text: 'This website will soon be made secured. Access will be available only through authorised purchase authentication.',
    bg: 'bg-neutral-900',
    border: 'border-neutral-700',
  },
];

export default function Home() {
  const [view, setView] = useState<View>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setBannerIdx(i => (i + 1) % BANNERS.length);
        setFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const banner = BANNERS[bannerIdx];

  return (
    <div className="min-h-screen bg-white text-neutral-900">

      {/* ── Announcement Banner ── */}
      {bannerVisible && (
        <div className={`relative ${banner.bg} border-b ${banner.border} transition-all duration-300`}>
          <div
            className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4"
            style={{ opacity: fade ? 1 : 0, transition: 'opacity 0.4s ease' }}
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="text-base flex-shrink-0">{banner.icon}</span>
              <p className="text-white text-xs font-semibold leading-snug truncate sm:whitespace-normal sm:overflow-visible">
                {banner.text}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Dot indicators */}
              <div className="hidden sm:flex items-center gap-1">
                {BANNERS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setFade(false); setTimeout(() => { setBannerIdx(i); setFade(true); }, 200); }}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${i === bannerIdx ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'}`}
                  />
                ))}
              </div>
              <button
                onClick={() => setBannerVisible(false)}
                className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white/70 hover:text-white transition-all duration-200 text-sm font-bold flex-shrink-0"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-neutral-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-orange-500/30">
              J
            </div>
            <span className="text-lg font-black tracking-tight text-neutral-900">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-bold text-neutral-500">
            <a href="#portal" className="hover:text-orange-500 transition-colors duration-200">Portal</a>
            <a href="#about" className="hover:text-orange-500 transition-colors duration-200">About</a>
          </div>
          {view && (
            <button
              onClick={() => setView(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-orange-500 transition-colors duration-200 md:hidden"
            >
              ← Back
            </button>
          )}
        </div>
      </nav>

      {/* ── View Selector / Records ── */}
      <section id="portal" className="max-w-7xl mx-auto px-5 md:px-8 pb-16">

        {!view ? (
          /* ─── Two selection buttons ─── */
          <div className="flex flex-col items-center gap-4 pt-8 pb-8">
            <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-2">Select a batch to view</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">
              {(Object.entries(VIEWS) as [keyof typeof VIEWS, typeof VIEWS[keyof typeof VIEWS]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className="group relative overflow-hidden bg-white hover:bg-orange-50/50 border border-neutral-200 hover:border-orange-400 rounded-2xl p-7 text-left transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 hover:-translate-y-1 active:translate-y-0 shadow-sm"
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-orange-50 group-hover:bg-orange-100 border border-orange-200 group-hover:border-orange-400 flex items-center justify-center mb-4 transition-all duration-300">
                      <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.15em] text-orange-500/80 mb-1.5">
                      View Internal Marks
                    </div>
                    <div className="text-xl font-black text-neutral-900 group-hover:text-orange-600 transition-colors duration-200">
                      {cfg.sem} JECRC
                    </div>
                    <div className="text-sm font-semibold text-neutral-400 mt-1">{cfg.year} Students</div>
                    <div className="flex items-center gap-1.5 mt-5 text-xs font-bold text-neutral-300 group-hover:text-orange-500 transition-colors duration-200">
                      <span>Open Records</span>
                      <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ─── Records view with back breadcrumb ─── */
          <div>
            {/* Breadcrumb bar */}
            <div className="flex items-center justify-between py-5 mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView(null)}
                  className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 hover:border-orange-400 flex items-center justify-center text-neutral-400 hover:text-orange-500 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">JECRC Foundation</div>
                  <div className="text-sm font-black text-neutral-900">{VIEWS[view].sem} — {VIEWS[view].year} Internal Marks</div>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {(Object.entries(VIEWS) as [keyof typeof VIEWS, typeof VIEWS[keyof typeof VIEWS]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 ${
                      view === key
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-white border border-neutral-200 text-neutral-500 hover:border-orange-400 hover:text-orange-500'
                    }`}
                  >
                    {cfg.sem}
                  </button>
                ))}
              </div>
            </div>
            <StudentRecords table={VIEWS[view].table} photoDir={VIEWS[view].photoDir} />
          </div>
        )}
      </section>

      {/* ── About ── */}
      <section id="about" className="border-t border-neutral-200 bg-neutral-50">
        <div className="max-w-3xl mx-auto px-5 py-14 md:py-16 text-center">
          <h2 className="text-xl md:text-2xl font-black text-neutral-900 mb-3">About This Portal</h2>
          <p className="text-neutral-500 leading-relaxed text-sm max-w-xl mx-auto font-semibold">
            This portal is developed for{" "}
            <span className="text-neutral-900 font-black">
              Jaipur Engineering College &amp; Research Centre (JECRC)
            </span>{" "}
            to provide transparency into RTU examination internal marks entry status.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-neutral-200 px-5 py-5 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-neutral-400">
          <span>&copy; {new Date().getFullYear()} JECRC Foundation</span>
          <span>
            Built with <span className="text-orange-500">&hearts;</span> for JECRC
          </span>
        </div>
      </footer>
    </div>
  );
}

