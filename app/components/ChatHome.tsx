'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopTicker from '@/app/components/TopTicker';
import {
  CHAT_DISCLAIMER_ITEMS,
  MAIN_CHAT_PATH,
  SITE_CONTACT_EMAIL,
} from '@/lib/site-config';

interface ChatUser {
  email: string;
  aliasName: string;
  firstName: string;
  photoUrl: string | null;
  isAdmin: boolean;
  lastSeen?: string | null;
}

interface ChatMessage {
  id: number;
  text: string;
  createdAt: string;
  hidden: boolean;
  hiddenAt?: string | null;
  hiddenByEmail?: string | null;
  deleted: boolean;
  deletedAt?: string | null;
  deletedByEmail?: string | null;
  sender: {
    email: string;
    aliasName: string;
    photoUrl: string | null;
    isAdmin: boolean;
  };
}

interface ChatRoomState {
  activeCount: number;
  totalMessages: number;
  activeUsers: ChatUser[];
  typingUsers: ChatUser[];
}

interface BootstrapResponse {
  me: ChatUser;
  messages: ChatMessage[];
  room: ChatRoomState;
  serverNow: string;
}

function fmtTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function initials(name: string): string {
  const cleaned = String(name || '').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function mergeMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return prev;
  const map = new Map<number, ChatMessage>();
  for (const message of prev) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return [...map.values()]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-500);
}

function maxServerMessageId(messages: ChatMessage[]): number {
  let maxId = 0;
  for (const message of messages) {
    if (message.id > 0 && message.id > maxId) {
      maxId = message.id;
    }
  }
  return maxId;
}

function Avatar({
  user,
  size = 40,
  highlight = false,
}: {
  user: Pick<ChatUser, 'aliasName' | 'photoUrl' | 'isAdmin'>;
  size?: number;
  highlight?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border ${
        highlight
          ? 'border-orange-300 bg-orange-50 shadow-[0_10px_24px_-12px_rgba(249,115,22,0.65)]'
          : 'border-white/80 bg-white'
      }`}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-neutral-500">
        {initials(user.aliasName || (user.isAdmin ? 'Admin' : '?'))}
      </span>
      {user.photoUrl && !failed && (
        <Image
          src={user.photoUrl}
          alt={user.aliasName || 'student'}
          fill
          sizes={`${size}px`}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function ChatHome() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<ChatUser | null>(null);
  const [room, setRoom] = useState<ChatRoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');

  const [showNoticeDialog, setShowNoticeDialog] = useState(false);
  const [revealedHiddenIds, setRevealedHiddenIds] = useState<Record<number, boolean>>({});
  const [moderationMode, setModerationMode] = useState(true);
  const [pendingModerationKey, setPendingModerationKey] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageIdRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingEnabledRef = useRef(false);
  const typingSentAtRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const heartbeatInFlightRef = useRef(false);
  const copiedEmailTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(async () => {
    if (!typingEnabledRef.current) return;
    typingEnabledRef.current = false;
    typingSentAtRef.current = Date.now();
    try {
      await fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typing: false }),
      });
    } catch {
      // Ignore transient presence failures.
    }
  }, []);

  const sendTyping = useCallback(async (typing: boolean) => {
    const now = Date.now();

    if (typing) {
      if (typingEnabledRef.current && now - typingSentAtRef.current < 1500) return;
      typingEnabledRef.current = true;
      typingSentAtRef.current = now;
    } else {
      if (!typingEnabledRef.current) return;
      typingEnabledRef.current = false;
      typingSentAtRef.current = now;
    }

    try {
      const response = await fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typing }),
      });
      if (!response.ok) return;
      const json = await response.json().catch(() => null);
      if (json?.room) {
        setRoom(json.room);
      }
    } catch {
      // Ignore transient presence failures.
    }
  }, []);

  const syncMessages = useCallback(async () => {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;

    try {
      const response = await fetch('/api/chat/messages', { cache: 'no-store' });
      if (response.status === 401) {
        setNeedsVerify(true);
        return;
      }
      if (!response.ok) return;

      const json = await response.json().catch(() => null) as {
        messages?: ChatMessage[];
        room?: ChatRoomState;
      } | null;

      if (!json) return;

      if (Array.isArray(json.messages)) {
        lastMessageIdRef.current = Math.max(lastMessageIdRef.current, maxServerMessageId(json.messages));
        setMessages((prev) => mergeMessages(prev, json.messages || []));
      }

      if (json.room) {
        setRoom(json.room);
      }
    } catch {
      // Ignore transient poll failures.
    } finally {
      pollInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.sessionStorage.getItem('jfint-chat-notice-seen');
    if (!seen) {
      setShowNoticeDialog(true);
      window.sessionStorage.setItem('jfint-chat-notice-seen', '1');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        const response = await fetch('/api/chat/bootstrap', { cache: 'no-store' });
        if (response.status === 401) {
          if (!cancelled) {
            setNeedsVerify(true);
            setLoading(false);
          }
          return;
        }

        const json = await response.json().catch(() => null) as BootstrapResponse | null;
        if (!response.ok || !json) {
          throw new Error((json as { error?: string } | null)?.error || 'Failed to open the live room.');
        }

        if (cancelled) return;

        setMe(json.me);
        setRoom(json.room);
        setMessages(json.messages || []);
        lastMessageIdRef.current = maxServerMessageId(json.messages || []);
        setLoading(false);
      } catch (bootstrapError) {
        if (cancelled) return;
        setError(bootstrapError instanceof Error ? bootstrapError.message : 'Failed to load the live room.');
        setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (copiedEmailTimeoutRef.current) clearTimeout(copiedEmailTimeoutRef.current);
      stopTyping();
    };
  }, [stopTyping]);

  useEffect(() => {
    if (!me || needsVerify) return;
    const id = setInterval(() => {
      void syncMessages();
    }, 1200);
    return () => clearInterval(id);
  }, [me, needsVerify, syncMessages]);

  useEffect(() => {
    if (!me || needsVerify) return;

    const heartbeat = async () => {
      if (heartbeatInFlightRef.current) return;
      heartbeatInFlightRef.current = true;
      try {
        const response = await fetch('/api/chat/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!response.ok) return;
        const json = await response.json().catch(() => null);
        if (json?.room) {
          setRoom(json.room);
        }
      } catch {
        // Ignore transient presence failures.
      } finally {
        heartbeatInFlightRef.current = false;
      }
    };

    void heartbeat();
    const id = setInterval(() => {
      void heartbeat();
    }, 6000);
    return () => clearInterval(id);
  }, [me, needsVerify]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const typingUsers = useMemo(() => {
    if (!room || !me) return [] as ChatUser[];
    return (room.typingUsers || []).filter((user) => user.email !== me.email);
  }, [room, me]);

  const onlineUsers = useMemo(() => {
    if (!room) return [] as ChatUser[];
    const users = [...(room.activeUsers || [])];
    users.sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return a.aliasName.localeCompare(b.aliasName);
    });
    return users;
  }, [room]);

  const hiddenCount = useMemo(() => messages.filter((message) => message.hidden).length, [messages]);
  const deletedCount = useMemo(() => messages.filter((message) => message.deleted).length, [messages]);

  const handleTextChange = (value: string) => {
    setText(value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (!value.trim()) {
      void stopTyping();
      return;
    }

    void sendTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      void stopTyping();
    }, 1800);
  };

  const handleSend = async () => {
    if (!text.trim()) return;

    const payload = text.trim();
    setText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    void stopTyping();

    const tempId = -Date.now();
    if (me) {
      const optimisticMessage: ChatMessage = {
        id: tempId,
        text: payload,
        createdAt: new Date().toISOString(),
        hidden: false,
        hiddenAt: null,
        hiddenByEmail: null,
        deleted: false,
        deletedAt: null,
        deletedByEmail: null,
        sender: {
          email: me.email,
          aliasName: me.aliasName,
          photoUrl: me.photoUrl,
          isAdmin: me.isAdmin,
        },
      };
      setMessages((prev) => [...prev, optimisticMessage]);
    }

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload }),
      });

      if (response.status === 401) {
        setNeedsVerify(true);
        return;
      }

      const json = await response.json().catch(() => null) as {
        error?: string;
        message?: ChatMessage;
        room?: ChatRoomState;
      } | null;

      if (!response.ok || !json) {
        throw new Error(json?.error || 'Failed to send the message.');
      }

      if (json.message) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((message) => message.id !== tempId);
          lastMessageIdRef.current = Math.max(lastMessageIdRef.current, json.message?.id || 0);
          return mergeMessages(withoutTemp, [json.message]);
        });
      }

      if (json.room) {
        setRoom(json.room);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send the message.');
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setText(payload);
    }
  };

  const moderateMessage = async (messageId: number, action: 'hide' | 'unhide' | 'delete') => {
    const key = `${messageId}:${action}`;
    setPendingModerationKey(key);
    setError(null);

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: action === 'delete' ? undefined : { 'Content-Type': 'application/json' },
        body: action === 'delete' ? undefined : JSON.stringify({ action }),
      });

      const json = await response.json().catch(() => null) as {
        error?: string;
        message?: ChatMessage;
        room?: ChatRoomState;
      } | null;

      if (!response.ok || !json?.message) {
        throw new Error(json?.error || 'Failed to moderate the message.');
      }

      setMessages((prev) => mergeMessages(prev, [json.message as ChatMessage]));
      if (json.room) {
        setRoom(json.room);
      }
    } catch (moderationError) {
      setError(moderationError instanceof Error ? moderationError.message : 'Failed to moderate the message.');
    } finally {
      setPendingModerationKey(null);
    }
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      if (copiedEmailTimeoutRef.current) {
        clearTimeout(copiedEmailTimeoutRef.current);
      }
      copiedEmailTimeoutRef.current = setTimeout(() => {
        setCopiedEmail(null);
      }, 1600);
    } catch {
      setError('Could not copy the sender email on this device.');
    }
  };

  return (
    <div className="min-h-[100dvh] ui-aurora text-neutral-900">
      <TopTicker />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="absolute -left-20 top-20 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute right-0 top-12 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="absolute left-1/3 top-40 h-40 w-40 rounded-full bg-amber-300/15 blur-3xl" />
      </div>

      {showNoticeDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-neutral-950/50 p-3 backdrop-blur-md">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-[0_30px_90px_-30px_rgba(15,23,42,0.55)]">
            <div className="grid gap-0 md:grid-cols-[0.92fr_1.08fr]">
              <div className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_30%),linear-gradient(160deg,#ea580c_0%,#f97316_55%,#fb923c_100%)] p-6 text-white md:p-8">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),transparent_42%,rgba(255,255,255,0.05)_60%,transparent_70%)]" />
                <div className="relative">
                  <div className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-orange-50">
                    Live Update
                  </div>
                  <h2 className="font-display text-3xl font-black leading-tight tracking-[-0.04em]">
                    The main website is now the live chat room.
                  </h2>
                  <p className="mt-4 max-w-sm text-sm font-semibold text-orange-50/90">
                    Use this room to request marks, student info, or support while the public portal keeps sensitive data hidden for now.
                  </p>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <button
                  onClick={() => setShowNoticeDialog(false)}
                  className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                      Temporary Hold
                    </div>
                    <p className="mt-1 text-sm font-semibold text-amber-900">
                      Marks and detailed student info are hidden for now.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                      Need Access
                    </div>
                    <p className="mt-2 text-sm font-semibold text-neutral-700">
                      Mail <span className="font-black text-neutral-900">{SITE_CONTACT_EMAIL}</span> or drop a request here in chat.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                      Community Notice
                    </div>
                    <p className="mt-2 text-sm font-semibold text-sky-900">
                      Hidden messages can still be revealed by users if they choose, but deleted messages are removed from the conversation view.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => setShowNoticeDialog(false)}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-black text-white transition-colors hover:bg-neutral-800"
                  >
                    Enter Chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="sticky top-[34px] z-40 border-b border-white/60 bg-white/80 shadow-[0_16px_36px_-26px_rgba(15,23,42,0.5)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push(MAIN_CHAT_PATH)}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 font-black text-lg text-white shadow-[0_16px_36px_-18px_rgba(249,115,22,0.85)]">
              J
            </div>
            <div>
              <div className="font-display text-lg font-black tracking-[-0.04em] text-neutral-950 sm:text-xl">
                JECRC<span className="text-orange-500">.</span> Live
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-400">
                Main Website Chat
              </div>
            </div>
          </button>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Link
              href="/profile"
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-700 transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:text-neutral-950"
            >
              Profile
            </Link>
            <Link
              href="/tracking"
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-700 transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:text-neutral-950"
            >
              Tracking
            </Link>
            {me && (
              <button
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  router.replace(MAIN_CHAT_PATH);
                }}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 text-xs font-black text-red-600 transition-all hover:-translate-y-0.5 hover:bg-red-100"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="ui-rise overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(140deg,rgba(255,255,255,0.88),rgba(255,255,255,0.68))] shadow-[0_26px_90px_-42px_rgba(15,23,42,0.42)] backdrop-blur-xl">
          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_340px] xl:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-orange-700">
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.6)]" />
                Live room on the homepage
              </div>
              <div className="space-y-3">
                <h1 className="font-display text-3xl font-black tracking-[-0.05em] text-neutral-950 sm:text-4xl lg:text-[3.2rem]">
                  Student requests, updates, and support now happen right here.
                </h1>
                <p className="max-w-3xl text-sm font-semibold leading-7 text-neutral-600 sm:text-base">
                  The main website now opens the live chat directly. Results stay separated under the portal, and detailed marks or student info are temporarily hidden until access is requested.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Live People</div>
                  <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-neutral-950">
                    {room?.activeCount ?? 0}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">Students and admins online now.</p>
                </div>
                <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Messages</div>
                  <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-neutral-950">
                    {room?.totalMessages ?? 0}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">Conversation history in the room.</p>
                </div>
                <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-500">Need Records</div>
                  <div className="mt-2 text-sm font-black text-orange-900">
                    Request in chat or by mail
                  </div>
                  <p className="mt-1 text-xs font-semibold text-orange-700">{SITE_CONTACT_EMAIL}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[28px] border border-neutral-200/80 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Always Running Notice</div>
                    <h2 className="mt-1 font-display text-xl font-black tracking-[-0.04em] text-neutral-950">
                      Marks and info are hidden for now.
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowNoticeDialog(true)}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 text-xs font-black text-neutral-700 transition-colors hover:border-orange-300 hover:text-orange-600"
                  >
                    Read Notice
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
                  If anyone wants to see anything, kindly drop a mail to <span className="font-black text-neutral-900">{SITE_CONTACT_EMAIL}</span> or post a request in this chat room.
                </p>
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <div className="flex items-center justify-center rounded-[28px] border border-white/60 bg-white/70 px-6 py-20 shadow-sm backdrop-blur-xl">
            <div className="h-10 w-10 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && needsVerify && (
          <div className="rounded-[28px] border border-orange-200 bg-orange-50 px-6 py-7 shadow-sm">
            <div className="max-w-2xl">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">Verification Required</div>
              <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em] text-orange-950">
                Verify your college email to enter the live room.
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-orange-800">
                The room is limited to verified <span className="font-black">@jecrc.ac.in</span> users.
              </p>
              <Link
                href="/verify?from=/"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-5 text-sm font-black text-white transition-colors hover:bg-orange-400"
              >
                Verify and Join
              </Link>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !needsVerify && me && room && (
          <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <aside className="order-2 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-sm backdrop-blur-xl xl:order-1">
              <div className="border-b border-neutral-100/80 bg-white/70 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Active Users</div>
                    <h2 className="mt-1 font-display text-lg font-black tracking-[-0.04em] text-neutral-950">
                      Room Presence
                    </h2>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700">
                    {room.activeCount} online
                  </span>
                </div>
              </div>

              <div className="space-y-2 px-3 py-3">
                {onlineUsers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-xs font-semibold text-neutral-500">
                    Nobody is active right now.
                  </div>
                )}

                {onlineUsers.map((user) => {
                  const isYou = user.email === me.email;
                  const isTyping = typingUsers.some((typingUser) => typingUser.email === user.email);

                  return (
                    <div
                      key={user.email}
                      className={`rounded-[22px] border px-3 py-3 transition-colors ${
                        isYou
                          ? 'border-orange-200 bg-orange-50/80'
                          : 'border-white/80 bg-white/90 hover:border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar user={user} size={42} highlight={isYou} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-black text-neutral-900">{user.aliasName}</span>
                            {user.isAdmin && (
                              <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white">
                                Admin
                              </span>
                            )}
                            {isYou && (
                              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white">
                                You
                              </span>
                            )}
                          </div>
                          <div className={`mt-1 text-[11px] font-semibold ${isTyping ? 'text-sky-600' : 'text-neutral-400'}`}>
                            {isTyping ? 'typing...' : 'active'}
                          </div>
                          {me.isAdmin && (
                            <div className="mt-1 truncate text-[10px] font-semibold text-neutral-400">
                              {user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="order-1 overflow-hidden rounded-[30px] border border-white/70 bg-white/80 shadow-[0_24px_90px_-44px_rgba(15,23,42,0.48)] backdrop-blur-xl xl:order-2">
              <div className="border-b border-neutral-100/80 bg-[linear-gradient(130deg,rgba(255,247,237,0.95),rgba(255,255,255,0.9))] px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar user={me} size={48} highlight />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-display text-xl font-black tracking-[-0.04em] text-neutral-950">
                          {me.aliasName}
                        </h2>
                        {me.isAdmin && (
                          <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                            Admin Desk
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold text-neutral-500">
                        Use this room for requests, moderation, and live updates.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-black text-orange-700">
                      {room.totalMessages} total
                    </span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-700">
                      {typingUsers.length} typing
                    </span>
                    {me.isAdmin && (
                      <button
                        onClick={() => setModerationMode((value) => !value)}
                        className={`inline-flex h-10 items-center justify-center rounded-2xl border px-4 text-xs font-black transition-colors ${
                          moderationMode
                            ? 'border-neutral-950 bg-neutral-950 text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:text-neutral-950'
                        }`}
                      >
                        {moderationMode ? 'Moderation On' : 'Moderation Off'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-b border-neutral-100 bg-white/80 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  {CHAT_DISCLAIMER_ITEMS.map((item) => (
                    <span
                      key={item}
                      className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold leading-5 text-neutral-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="h-[54vh] overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.94)_55%,rgba(255,255,255,1))] px-4 py-4 sm:h-[58vh] sm:px-5">
                {messages.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-orange-500">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5l-2 2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
                      </svg>
                    </div>
                    <h3 className="mt-4 font-display text-xl font-black tracking-[-0.04em] text-neutral-950">
                      The room is quiet right now.
                    </h3>
                    <p className="mt-2 max-w-sm text-sm font-semibold text-neutral-500">
                      Start the first message and let students know how to request hidden marks or info.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {messages.map((message) => {
                    const isMine = message.sender.email === me.email;
                    const showHiddenText = me.isAdmin || Boolean(revealedHiddenIds[message.id]);
                    const shouldShowText = !message.hidden || showHiddenText;
                    const moderationKeyPrefix = `${message.id}:`;
                    const emailCopied = copiedEmail === message.sender.email;

                    return (
                      <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[92%] gap-3 sm:max-w-[80%] ${isMine ? 'flex-row-reverse' : ''}`}>
                          {!isMine && (
                            <Avatar
                              user={{
                                aliasName: message.sender.aliasName,
                                photoUrl: message.sender.photoUrl,
                                isAdmin: message.sender.isAdmin,
                              }}
                              size={34}
                            />
                          )}

                          <div className={`${isMine ? 'items-end' : 'items-start'} flex min-w-0 flex-1 flex-col`}>
                            {!isMine && (
                              <div className="mb-1 flex flex-wrap items-center gap-1.5 px-1">
                                <span className="text-[11px] font-black text-neutral-600">{message.sender.aliasName}</span>
                                {message.sender.isAdmin && (
                                  <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white">
                                    Admin
                                  </span>
                                )}
                                {me.isAdmin && (
                                  <button
                                    onClick={() => void copyEmail(message.sender.email)}
                                    className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-900"
                                  >
                                    {emailCopied ? 'Copied' : 'Copy Email'}
                                  </button>
                                )}
                              </div>
                            )}

                            {message.deleted ? (
                              <div className={`rounded-[22px] border border-neutral-200 bg-neutral-100 px-4 py-3 text-[13px] font-semibold text-neutral-500 ${isMine ? 'rounded-br-[8px]' : 'rounded-bl-[8px]'}`}>
                                Admin deleted this message.
                              </div>
                            ) : message.hidden && !shouldShowText ? (
                              <div className={`rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 shadow-sm ${isMine ? 'rounded-br-[8px]' : 'rounded-bl-[8px]'}`}>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                                  Message Hidden
                                </div>
                                <p className="mt-1 text-sm font-semibold">
                                  Admin hid this message. Want to see it?
                                </p>
                                <button
                                  onClick={() => {
                                    setRevealedHiddenIds((prev) => ({ ...prev, [message.id]: true }));
                                  }}
                                  className="mt-3 inline-flex h-9 items-center justify-center rounded-xl bg-amber-500 px-3 text-xs font-black text-white transition-colors hover:bg-amber-400"
                                >
                                  Yes, show it
                                </button>
                              </div>
                            ) : (
                              <div
                                className={`rounded-[24px] border px-4 py-3 text-[13px] leading-6 shadow-sm ${
                                  isMine
                                    ? 'rounded-br-[8px] border-orange-500 bg-[linear-gradient(150deg,#f97316,#ea580c)] text-white shadow-[0_20px_40px_-24px_rgba(234,88,12,0.9)]'
                                    : 'rounded-bl-[8px] border-white/80 bg-white text-neutral-800'
                                }`}
                              >
                                {message.hidden && (
                                  <div className={`mb-2 text-[10px] font-black uppercase tracking-[0.18em] ${isMine ? 'text-orange-100' : 'text-amber-600'}`}>
                                    Hidden by admin
                                  </div>
                                )}
                                <p className="whitespace-pre-wrap break-words">{message.text}</p>
                                {message.hidden && !me.isAdmin && (
                                  <button
                                    onClick={() => {
                                      setRevealedHiddenIds((prev) => ({ ...prev, [message.id]: false }));
                                    }}
                                    className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                      isMine
                                        ? 'bg-white/15 text-white'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    Hide Again
                                  </button>
                                )}
                              </div>
                            )}

                            <div className={`mt-1.5 flex flex-wrap items-center gap-2 px-1 text-[10px] font-semibold text-neutral-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <span>{fmtTime(message.createdAt)}</span>
                              {message.hidden && !message.deleted && (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-700">
                                  Hidden
                                </span>
                              )}
                              {message.deleted && (
                                <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-neutral-500">
                                  Deleted
                                </span>
                              )}
                            </div>

                            {me.isAdmin && moderationMode && (
                              <div className={`mt-2 flex flex-wrap gap-2 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                {!message.deleted && (
                                  <button
                                    onClick={() => void moderateMessage(message.id, message.hidden ? 'unhide' : 'hide')}
                                    disabled={pendingModerationKey === `${moderationKeyPrefix}${message.hidden ? 'unhide' : 'hide'}`}
                                    className="inline-flex h-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {message.hidden ? 'Unhide' : 'Hide'}
                                  </button>
                                )}
                                <button
                                  onClick={() => void moderateMessage(message.id, 'delete')}
                                  disabled={message.deleted || pendingModerationKey === `${moderationKeyPrefix}delete`}
                                  className="inline-flex h-8 items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {typingUsers.length > 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-700">
                    <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
                    {typingUsers.slice(0, 2).map((user) => user.aliasName).join(', ')}
                    {typingUsers.length > 2 ? ` +${typingUsers.length - 2}` : ''} typing...
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="border-t border-neutral-100/80 bg-white/90 px-4 py-4 sm:px-5">
                <div className="rounded-[24px] border border-orange-200 bg-orange-50/70 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">
                    Request Channel
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-orange-900">
                    Need marks or hidden student info? Post the request here or mail {SITE_CONTACT_EMAIL}.
                  </p>
                </div>

                <div className="mt-3 flex items-end gap-3">
                  <textarea
                    value={text}
                    onChange={(event) => handleTextChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Type a request, update, or moderation note..."
                    rows={2}
                    className="min-h-[56px] flex-1 resize-none rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-800 outline-none transition-colors placeholder:text-neutral-400 focus:border-orange-400 focus:bg-white"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={!text.trim()}
                    className="inline-flex h-12 items-center justify-center rounded-[20px] bg-orange-500 px-5 text-sm font-black text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  Enter sends. Shift plus Enter adds a new line.
                </p>
              </div>
            </section>

            <aside className="order-3 grid gap-4">
              <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-sm backdrop-blur-xl">
                <div className="border-b border-neutral-100/80 bg-white/70 px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Room Safety</div>
                  <h2 className="mt-1 font-display text-lg font-black tracking-[-0.04em] text-neutral-950">
                    Disclaimers
                  </h2>
                </div>

                <div className="space-y-3 px-4 py-4">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600">Temporary Hold</div>
                    <p className="mt-1 text-sm font-semibold text-orange-900">
                      Public marks and student info are hidden for now.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Independent Project</div>
                    <p className="mt-1 text-sm font-semibold text-neutral-700">
                      This room is community-run and not an official institutional channel.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Hidden Message Rule</div>
                    <p className="mt-1 text-sm font-semibold text-sky-900">
                      Hidden messages can be voluntarily revealed by users. Deleted messages stay removed from the room view.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-sm backdrop-blur-xl">
                <div className="border-b border-neutral-100/80 bg-white/70 px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Live Stats</div>
                  <h2 className="mt-1 font-display text-lg font-black tracking-[-0.04em] text-neutral-950">
                    Room Snapshot
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3 px-4 py-4">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Online</div>
                    <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-neutral-950">{room.activeCount}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Typing</div>
                    <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-neutral-950">{typingUsers.length}</div>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Hidden</div>
                    <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-amber-900">{hiddenCount}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-100 px-3 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Deleted</div>
                    <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-neutral-700">{deletedCount}</div>
                  </div>
                </div>
              </div>

              {me.isAdmin && (
                <div className="overflow-hidden rounded-[28px] border border-white/70 bg-neutral-950 text-white shadow-[0_26px_70px_-40px_rgba(15,23,42,0.92)]">
                  <div className="border-b border-white/10 px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Admin Tools</div>
                    <h2 className="mt-1 font-display text-lg font-black tracking-[-0.04em] text-white">
                      Moderation Controls
                    </h2>
                  </div>

                  <div className="space-y-3 px-4 py-4 text-sm font-semibold text-neutral-200">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      Hide a message to replace it with a reveal prompt for users.
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      Unhide any hidden message instantly from moderation mode.
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      Delete a message to remove its text and leave a deleted placeholder.
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      Copy sender emails directly from message headers for follow-up.
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
