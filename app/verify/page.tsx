'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function VerifyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/portal';

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const startCooldown = (secs = 60) => {
    setCooldown(secs);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith('@jecrc.ac.in')) {
      setError('Only @jecrc.ac.in emails are allowed.');
      triggerShake();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/student-send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('otp');
        startCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setError(data.error || 'Failed to send OTP.');
        triggerShake();
        // parse cooldown from error message like "Please wait 45s..."
        const match = data.error?.match(/wait (\d+)s/);
        if (match) startCooldown(parseInt(match[1]));
      }
    } catch {
      setError('Network error. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[idx] = val.slice(-1);
    setOtp(newOtp);
    setError('');
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    // Auto-submit when all 6 digits filled
    if (val && idx === 5 && newOtp.every(d => d)) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter' && otp.every(d => d)) {
      handleVerifyOtp(otp.join(''));
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const arr = pasted.split('');
      setOtp(arr);
      otpRefs.current[5]?.focus();
      setTimeout(() => handleVerifyOtp(pasted), 50);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const finalOtp = code ?? otp.join('');
    if (finalOtp.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/student-verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: finalOtp }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => router.replace(from), 800);
      } else {
        setError(data.error || 'Incorrect OTP.');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        triggerShake();
      }
    } catch {
      setError('Network error. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen ui-aurora flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-orange-400/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-sky-400/10 rounded-full blur-[100px]" />
      </div>

      <div
        className={`relative w-full max-w-[400px] bg-white/70 backdrop-blur-2xl border border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[32px] overflow-hidden transition-all duration-300 ${
          shake ? 'animate-[shake_0.5s_ease-in-out]' : ''
        }`}
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Card */}
        <div className="bg-white/90 border border-neutral-200/50 shadow-2xl shadow-neutral-900/10 overflow-hidden h-full w-full">
          {/* Top gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />

          <div className="p-8 sm:p-10">
            {/* Logo */}
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-orange-500/30">
                J
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-neutral-900">
                  JECRC<span className="text-orange-500">.</span>
                </span>
                <p className="text-[11px] font-bold text-neutral-400 -mt-0.5 uppercase tracking-wider">Internal Marks Portal</p>
              </div>
            </div>

            {success ? (
              /* Success state */
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h2 className="text-xl font-black text-neutral-900 mb-1">Verified!</h2>
                <p className="text-sm text-neutral-500 font-medium">Taking you to the portal…</p>
              </div>
            ) : step === 'email' ? (
              /* Email step */
              <form onSubmit={handleSendOtp}>
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-black text-neutral-900 mb-1.5">Verify your identity</h1>
                  <p className="text-sm text-neutral-500 font-medium leading-relaxed">
                    Enter your college email to receive a one-time access code. Only <span className="text-orange-500 font-bold">@jecrc.ac.in</span> emails are accepted.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-black text-neutral-500 uppercase tracking-wider mb-2">
                    College Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="yourname@jecrc.ac.in"
                    autoFocus
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none text-sm font-semibold text-neutral-900 placeholder-neutral-400 transition-all duration-200"
                  />
                </div>

                {error && (
                  <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs font-semibold text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-black text-sm shadow-lg shadow-orange-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      Send OTP
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* OTP step */
              <div>
                <div className="mb-6">
                  <button
                    onClick={() => { setStep('email'); setOtp(['','','','','','']); setError(''); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-orange-500 transition-colors mb-4"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Change email
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-black text-neutral-900 mb-1.5">Enter OTP</h1>
                  <p className="text-sm text-neutral-500 font-medium leading-relaxed">
                    We sent a 6-digit code to{' '}
                    <span className="text-orange-500 font-bold">{email}</span>
                  </p>
                </div>

                {/* OTP boxes */}
                <div className="flex gap-2 sm:gap-3 justify-center mb-4 max-w-[280px] mx-auto" onPaste={handleOtpPaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { otpRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      className={`w-10 h-11 sm:w-11 sm:h-12 text-center text-base sm:text-lg font-black rounded-xl border-2 outline-none transition-all duration-200 ${
                        digit
                          ? 'border-orange-400 bg-orange-50 text-orange-600 shadow-sm shadow-orange-200'
                          : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-orange-400 focus:bg-white focus:shadow-sm focus:shadow-orange-200'
                      }`}
                    />
                  ))}
                </div>

                {error && (
                  <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs font-semibold text-red-600">{error}</p>
                  </div>
                )}

                <button
                  onClick={() => handleVerifyOtp()}
                  disabled={loading || otp.some(d => !d)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-black text-sm shadow-lg shadow-orange-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying…
                    </>
                  ) : 'Verify & Continue'}
                </button>

                {/* Resend */}
                <div className="text-center">
                  {cooldown > 0 ? (
                    <p className="text-xs text-neutral-400 font-semibold">
                      Resend in <span className="text-orange-500 font-black tabular-nums">{cooldown}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50"
                    >
                      Didn't receive it? Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-neutral-400 font-semibold mt-4">
          JECRC Foundation • Internal Marks Portal
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyPageInner />
    </Suspense>
  );
}
