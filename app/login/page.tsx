'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PassInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    if (pasted) {
      onChange(pasted);
      focus(Math.min(pasted.length, 5));
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => {
            refs.current[i] = el;
          }}
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

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/portal';

  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [resendSecs, setResendSecs] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResend = (secs = 60) => {
    setResendSecs(secs);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendSecs(s => {
        if (s <= 1) {
          clearInterval(resendTimer.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    };
  }, []);

  const generatePass = async () => {
    if (resendSecs > 0 || loadingGenerate) return;
    setError('');
    setInfo('');
    setLoadingGenerate(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        setInfo('Pass sent to admin email.');
        startResend(60);
      } else {
        setError(data.error || 'Failed to generate pass');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoadingGenerate(false);
  };

  const verifyPass = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError('');
      const normalized = passcode.replace(/ /g, '');
      if (normalized.length < 6) {
        setError('Enter the complete 6-digit pass.');
        return;
      }
      setLoadingVerify(true);
      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passcode: normalized }),
        });
        const data = await res.json();
        if (res.ok) {
          router.replace(from);
        } else {
          setError(data.error || 'Invalid pass');
          setPasscode('');
        }
      } catch {
        setError('Something went wrong. Please try again.');
      }
      setLoadingVerify(false);
    },
    [passcode, from, router],
  );

  useEffect(() => {
    if (passcode.replace(/ /g, '').length === 6) verifyPass();
  }, [passcode, verifyPass]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-orange-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-orange-500/30 mb-4">
            J
          </div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">
            JECRC<span className="text-orange-500">.</span>
          </h1>
          <p className="text-sm font-semibold text-neutral-400 mt-1">Internal Marks Portal</p>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl shadow-neutral-900/5 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-black text-neutral-900">Generate Access Pass</h2>
            <p className="text-sm text-neutral-400 font-semibold mt-0.5">A 6-digit pass will be sent to admin email</p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={generatePass}
              disabled={loadingGenerate || resendSecs > 0}
              className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              {loadingGenerate ? <Spinner text="Sending..." /> : resendSecs > 0 ? `Generate Again in ${resendSecs}s` : 'Generate Pass'}
            </button>

            <form onSubmit={verifyPass} className="space-y-4 pt-2">
              <PassInput value={passcode} onChange={v => { setPasscode(v); setError(''); }} />
              {info && <InfoMsg text={info} />}
              {error && <ErrorMsg text={error} />}
              <button
                type="submit"
                disabled={loadingVerify || passcode.replace(/ /g, '').length < 6}
                className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                {loadingVerify ? <Spinner text="Verifying..." /> : <>Sign In <ArrowRight /></>}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs font-semibold text-neutral-400 mt-6">
          Generated pass expires in <span className="font-black text-neutral-600">1 hour</span>
        </p>
      </div>
    </div>
  );
}

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

function InfoMsg({ text }: { text: string }) {
  return (
    <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
      {text}
    </p>
  );
}

function Spinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <>
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
