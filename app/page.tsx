import Link from "next/link";
import StudentRecords from "./components/StudentRecords";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/25">
            J
          </div>
          <span className="text-xl font-semibold tracking-tight">
            JECRC <span className="text-blue-400">Foundation</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
          <a href="#tools" className="hover:text-white transition-colors">Tools</a>
          <a href="#records" className="hover:text-white transition-colors">Records</a>
          <a href="#about" className="hover:text-white transition-colors">About</a>
          <Link
            href="/marks-entry"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Open Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 md:pt-36 md:pb-28">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8 text-sm text-blue-300">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live &amp; Monitoring
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight max-w-4xl">
          RTU Marks Entry
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            Tracking Dashboard
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed">
          Real-time monitoring of theory, practical &amp; sessional marks entry
          status for{" "}
          <span className="text-white font-medium">
            JECRC Foundation, Jaipur
          </span>
          . Export data in CSV, PDF &amp; SQL formats.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-10">
          <Link
            href="/marks-entry"
            className="group relative inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Track Marks Entry
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="#tools"
            className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white px-8 py-3.5 rounded-xl text-base font-medium transition-all"
          >
            View All Tools
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          {[
            { label: "Exam Types", value: "Theory · Practical · Sessional" },
            { label: "Export Formats", value: "CSV · PDF · SQL" },
            { label: "College Code", value: "1217" },
            { label: "University", value: "RTU, Kota" },
          ].map((s) => (
            <div key={s.label} className="px-6 py-6 text-center">
              <div className="text-sm text-slate-500 mb-1">{s.label}</div>
              <div className="text-sm md:text-base font-medium text-slate-200">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">Available Tools</h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            Internal utilities built for JECRC Foundation administration.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tool Card 1 — Active */}
          <Link
            href="/marks-entry"
            className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-blue-500/40 rounded-2xl p-6 transition-all hover:shadow-lg hover:shadow-blue-500/5"
          >
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M21.375 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 13.125v-1.5m0 1.5c0 .621.504 1.125 1.125 1.125M12 13.125c0 .621-.504 1.125-1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1 group-hover:text-blue-400 transition-colors">
              Marks Entry Tracker
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Monitor RTU marks entry status with cascading filters. View
              per-paper student details and export bulk data.
            </p>
          </Link>

          {/* Tool Card 2 — Coming Soon */}
          <div className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-6 opacity-60">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-medium text-slate-500 bg-white/5 px-2.5 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1">Attendance Monitor</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Track and analyze student attendance across departments and
              semesters.
            </p>
          </div>

          {/* Tool Card 3 — Coming Soon */}
          <div className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-6 opacity-60">
            <div className="absolute top-4 right-4">
              <span className="text-xs font-medium text-slate-500 bg-white/5 px-2.5 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1">Result Analytics</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Comprehensive result analysis with department-wise pass percentage
              and performance trends.
            </p>
          </div>
        </div>
      </section>

      {/* Student Records from DB */}
      <section className="border-t border-white/10 bg-white/[0.01]">
        <StudentRecords />
      </section>

      {/* About */}
      <section id="about" className="border-t border-white/10 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">About</h2>
          <p className="text-slate-400 leading-relaxed max-w-2xl mx-auto">
            This platform is developed for{" "}
            <span className="text-white font-medium">
              Jaipur Engineering College &amp; Research Centre (JECRC)
            </span>{" "}
            to streamline the monitoring of RTU examination marks entry.
            It provides real-time visibility into paper-wise entry status and
            enables bulk data exports for administrative reporting.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Next.js
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              TypeScript
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Tailwind CSS
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              RTU API
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>&copy; {new Date().getFullYear()} JECRC Foundation. All rights reserved.</span>
          <span>
            Built with{" "}
            <span className="text-red-400">&hearts;</span> for JECRC
          </span>
        </div>
      </footer>
    </div>
  );
}
