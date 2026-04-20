'use client';

import { useState, useEffect } from 'react';

export default function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: string, minutes: string, seconds: string } | null>(null);

  useEffect(() => {
    setIsOpen(true);
    
    // Target date: April 24, 2026, 00:00:00 Local time
    const target = new Date('2026-04-24T00:00:00').getTime();
    
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5 flex flex-col md:flex-row transition-all duration-300 scale-100 opacity-100">
        <div className="hidden md:flex flex-col justify-center items-center w-1/3 bg-gradient-to-br from-orange-500 to-red-600 p-8 text-white relative overflow-hidden">
          <svg className="w-20 h-20 mb-4 text-white/90 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-black tracking-tight text-center relative z-10">Important Update</h2>
        </div>
        
        <div className="flex-1 p-6 md:p-8 relative">
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="md:hidden flex items-center gap-3 mb-4 text-orange-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-black tracking-tight">Important Update</h2>
          </div>

          <h3 className="text-xl md:text-2xl font-black text-neutral-900 mb-2 leading-tight">
            Results Announcement
          </h3>
          <p className="text-neutral-600 font-medium mb-6 leading-relaxed">
            Hey! The results of the <span className="font-bold text-neutral-900">1st</span> and <span className="font-bold text-neutral-900">3rd Semester</span> are likely to be announced on our website in:
          </p>

          <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 mb-6">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest text-center mb-3">Estimated Time Remaining</div>
            <div className="flex justify-center gap-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white border border-neutral-200 rounded-xl shadow-sm flex items-center justify-center text-2xl font-black text-orange-600 tabular-nums">
                  {timeLeft.hours}
                </div>
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mt-2">Hours</div>
              </div>
              <div className="text-2xl font-black text-neutral-300 self-start mt-4">:</div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white border border-neutral-200 rounded-xl shadow-sm flex items-center justify-center text-2xl font-black text-orange-600 tabular-nums">
                  {timeLeft.minutes}
                </div>
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mt-2">Minutes</div>
              </div>
              <div className="text-2xl font-black text-neutral-300 self-start mt-4">:</div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white border border-neutral-200 rounded-xl shadow-sm flex items-center justify-center text-2xl font-black text-orange-600 tabular-nums">
                  {timeLeft.seconds}
                </div>
                <div className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mt-2">Seconds</div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsOpen(false)}
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3.5 rounded-xl transition-all duration-200 shadow-md shadow-neutral-900/20 active:scale-[0.98]"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}
