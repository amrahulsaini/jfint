import { TICKER_MESSAGES } from '@/lib/site-config';

type TopTickerProps = {
  messages?: readonly string[];
  className?: string;
};

export default function TopTicker({ messages = TICKER_MESSAGES, className = '' }: TopTickerProps) {
  const items = [...messages, ...messages];

  return (
    <div className={`sticky top-0 z-50 overflow-hidden border-b border-orange-200/80 bg-[#fff7ed]/95 backdrop-blur-xl ${className}`}>
      <div className="ticker-track flex min-w-max items-center gap-4 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-orange-700 sm:text-xs">
        {items.map((message, index) => (
          <div key={`${message}-${index}`} className="flex items-center gap-4 whitespace-nowrap">
            <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.55)]" />
            <span>{message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
