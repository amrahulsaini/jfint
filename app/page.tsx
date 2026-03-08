import StudentRecords from "./components/StudentRecords";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center font-extrabold text-sm text-white shadow-lg shadow-orange-500/25">
              J
            </div>
            <span className="text-lg font-bold tracking-tight text-neutral-900">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-neutral-500">
            <a href="#results" className="hover:text-orange-500 transition-colors">Results</a>
            <a href="#about" className="hover:text-orange-500 transition-colors">About</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-neutral-50 border-b border-neutral-200">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.06),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(249,115,22,0.04),transparent_50%)]" />

        <div className="relative max-w-5xl mx-auto text-center px-5 pt-16 pb-14 md:pt-24 md:pb-20">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-neutral-900">
            JECRC Foundation
          </h1>
          <p className="mt-3 text-lg md:text-xl font-semibold text-orange-500">
            Student Marks Entry Status
          </p>
          <p className="mt-4 text-sm md:text-base text-neutral-500 max-w-lg mx-auto leading-relaxed">
            Search students by name or roll number, filter by branch, and view
            detailed paper-wise marks entry status.
          </p>
        </div>
      </section>

      {/* Student Records */}
      <section id="results">
        <StudentRecords />
      </section>

      {/* About */}
      <section id="about" className="border-t border-neutral-200 bg-neutral-50">
        <div className="max-w-3xl mx-auto px-5 py-14 md:py-18 text-center">
          <h2 className="text-xl md:text-2xl font-bold text-neutral-900 mb-3">About</h2>
          <p className="text-neutral-500 leading-relaxed text-sm max-w-xl mx-auto">
            This portal is developed for{" "}
            <span className="text-neutral-900 font-semibold">
              Jaipur Engineering College &amp; Research Centre (JECRC)
            </span>{" "}
            to provide transparency into RTU examination marks entry status.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 px-5 py-5 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <span>&copy; {new Date().getFullYear()} JECRC Foundation</span>
          <span>
            Built with <span className="text-orange-500">&hearts;</span> for JECRC
          </span>
        </div>
      </footer>
    </div>
  );
}
