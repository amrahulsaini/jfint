'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ChatFab() {
  const pathname = usePathname();
  if (pathname === '/' || pathname === '/chat') return null;

  return (
    <Link href="/" className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-[0_0_22px_rgba(249,115,22,0.5)] transition-all duration-300 hover:scale-110 active:scale-95 group sm:bottom-6 sm:right-6">
      <svg className="w-6 h-6 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
      </span>
    </Link>
  );
}
