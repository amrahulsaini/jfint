'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import StudentRecords from "../components/StudentRecords";
import DisclaimerModal from "../components/DisclaimerModal";


type View = '1styear' | '2ndyear' | null;

const VIEWS = {
  '1styear': { table: '1styearmaster', photoDir: '1styearphotos', sem: '1st Sem', year: '1st Year' },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [fade, setFade] = useState(true);

  // Email verification modal
  const [verifyChecked, setVerifyChecked] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifyStep, setVerifyStep] = useState<'email' | 'otp'>('email');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyOtp, setVerifyOtp] = useState(['', '', '', '', '', '']);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifyCooldown, setVerifyCooldown] = useState(0);
  const [verifyShake, setVerifyShake] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if already verified on mount
  useEffect(() => {
    fetch('/api/auth/check-verified')
      .then(r => r.json())
      .then(d => {
        setVerifyChecked(true);
        if (d.verified) {
          setVerifiedEmail(d.email || null);
        } else {
          setVerifiedEmail(null);
        }
      })
      .catch(() => { setVerifyChecked(true); setVerifiedEmail(null); });
  }, []);

  const promptVerificationForPayment = useCallback(() => {
    setVerifyChecked(true);
    setVerifyError('');
    setVerifyStep('email');
    setVerifyOtp(['', '', '', '', '', '']);
    setShowVerify(true);
  }, []);

  const startCooldown = useCallback((secs = 60) => {
    setVerifyCooldown(secs);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setVerifyCooldown(c => {
        if (c <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  const triggerShake = () => {
    setVerifyShake(true);
    setTimeout(() => setVerifyShake(false), 600);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const email = verifyEmail.trim().toLowerCase();
    if (!email.endsWith('@jecrc.ac.in')) {
      setVerifyError('Only @jecrc.ac.in emails are allowed.');
      triggerShake();
      return;
    }
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const res = await fetch('/api/auth/student-send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyStep('otp');
        startCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setVerifyError(data.error || 'Failed to send OTP.');
        triggerShake();
        const m = data.error?.match(/wait (\d+)s/);
        if (m) startCooldown(parseInt(m[1]));
      }
    } catch { setVerifyError('Network error.'); triggerShake(); }
    finally { setVerifyLoading(false); }
  };

  const handleOtpChange = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...verifyOtp]; next[idx] = val.slice(-1); setVerifyOtp(next);
    setVerifyError('');
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (val && idx === 5 && next.every(d => d)) handleVerifyOtp(next.join(''));
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verifyOtp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === 'Enter' && verifyOtp.every(d => d)) handleVerifyOtp(verifyOtp.join(''));
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setVerifyOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
      setTimeout(() => handleVerifyOtp(pasted), 50);
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const finalOtp = code ?? verifyOtp.join('');
    if (finalOtp.length !== 6) return;
    setVerifyLoading(true); setVerifyError('');
    try {
      const res = await fetch('/api/auth/student-verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail.trim().toLowerCase(), otp: finalOtp }),
      });
      const data = await res.json();
      if (data.success) {
        setShowVerify(false);
        setVerifiedEmail(verifyEmail.trim().toLowerCase());
      } else {
        setVerifyError(data.error || 'Incorrect OTP.');
        setVerifyOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        triggerShake();
      }
    } catch { setVerifyError('Network error.'); triggerShake(); }
    finally { setVerifyLoading(false); }
  };

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setVerifiedEmail(null);
      setShowVerify(false);
      setVerifyStep('email');
      setVerifyEmail('');
      setVerifyOtp(['', '', '', '', '', '']);
      setVerifyError('');
    } catch { /* ignore */ }
    setLogoutLoading(false);
  };

  // Countdown timer for results announcement
  const [countdown, setCountdown] = useState<{hours:string,minutes:string,seconds:string}|null>(null);
  useEffect(() => {
    const target = new Date('2026-04-24T00:00:00').getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown({hours:'00',minutes:'00',seconds:'00'}); return; }
      setCountdown({
        hours: Math.floor(diff/(1000*60*60)).toString().padStart(2,'0'),
        minutes: Math.floor((diff%(1000*60*60))/(1000*60)).toString().padStart(2,'0'),
        seconds: Math.floor((diff%(1000*60))/1000).toString().padStart(2,'0'),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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
    <div className="min-h-screen ui-aurora text-neutral-900">
      <DisclaimerModal />

      {/* ── Email Verification Modal Overlay ── */}
      {verifyChecked && showVerify && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{backdropFilter:'blur(12px)', backgroundColor:'rgba(255,255,255,0.5)'}}>
          <div
            className={`bg-white border border-neutral-200/80 rounded-3xl shadow-2xl shadow-neutral-900/15 w-full max-w-sm overflow-hidden transition-all ${
              verifyShake ? 'animate-[shake_0.5s_ease-in-out]' : ''
            }`}
            style={verifyShake ? {animation:'shake 0.5s ease-in-out'} : {}}
          >
            <div className="h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
            <div className="p-7">
              {/* Logo */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-orange-500/30">J</div>
                <div>
                  <span className="text-base font-black tracking-tight text-neutral-900">JECRC<span className="text-orange-500">.</span></span>
                  <p className="text-[10px] font-bold text-neutral-400 -mt-0.5 uppercase tracking-wider">1st Sem & 3rd Sem Results Portal</p>
                </div>
              </div>

              {/* Results Announcement Countdown */}
              {countdown && (
                <div className="mb-5 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4 overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Results Announcement</span>
                  </div>
                  <p className="text-xs text-neutral-600 font-medium leading-relaxed mb-3">
                    The results of the <span className="font-bold text-neutral-900">1st</span> and <span className="font-bold text-neutral-900">3rd Semester</span> are likely to be announced on our website in:
                  </p>
                  <div className="flex justify-center gap-2">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-white border border-orange-200 rounded-xl shadow-sm flex items-center justify-center text-lg font-black text-orange-600 tabular-nums">{countdown.hours}</div>
                      <div className="text-[8px] font-black text-orange-400 uppercase tracking-wider mt-1">Hours</div>
                    </div>
                    <div className="text-lg font-black text-orange-300 self-start mt-3">:</div>
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-white border border-orange-200 rounded-xl shadow-sm flex items-center justify-center text-lg font-black text-orange-600 tabular-nums">{countdown.minutes}</div>
                      <div className="text-[8px] font-black text-orange-400 uppercase tracking-wider mt-1">Min</div>
                    </div>
                    <div className="text-lg font-black text-orange-300 self-start mt-3">:</div>
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 bg-white border border-orange-200 rounded-xl shadow-sm flex items-center justify-center text-lg font-black text-orange-600 tabular-nums">{countdown.seconds}</div>
                      <div className="text-[8px] font-black text-orange-400 uppercase tracking-wider mt-1">Sec</div>
                    </div>
                  </div>
                </div>
              )}

              {verifyStep === 'email' ? (
                <form onSubmit={handleSendOtp}>
                  <h2 className="text-xl font-black text-neutral-900 mb-1">Verify your identity</h2>
                  <p className="text-xs text-neutral-500 font-medium mb-5 leading-relaxed">Enter your college email. Only <span className="text-orange-500 font-bold">@jecrc.ac.in</span> is accepted.</p>
                  <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5">College Email</label>
                  <input
                    type="email" value={verifyEmail}
                    onChange={e => { setVerifyEmail(e.target.value); setVerifyError(''); }}
                    placeholder="yourname@jecrc.ac.in" autoFocus autoComplete="email"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none text-sm font-semibold text-neutral-900 placeholder-neutral-400 transition-all mb-4"
                  />
                  {verifyError && (
                    <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H2.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0L21.303 16.126z"/></svg>
                      <p className="text-[11px] font-semibold text-red-600">{verifyError}</p>
                    </div>
                  )}
                  <button type="submit" disabled={verifyLoading || !verifyEmail}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-black text-sm shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {verifyLoading ? (
                      <><span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                      </span> Sending…</>
                    ) : 'Send OTP →'}
                  </button>
                </form>
              ) : (
                <div>
                  <button onClick={() => { setVerifyStep('email'); setVerifyOtp(['','','','','','']); setVerifyError(''); }}
                    className="flex items-center gap-1 text-xs font-bold text-neutral-400 hover:text-orange-500 transition-colors mb-4">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    Change email
                  </button>
                  <h2 className="text-xl font-black text-neutral-900 mb-1">Enter OTP</h2>
                  <p className="text-xs text-neutral-500 font-medium mb-5">Code sent to <span className="text-orange-500 font-bold">{verifyEmail}</span></p>
                  <div className="flex gap-2 sm:gap-3 justify-center mb-4 max-w-[280px] mx-auto" onPaste={handleOtpPaste}>
                    {verifyOtp.map((digit, idx) => (
                      <input key={idx}
                        ref={el => { otpRefs.current[idx] = el; }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={e => handleOtpChange(idx, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                        className={`w-10 h-11 sm:w-11 sm:h-12 text-center text-base sm:text-lg font-black rounded-xl border-2 outline-none transition-all duration-200 ${
                          digit ? 'border-orange-400 bg-orange-50 text-orange-600 shadow-sm shadow-orange-200' : 'border-neutral-200 bg-neutral-50 text-neutral-900 focus:border-orange-400 focus:bg-white focus:shadow-sm focus:shadow-orange-200'
                        }`}
                      />
                    ))}
                  </div>
                  {verifyError && (
                    <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H2.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0L21.303 16.126z"/></svg>
                      <p className="text-[11px] font-semibold text-red-600">{verifyError}</p>
                    </div>
                  )}
                  <button onClick={() => handleVerifyOtp()} disabled={verifyLoading || verifyOtp.some(d => !d)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-black text-sm shadow-lg shadow-orange-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
                  >
                    {verifyLoading ? (
                      <><span className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                      </span> Verifying…</>
                    ) : 'Verify & Continue'}
                  </button>
                  <div className="text-center">
                    {verifyCooldown > 0 ? (
                      <p className="text-[11px] text-neutral-400 font-semibold">Resend in <span className="text-orange-500 font-black tabular-nums">{verifyCooldown}s</span></p>
                    ) : (
                      <button onClick={() => handleSendOtp()} disabled={verifyLoading} className="text-[11px] font-bold text-orange-500 hover:text-orange-600 transition-colors disabled:opacity-50">Didn&apos;t receive it? Resend OTP</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-7px)}30%{transform:translateX(7px)}45%{transform:translateX(-5px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}90%{transform:translateX(3px)}}`}</style>
        </div>
      )}

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
      <nav className="sticky top-0 z-40 bg-white/60 backdrop-blur-2xl border-b border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 h-[72px]">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 flex items-center justify-center font-black text-lg text-white shadow-[0_8px_16px_-4px_rgba(249,115,22,0.4)] group-hover:scale-105 group-active:scale-95 transition-all duration-300">
              J
            </div>
            <span className="text-xl font-black tracking-tight text-neutral-900 group-hover:text-orange-600 transition-colors duration-300">
              JECRC<span className="text-orange-500">.</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-neutral-500 bg-white/40 px-6 py-2 rounded-full border border-white/60 shadow-sm">
            <a href="#portal" className="hover:text-orange-600 transition-colors duration-200">Portal</a>
            <a href="#about" className="hover:text-orange-600 transition-colors duration-200">About</a>
            <a href="/chat" className="hover:text-orange-600 transition-colors duration-200">Chat</a>
            <a href="/profile" className="hover:text-orange-600 transition-colors duration-200">Profile</a>
            <a href="/tracking" className="hover:text-orange-600 transition-colors duration-200">Tracking</a>
          </div>
          {/* Session timer + logout */}
          <div className="flex items-center gap-2">
            {verifiedEmail && (
              <>
                <span className="hidden sm:inline text-xs font-semibold text-neutral-400 truncate max-w-[160px]" title={verifiedEmail}>
                  {verifiedEmail}
                </span>
                <button
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-red-50 border border-neutral-200 hover:border-red-300 text-neutral-500 hover:text-red-500 text-xs font-bold transition-all duration-200 disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-500 flex items-center justify-center transition-all duration-200"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
            {view && (
              <button
                onClick={() => setView(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-orange-500 transition-colors duration-200 md:hidden"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/70 bg-white/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-5 py-3 flex flex-col gap-2 text-sm font-bold text-neutral-600">
              <a href="#portal" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-500 transition-colors duration-200">Portal</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-500 transition-colors duration-200">About</a>
              <a href="/chat" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-500 transition-colors duration-200">Chat</a>
              <a href="/profile" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-500 transition-colors duration-200">Profile</a>
              <a href="/tracking" onClick={() => setMobileMenuOpen(false)} className="px-3 py-2 rounded-lg hover:bg-orange-50 hover:text-orange-500 transition-colors duration-200">Tracking</a>
            </div>
          </div>
        )}
      </nav>

      {/* ── View Selector / Records ── */}
      <section id="portal" className="max-w-7xl mx-auto px-5 md:px-8 pb-16 ui-rise">

        {!view ? (
          /* ─── Two selection buttons ─── */
          <div className="flex flex-col items-center gap-6 pt-12 pb-16">
            <p className="text-sm font-black text-neutral-400/80 uppercase tracking-[0.2em] mb-2 flex items-center gap-3">
              <span className="w-8 h-px bg-neutral-200"></span>
              Select a batch
              <span className="w-8 h-px bg-neutral-200"></span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
              {(Object.entries(VIEWS) as [keyof typeof VIEWS, typeof VIEWS[keyof typeof VIEWS]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className="group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-white hover:to-orange-50/50 border border-neutral-200 hover:border-orange-300 rounded-[24px] p-8 text-left transition-all duration-500 hover:shadow-[0_20px_40px_-12px_rgba(249,115,22,0.15)] hover:-translate-y-1.5 active:translate-y-0"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 text-orange-200">
                    <svg className="w-24 h-24 -mt-8 -mr-8 transform rotate-12 group-hover:rotate-0 transition-transform duration-700" fill="currentColor" viewBox="0 0 24 24">
                       <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13h-13L12 6.5z"/>
                    </svg>
                  </div>
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 group-hover:from-orange-400 group-hover:to-orange-500 border border-orange-100 group-hover:border-orange-400 flex items-center justify-center mb-6 transition-all duration-500 shadow-sm group-hover:shadow-orange-500/30">
                      <svg className="w-7 h-7 text-orange-500 group-hover:text-white transition-colors duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                    </div>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500/80 mb-2">
                      View Results & Info
                    </div>
                    <div className="text-2xl font-black text-neutral-900 group-hover:text-neutral-950 transition-colors duration-200">
                      {cfg.sem} JECRC
                    </div>
                    <div className="text-sm font-semibold text-neutral-400 mt-1">{cfg.year} Students</div>
                    <div className="flex items-center gap-2 mt-8 text-xs font-bold text-neutral-400 group-hover:text-orange-600 transition-colors duration-200 bg-neutral-50/80 group-hover:bg-orange-50 px-4 py-2.5 rounded-xl inline-flex w-max">
                      <span>Open Records</span>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* ── Premium Info Disclaimer ── */}
            <div className="w-full max-w-2xl mt-6 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50/60 overflow-hidden shadow-sm">
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-cyan-100 bg-cyan-500/5">
                <div className="w-8 h-8 rounded-xl bg-cyan-100 border border-cyan-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-500">Access Required</div>
                    <h4 className="text-sm font-extrabold text-cyan-900 leading-none">Premium Student Information</h4>
                </div>
                <span className="ml-auto flex-shrink-0 bg-cyan-600 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">Premium</span>
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-cyan-800 mb-3 leading-relaxed">
                  The following sensitive student data is available on request and is <span className="font-extrabold">not publicly listed</span> for privacy reasons:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {[
                    { icon: '🪪', label: 'Aadhar Number' },
                    { icon: '📋', label: 'Caste Category' },
                    { icon: '📊', label: '10th & 12th Percentage' },
                    { icon: '🏠', label: 'Permanent Address' },
                    { icon: '📞', label: "Parents' Contact Number" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2.5 bg-white/70 border border-cyan-100 rounded-xl px-3 py-2">
                      <span className="text-base leading-none">{item.icon}</span>
                      <span className="text-xs font-bold text-cyan-900">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-cyan-500/8 border border-cyan-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-cyan-800">
                    To request access, drop a mail to:
                  </p>
                  <a
                    href="mailto:jecrc@jecrcfoundation.live"
                    className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    jecrc@jecrcfoundation.live
                  </a>
                </div>
              </div>
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
            {/* Premium info banner */}
            <div className="mb-4 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50/60 overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-cyan-100 border border-cyan-200 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-500">Premium Access</span>
                    <p className="text-xs font-semibold text-cyan-900 leading-snug">
                      Aadhar, Caste, 10th/12th %, Address &amp; Parents&apos; contact available on request &mdash;
                      <span className="flex-shrink-0 hidden sm:inline"> </span>
                      <span className="text-cyan-600 font-bold">🪪 📋 📊 🏠 📞</span>
                    </p>
                  </div>
                </div>
                <a
                  href="mailto:jecrc@jecrcfoundation.live"
                  className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-extrabold px-3.5 py-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 shadow-sm flex-shrink-0 whitespace-nowrap"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  jecrc@jecrcfoundation.live
                </a>
              </div>
            </div>
            <StudentRecords
              table={VIEWS[view].table}
              photoDir={VIEWS[view].photoDir}
              verifiedEmail={verifiedEmail}
              onRequireVerification={promptVerificationForPayment}
            />
          </div>
        )}
      </section>

      {/* ── About ── */}
      <section id="about" className="border-t border-white/70 bg-white/55 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 py-14 md:py-16">
          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-black text-neutral-900 mb-3">About This Portal</h2>
            <p className="text-neutral-500 leading-relaxed text-sm max-w-xl mx-auto font-semibold">
              This portal displays RTU internal marks entry status for students of{" "}
              <span className="text-neutral-900 font-black">
                Jaipur Engineering College &amp; Research Centre (JECRC)
              </span>
              , giving students early and convenient access to information that universities typically provide late.
            </p>
          </div>

          {/* Affiliation Disclaimer */}
          <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-5 sm:p-7 shadow-md shadow-red-500/10">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 border border-red-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.15em] text-red-500 mb-0.5">Important Disclaimer</div>
                <h3 className="text-lg font-black text-red-700">No Affiliation Notice</h3>
              </div>
            </div>
            <p className="text-base text-red-800 leading-relaxed font-semibold mb-3">
              This website is{" "}
              <span className="font-black text-red-900 underline underline-offset-2">not affiliated with JECRC Foundation</span>{" "}
              or any associated institution in any manner. It is an independent project developed solely for skill practice and enhancement in web technologies.
            </p>
            <p className="text-base text-red-800 leading-relaxed font-semibold mb-4">
              The portal is built to give students{" "}
              <span className="font-black text-red-900">early and convenient access to information</span>{" "}
              beyond what universities typically provide.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-4 border-t border-red-200">
              <span className="text-sm font-bold text-red-700">If you face any issues, kindly contact:</span>
              <a href="mailto:jecrc@jecrcfoundation.live" className="inline-flex items-center gap-1.5 text-sm font-extrabold text-red-600 hover:text-red-700 transition-colors underline underline-offset-2">jecrc@jecrcfoundation.live</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/70 px-5 py-5 bg-white/70 backdrop-blur-sm">
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

