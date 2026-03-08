import StudentRecords from "./components/StudentRecords";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-extrabold text-sm shadow-lg shadow-orange-500/20">
              J
            </div>
            <span className="text-lg font-bold tracking-tight">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-neutral-400">
            <a href="#results" className="hover:text-white transition-colors">Results</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-500/[0.07] rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-orange-600/[0.04] rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center px-5 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Student Result Portal</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]">
            Student Results
            <br />
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent">
              & Records
            </span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-neutral-500 max-w-xl mx-auto leading-relaxed">
            Browse student marks entry status for{" "}
            <span className="text-white font-medium">JECRC Foundation, Jaipur</span>
            {" "}— search by name, filter by branch, and view paper-wise details.
          </p>

          <a
            href="#results"
            className="mt-8 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-black font-bold px-7 py-3 rounded-full text-sm transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-400/30 hover:-translate-y-0.5"
          >
            View Results
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </section>

      {/* Student Records */}
      <section id="results">
        <StudentRecords />
      </section>

      {/* About */}
      <section id="about" className="border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-5 py-16 md:py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">About</h2>
          <p className="text-neutral-500 leading-relaxed text-sm max-w-xl mx-auto">
            This portal is developed for{" "}
            <span className="text-white font-medium">
              Jaipur Engineering College &amp; Research Centre (JECRC)
            </span>{" "}
            to provide transparency into RTU examination marks entry status
            for students and administrators.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-neutral-600">
            {["Next.js", "TypeScript", "Tailwind CSS", "MySQL"].map((t) => (
              <span key={t} className="bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-5 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600">
          <span>&copy; {new Date().getFullYear()} JECRC Foundation</span>
          <span>
            Built with <span className="text-orange-500">&hearts;</span> for JECRC
          </span>
        </div>
      </footer>
    </div>
  );
}
