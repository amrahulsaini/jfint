'use client';

import { useState, useRef, useEffect } from 'react';

const BRANCHES = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Artificial Intelligence & ML',
];

export default function ResultPage() {
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrank, setShowPrank] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; left: number; delay: number; color: string; size: number }[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNo.trim() || !name.trim() || !branch) return;
    setLoading(true);
    // Fake loading
    setTimeout(() => {
      setLoading(false);
      setShowPrank(true);
    }, 2500);
  };

  // Generate confetti on prank reveal
  useEffect(() => {
    if (!showPrank) return;
    const colors = ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ef4444', '#14b8a6'];
    const pieces = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
    }));
    setConfetti(pieces);
  }, [showPrank]);

  if (showPrank) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-pink-50 flex items-center justify-center p-4 overflow-hidden relative">
        {/* Confetti */}
        <style>{`
          @keyframes confettiFall {
            0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          @keyframes bounceIn {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.05); }
            70% { transform: scale(0.9); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
        {confetti.map(p => (
          <div
            key={p.id}
            className="fixed pointer-events-none"
            style={{
              left: `${p.left}%`,
              top: -20,
              width: p.size,
              height: p.size * 1.5,
              background: p.color,
              borderRadius: '2px',
              animation: `confettiFall ${3 + Math.random() * 2}s linear ${p.delay}s infinite`,
            }}
          />
        ))}

        <div
          className="relative z-10 max-w-lg w-full text-center"
          style={{ animation: 'bounceIn 0.8s ease-out forwards' }}
        >
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-orange-200 shadow-2xl shadow-orange-500/20 p-8 md:p-12">
            <div
              className="text-7xl md:text-8xl mb-6"
              style={{ animation: 'pulse 2s ease-in-out infinite' }}
            >
              🎉
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 mb-4">
              APRIL FOOL!
            </h1>
            <p className="text-lg md:text-xl font-bold text-neutral-600 mb-2">
              Gotcha, <span className="text-orange-500 font-extrabold">{name}</span>! 😜
            </p>
            <p className="text-sm font-semibold text-neutral-400 mb-6 leading-relaxed">
              Did you really think 3rd semester results would come out this early?
              <br />
              <span className="text-orange-500">Happy April Fool&apos;s Day! 🤡</span>
            </p>

            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Your &quot;Result&quot;</p>
              <div className="grid grid-cols-2 gap-3 text-left">
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Roll No</p>
                  <p className="text-sm font-extrabold text-neutral-800">{rollNo}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Branch</p>
                  <p className="text-sm font-extrabold text-neutral-800">{branch}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">SGPA</p>
                  <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500">
                    April Fool 😂
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowPrank(false); setRollNo(''); setName(''); setBranch(''); }}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold py-3 px-6 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-orange-500/30 text-sm"
              >
                Prank Someone Else 😈
              </button>
              <p className="text-[11px] font-semibold text-neutral-300">
                Share this link with your friends to prank them too!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30">

      {/* RTU-style header */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white">
        <div className="max-w-5xl mx-auto px-5 py-5 md:py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl md:text-3xl font-black">RTU</span>
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tight leading-tight">
                Rajasthan Technical University
              </h1>
              <p className="text-blue-200 text-xs md:text-sm font-semibold">
                Rawatbhata Road, Kota — 324010
              </p>
            </div>
          </div>
        </div>
        <div className="bg-blue-950/50 border-t border-blue-700/50">
          <div className="max-w-5xl mx-auto px-5 py-2.5 flex items-center justify-between">
            <p className="text-xs font-bold text-blue-300">
              B.Tech 3rd Semester Examination Results — 2025-26
            </p>
            <span className="hidden sm:inline text-[10px] font-bold text-blue-400 bg-blue-800/50 px-2.5 py-1 rounded-full">
              Declared: 01 Apr 2026
            </span>
          </div>
        </div>
      </header>

      {/* Notice banner */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-5 py-2.5 flex items-center gap-2.5">
          <span className="text-amber-600 text-sm">📢</span>
          <p className="text-xs font-bold text-amber-700">
            <span className="font-extrabold">Notice:</span> Results for B.Tech 3rd Semester (Regular &amp; Back) have been declared. Students can check their results below.
          </p>
        </div>
      </div>

      {/* Result form */}
      <main className="max-w-xl mx-auto px-5 py-10 md:py-14">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl shadow-neutral-200/50 overflow-hidden">
          {/* Form header */}
          <div className="bg-gradient-to-r from-blue-800 to-indigo-800 px-6 py-4">
            <h2 className="text-white font-black text-base">Check Your Result</h2>
            <p className="text-blue-200 text-xs font-semibold mt-0.5">B.Tech 3rd Semester — JECRC Foundation, Jaipur</p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Roll Number */}
            <div>
              <label className="block text-xs font-black text-neutral-600 uppercase tracking-wider mb-1.5">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={rollNo}
                onChange={e => setRollNo(e.target.value.toUpperCase())}
                placeholder="e.g. 23JECCSXXX"
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-neutral-800 placeholder:text-neutral-300 transition-all duration-200"
              />
            </div>

            {/* Student Name */}
            <div>
              <label className="block text-xs font-black text-neutral-600 uppercase tracking-wider mb-1.5">
                Student Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your full name"
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-neutral-800 placeholder:text-neutral-300 transition-all duration-200"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-black text-neutral-600 uppercase tracking-wider mb-1.5">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-neutral-800 transition-all duration-200 bg-white"
              >
                <option value="">Select your branch</option>
                {BRANCHES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !rollNo.trim() || !name.trim() || !branch}
              className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 disabled:from-neutral-300 disabled:to-neutral-400 text-white font-extrabold py-3.5 px-6 rounded-xl transition-all duration-200 hover:-translate-y-0.5 disabled:hover:translate-y-0 shadow-lg shadow-blue-500/20 disabled:shadow-none text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Fetching Result...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  View Result
                </>
              )}
            </button>
          </form>
        </div>

        {/* Fine print */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-[11px] font-semibold text-neutral-400">
            In case of any discrepancy, contact your respective college examination cell.
          </p>
          <p className="text-[10px] font-bold text-neutral-300">
            © 2026 Rajasthan Technical University, Kota. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}
