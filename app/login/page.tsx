'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, opts: object) => string;
      reset: (id?: string) => void;
    };
  }
}

type Step = 'password' | 'email' | 'otp';

// ── OTP 6-box input ───────────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').split('').slice(0, 6);

  const focus = (i: number) => refs.current[i]?.focus();

  const handleChange = (i: number, char: string) => {
    const d = char.replace(/\D/g, '').slice(-1);
    const arr = digits.map((c, idx) => (idx === i ? d : c));
    onChange(arr.join('').replace(/ /g, ''));
    if (d && i < 5) focus(i + 1);
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[i]?.trim()) {
        const arr = digits.map((c, idx) => (idx === i ? ' ' : c));
        onChange(arr.join('').replace(/ /g, ''));
      } else if (i > 0) {
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) focus(i - 1);
    else if (e.key === 'ArrowRight' && i < 5) focus(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); focus(Math.min(pasted.length, 5)); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="\d"
          maxLength={1}
          value={digits[i]?.trim() || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onClick={() => focus(i)}
          className="w-11 h-14 text-center text-xl font-black text-neutral-900 bg-neutral-50 border-2 border-neutral-200 rounded-xl focus:outline-none focus:border-orange-400 focus:bg-white transition-all duration-150 caret-transparent"
        />
      ))}
    </div>
  );
}

// ── Main login form ───────────────────────────────────────────────────────────
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/';

  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendSecs, setResendSecs] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const tsWidgetId = useRef<string>('');
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
  const turnstileConfigured = !!siteKey && !siteKey.startsWith('YOUR_');

  // Render Turnstile widget once script is loaded and we are on step 1
  const renderTurnstile = useCallback(() => {
    if (!window.turnstile || !turnstileConfigured) return;
    const el = document.getElementById('ts-widget');
    if (!el) return;
    el.innerHTML = '';
    tsWidgetId.current = window.turnstile.render(el, {
      sitekey: siteKey,
      theme: 'light',
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    });
  }, [siteKey, turnstileConfigured]);

  useEffect(() => {
    if (turnstileReady && step === 'password') renderTurnstile();
  }, [turnstileReady, step, renderTurnstile]);

  // Resend cooldown ticker
  const startResend = (secs = 60) => {
    setResendSecs(secs);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendSecs(s => {
        if (s <= 1) { clearInterval(resendTimer.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };
  useEffect(() => () => { if (resendTimer.current) clearInterval(resendTimer.current); }, []);

  // ── Step 1: Submit password + turnstile ──────────────────────────────────
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) return;
    if (turnstileConfigured && !turnstileToken) { setError('Please complete the captcha.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, turnstileToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('email');
        setPassword('');
      } else {
        setError(data.error || 'Incorrect password');
        setTurnstileToken('');
        window.turnstile?.reset(tsWidgetId.current);
      }
    } catch { setError('Something went wrong. Please try again.'); }
    setLoading(false);
  };

  // ── Step 2: Send OTP ─────────────────────────────────────────────────────
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const norm = email.trim().toLowerCase();
    if (!norm.endsWith('@jecrc.ac.in')) {
      setError('Only @jecrc.ac.in email addresses are accepted.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: norm }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('otp');
        setOtp('');
        setInfo(`Code sent to ${norm}`);
        startResend(60);
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch { setError('Something went wrong. Please try again.'); }
    setLoading(false);
  };

  // ── Step 3: Verify OTP ─────────────────────────────────────────────────
  const submitOtp = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (otp.replace(/ /g, '').length < 6) { setError('Enter the complete 6-digit code.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otp.replace(/ /g, ''), email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        router.replace(from);
      } else {
        setError(data.error || 'Incorrect code');
        setOtp('');
        if (data.error?.includes('start over') || data.error?.includes('request a new OTP')) {
          setTimeout(() => { setStep('email'); setError(''); setInfo(''); }, 1600);
        }
      }
    } catch { setError('Something went wrong. Please try again.'); }
    setLoading(false);
  }, [otp, email, from, router]);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (step === 'otp' && otp.replace(/ /g, '').length === 6) submitOtp();
  }, [otp, step, submitOtp]);

  // Resend OTP
  const resendOtp = async () => {
    if (resendSecs > 0) return;
    setError(''); setInfo('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) { setOtp(''); setInfo('New code sent!'); startResend(60); }
      else setError(data.error || 'Failed to resend');
    } catch { setError('Something went wrong.'); }
    setLoading(false);
  };

  // ── Step progress indicator ──────────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: 'password', label: 'Password' },
    { key: 'email', label: 'Email' },
    { key: 'otp', label: 'Verify' },
  ];
  const stepIdx = steps.findIndex(s => s.key === step);

  return (
    <>
      {turnstileConfigured && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileReady(true)}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-orange-50/30 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-orange-500/30 mb-4">
              J
            </div>
            <h1 className="text-2xl font-black tracking-tight text-neutral-900">
              JECRC<span className="text-orange-500">.</span>
            </h1>
            <p className="text-sm font-semibold text-neutral-400 mt-1">Internal Marks Portal</p>
          </div>

          {/* Step progress bar */}
          <div className="flex items-center mb-6 px-2">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
                    i < stepIdx ? 'bg-orange-500 text-white' :
                    i === stepIdx ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-110' :
                    'bg-neutral-100 text-neutral-400'
                  }`}>
                    {i < stepIdx ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 font-bold transition-colors ${i <= stepIdx ? 'text-orange-500' : 'text-neutral-400'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-1 transition-all duration-300 ${i < stepIdx ? 'bg-orange-400' : 'bg-neutral-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl shadow-neutral-900/5 p-8">

            {/* ── Step 1: Password ── */}
            {step === 'password' && (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-black text-neutral-900">Access Required</h2>
                  <p className="text-sm text-neutral-400 font-semibold mt-0.5">Enter the site password to continue</p>
                </div>
                <form onSubmit={submitPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError(''); }}
                        placeholder="Enter password…"
                        autoFocus
                        className={`w-full bg-neutral-50 border rounded-xl px-4 pr-11 py-3 text-sm font-semibold text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-500/10' : 'border-neutral-200 focus:border-orange-400 focus:ring-orange-500/10'}`}
                      />
                      <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-neutral-400 hover:text-neutral-700 transition-colors" tabIndex={-1}>
                        {showPw ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Cloudflare Turnstile widget */}
                  {turnstileConfigured && (
                    <div className="flex justify-center py-1">
                      <div id="ts-widget" />
                    </div>
                  )}

                  {error && <ErrorMsg text={error} />}

                  <button
                    type="submit"
                    disabled={loading || !password || (turnstileConfigured && !turnstileToken)}
                    className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    {loading ? <Spinner /> : <>Continue <ArrowRight /></>}
                  </button>
                </form>
              </>
            )}

            {/* ── Step 2: Email ── */}
            {step === 'email' && (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-black text-neutral-900">Verify Your Email</h2>
                  <p className="text-sm text-neutral-400 font-semibold mt-0.5">Enter your college email — an OTP will be sent</p>
                </div>
                <form onSubmit={submitEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-neutral-400 mb-2">College Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      placeholder="you@jecrc.ac.in"
                      autoFocus
                      className={`w-full bg-neutral-50 border rounded-xl px-4 py-3 text-sm font-semibold text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 transition-all ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-500/10' : 'border-neutral-200 focus:border-orange-400 focus:ring-orange-500/10'}`}
                    />
                    <p className="mt-1.5 text-[11px] font-semibold text-neutral-400">Only @jecrc.ac.in addresses are accepted</p>
                  </div>
                  {error && <ErrorMsg text={error} />}
                  <button type="submit" disabled={loading || !email} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                    {loading ? <Spinner text="Sending…" /> : <>Send OTP <ArrowRight /></>}
                  </button>
                  <button type="button" onClick={() => { setStep('password'); setError(''); }} className="w-full text-xs font-bold text-neutral-400 hover:text-neutral-700 py-1 transition-colors">
                    ← Back to password
                  </button>
                </form>
              </>
            )}

            {/* ── Step 3: OTP ── */}
            {step === 'otp' && (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-black text-neutral-900">Enter OTP</h2>
                  {info && (
                    <p className="text-xs font-semibold text-emerald-600 mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {info}
                    </p>
                  )}
                </div>
                <form onSubmit={submitOtp} className="space-y-5">
                  <OtpInput value={otp} onChange={v => { setOtp(v); setError(''); }} />
                  {error && <ErrorMsg text={error} />}
                  <button type="submit" disabled={loading || otp.replace(/ /g, '').length < 6} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                    {loading ? <Spinner text="Verifying…" /> : <>Verify &amp; Sign in <ArrowRight /></>}
                  </button>
                  <div className="flex items-center justify-between text-xs font-bold pt-1">
                    <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); setInfo(''); }} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                      ← Change email
                    </button>
                    <button type="button" onClick={resendOtp} disabled={resendSecs > 0 || loading} className="text-orange-500 disabled:text-neutral-400 disabled:cursor-not-allowed hover:text-orange-700 transition-colors">
                      {resendSecs > 0 ? `Resend in ${resendSecs}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>

          <p className="text-center text-xs font-semibold text-neutral-400 mt-6">
            Session expires after <span className="font-black text-neutral-600">20 minutes</span> of inactivity
          </p>
        </div>
      </div>
    </>
  );
}

// ── Small reusable helpers ────────────────────────────────────────────────────

function ErrorMsg({ text }: { text: string }) {
  return (
    <p className="text-xs font-bold text-red-500 flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      {text}
    </p>
  );
}

function Spinner({ text = 'Loading…' }: { text?: string }) {
  return (
    <>
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      {text}
    </>
  );
}

function ArrowRight() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
