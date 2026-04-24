'use client';

import { useState, useEffect } from 'react';

export default function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: string, minutes: string, seconds: string } | null>(null);
  const RESULT_COUNTDOWN_MS = 72 * 60 * 60 * 1000;

  useEffect(() => {
    setIsOpen(true);
    
    // Show a rolling 72-hour announcement countdown.
    const target = Date.now() + RESULT_COUNTDOWN_MS;
    
    const updateTimer = () => {
      const now = Date.now();
      const diff = target - now;
      
      if (diff <= 0) {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
        return;
      }
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft({ 
        hours: h.toString().padStart(2, '0'), 
        minutes: m.toString().padStart(2, '0'), 
        seconds: s.toString().padStart(2, '0') 
      });
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen || !timeLeft) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-2 sm:p-4 bg-neutral-900/60 backdrop-blur-md">
      <div className="relative w-full max-w-2xl max-h-[94dvh] sm:max-h-[90vh] bg-white rounded-t-[24px] sm:rounded-[24px] overflow-y-auto shadow-2xl ring-1 ring-black/5 flex flex-col md:flex-row transition-all duration-300 scale-100 opacity-100">
        <div className="hidden md:flex flex-col justify-center items-center w-[40%] bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <svg className="w-24 h-24 mb-6 text-white/90 drop-shadow-2xl transform hover:scale-105 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-3xl font-black tracking-tight text-center relative z-10 leading-none">Important<br/>Update</h2>
        </div>
        
        <div className="flex-1 p-5 sm:p-8 md:p-10 relative bg-white">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="md:hidden flex items-center gap-3 mb-5 text-orange-600">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-black tracking-tight">Important Update</h2>
          </div>

          <h3 className="text-2xl md:text-3xl font-black text-neutral-900 mb-3 leading-tight tracking-tight">
            Results Announcement
          </h3>
          <p className="text-neutral-500 font-semibold mb-8 leading-relaxed">
            Hey! The results of the <span className="font-black text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded">1st</span> and <span className="font-black text-neutral-800 bg-neutral-100 px-1.5 py-0.5 rounded">3rd Semester</span> are likely to be announced on our website in:
          </p>

          <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200/80 rounded-[20px] p-4 sm:p-6 mb-8 shadow-inner">
            <div className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.15em] text-center mb-5">Estimated Time Remaining</div>
            <div className="flex justify-center gap-2 sm:gap-5">
              <div className="flex flex-col items-center group cursor-default">
                <div className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] bg-white border border-neutral-200 rounded-[18px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_16px_rgba(249,115,22,0.15)] group-hover:border-orange-300 transition-all duration-300 flex items-center justify-center text-2xl sm:text-3xl font-black text-orange-600 tabular-nums">
                  {timeLeft.hours}
                </div>
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-3 group-hover:text-orange-500 transition-colors">Hours</div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-neutral-300 self-start mt-4 animate-pulse">:</div>
              <div className="flex flex-col items-center group cursor-default">
                <div className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] bg-white border border-neutral-200 rounded-[18px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_16px_rgba(249,115,22,0.15)] group-hover:border-orange-300 transition-all duration-300 flex items-center justify-center text-2xl sm:text-3xl font-black text-orange-600 tabular-nums">
                  {timeLeft.minutes}
                </div>
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-3 group-hover:text-orange-500 transition-colors">Minutes</div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-neutral-300 self-start mt-4 animate-pulse">:</div>
              <div className="flex flex-col items-center group cursor-default">
                <div className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] bg-white border border-neutral-200 rounded-[18px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_16px_rgba(249,115,22,0.15)] group-hover:border-orange-300 transition-all duration-300 flex items-center justify-center text-2xl sm:text-3xl font-black text-orange-600 tabular-nums">
                  {timeLeft.seconds}
                </div>
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-3 group-hover:text-orange-500 transition-colors">Seconds</div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsOpen(false)}
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-black py-4 rounded-[16px] text-lg transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.3)] active:scale-[0.98] hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.4)]"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
