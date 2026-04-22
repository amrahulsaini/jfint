'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  for (const m of prev) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  
  // Sort by date instead of ID so optimistic messages stay at the bottom
  const merged = [...map.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return merged.slice(-500);
}

function Avatar({
  user,
  size = 40,
  ring = false,
}: {
  user: Pick<ChatUser, 'aliasName' | 'photoUrl' | 'isAdmin'>;
  size?: number;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-neutral-100 border ${ring ? 'border-orange-300 shadow-md shadow-orange-500/20' : 'border-neutral-200'}`}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-neutral-500">
        {user.isAdmin ? 'A' : initials(user.aliasName)}
      </span>
      {user.photoUrl && !failed && (
        <Image
          src={user.photoUrl}
          alt={user.aliasName || 'user'}
          fill
          sizes={`${size}px`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<ChatUser | null>(null);
  const [room, setRoom] = useState<ChatRoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [text, setText] = useState('');
  
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageIdRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingEnabledRef = useRef(false);
  const typingSentAtRef = useRef(0);

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
      // no-op
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
      const res = await fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typing }),
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.room) setRoom(json.room);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        const res = await fetch('/api/chat/bootstrap', { cache: 'no-store' });
        if (res.status === 401) {
          if (!cancelled) {
            setNeedsVerify(true);
            setLoading(false);
          }
          return;
        }

        const json = await res.json().catch(() => null) as BootstrapResponse | null;
        if (!res.ok || !json) {
          throw new Error((json as { error?: string } | null)?.error || 'Failed to open chat room.');
        }

        if (cancelled) return;

        setMe(json.me);
        setRoom(json.room);
        setMessages(json.messages || []);
        lastMessageIdRef.current = json.messages?.length ? json.messages[json.messages.length - 1].id : 0;
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load chat room.');
        setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTyping();
    };
  }, [stopTyping]);

  useEffect(() => {
    if (!me || needsVerify) return;

    const poll = async () => {
      try {
        const sinceId = lastMessageIdRef.current;
        const res = await fetch(`/api/chat/messages?sinceId=${sinceId}`, { cache: 'no-store' });
        if (res.status === 401) {
          setNeedsVerify(true);
          return;
        }
        if (!res.ok) return;

        const json = await res.json().catch(() => null) as {
          messages?: ChatMessage[];
          room?: ChatRoomState;
        } | null;

        if (!json) return;

        if (Array.isArray(json.messages) && json.messages.length > 0) {
          setMessages((prev) => {
            const next = mergeMessages(prev, json.messages || []);
            lastMessageIdRef.current = next.length ? next[next.length - 1].id : lastMessageIdRef.current;
            return next;
          });
        }

        if (json.room) {
          setRoom(json.room);
        }
      } catch {
        // ignore transient poll errors
      }
    };

    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [me, needsVerify]);

  useEffect(() => {
    if (!me || needsVerify) return;

    const heartbeat = async () => {
      try {
        const res = await fetch('/api/chat/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (json?.room) setRoom(json.room);
      } catch {
        // no-op
      }
    };

    heartbeat();
    const id = setInterval(heartbeat, 10000);
    return () => clearInterval(id);
  }, [me, needsVerify]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const typingNames = useMemo(() => {
    if (!room || !me) return [] as ChatUser[];
    return (room.typingUsers || []).filter((u) => u.email !== me.email);
  }, [room, me]);

  const sortedOnlineUsers = useMemo(() => {
    if (!room) return [] as ChatUser[];
    const users = [...(room.activeUsers || [])];
    users.sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return a.aliasName.localeCompare(b.aliasName);
    });
    return users;
  }, [room]);

  const handleTextChange = (value: string) => {
    setText(value);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!value.trim()) {
      stopTyping();
      return;
    }

    sendTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1800);
  };

  const handleSend = async () => {
    if (!text.trim()) return;

    const payload = text.trim();
    setText('');
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping(); // Fire and forget

    const tempId = -Date.now();
    if (me) {
      const optimisticMsg: ChatMessage = {
        id: tempId,
        text: payload,
        createdAt: new Date().toISOString(),
        sender: {
          email: me.email,
          aliasName: me.aliasName,
          photoUrl: me.photoUrl,
          isAdmin: me.isAdmin,
        },
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload }),
      });

      if (res.status === 401) {
        setNeedsVerify(true);
        return;
      }

      const json = await res.json().catch(() => null) as {
        error?: string;
        message?: ChatMessage;
        room?: ChatRoomState;
      } | null;

      if (!res.ok || !json) {
        throw new Error(json?.error || 'Failed to send message.');
      }

      if (json.message) {
        setMessages((prev) => {
          const filtered = prev.filter(m => m.id !== tempId);
          const next = mergeMessages(filtered, [json.message!]);
          lastMessageIdRef.current = Math.max(lastMessageIdRef.current, json.message.id);
          return next;
        });
      }

      if (json.room) setRoom(json.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
      setMessages((prev) => prev.filter(m => m.id !== tempId));
      setText(payload);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#fed7aa,_transparent_34%),radial-gradient(circle_at_bottom_left,_#dbeafe,_transparent_35%),linear-gradient(140deg,_#fff7ed_0%,_#ffffff_55%,_#f8fafc_100%)] text-neutral-900">
      <nav className="sticky top-0 z-40 border-b border-white/60 bg-white/70 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto h-16 px-5 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-orange-500/30">
              J
            </div>
            <span className="text-lg font-black tracking-tight text-neutral-900">JECRC<span className="text-orange-500">.</span> Chat</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/portal" className="text-xs font-black border border-neutral-200 bg-white hover:bg-orange-50 hover:border-orange-300 rounded-xl px-3 py-1.5 text-neutral-600 hover:text-orange-600 transition-colors">Portal</Link>
            <Link href="/profile" className="text-xs font-black border border-neutral-200 bg-white hover:bg-orange-50 hover:border-orange-300 rounded-xl px-3 py-1.5 text-neutral-600 hover:text-orange-600 transition-colors">Profile</Link>
            <Link href="/tracking" className="text-xs font-black border border-neutral-200 bg-white hover:bg-orange-50 hover:border-orange-300 rounded-xl px-3 py-1.5 text-neutral-600 hover:text-orange-600 transition-colors">Tracking</Link>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.replace('/portal');
              }}
              className="text-xs font-black border border-neutral-200 bg-white hover:bg-red-50 hover:border-red-300 rounded-xl px-3 py-1.5 text-neutral-600 hover:text-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="w-9 h-9 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && needsVerify && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 max-w-xl mx-auto">
            <h2 className="text-lg font-black text-orange-700">Verification Required</h2>
            <p className="text-sm font-semibold text-orange-700 mt-1">Please verify again to enter the live chat room.</p>
            <Link href="/verify?from=/chat" className="inline-flex mt-4 bg-orange-500 hover:bg-orange-400 text-white text-sm font-black px-4 py-2.5 rounded-xl transition-colors">Verify and Join Chat</Link>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-sm font-semibold text-red-600 max-w-2xl mx-auto">
            {error}
          </div>
        )}

        {!loading && !needsVerify && me && room && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_260px] gap-4">
            <aside className="order-2 lg:order-1 rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
                <h2 className="text-sm font-black text-neutral-800">Active Users</h2>
                <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                  {room.activeCount} online
                </span>
              </div>

              <div className="max-h-[62vh] overflow-y-auto p-3 space-y-2">
                {sortedOnlineUsers.length === 0 && (
                  <div className="text-xs font-semibold text-neutral-500 px-2 py-4">No active users right now.</div>
                )}

                {sortedOnlineUsers.map((user) => {
                  const mine = user.email === me.email;
                  const typing = typingNames.some((t) => t.email === user.email);

                  return (
                    <div
                      key={user.email}
                      className={`rounded-xl border px-2.5 py-2 flex items-center gap-2 ${mine ? 'bg-orange-50 border-orange-200' : 'bg-white border-neutral-200'}`}
                    >
                      <Avatar user={user} size={34} ring={mine} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-neutral-800 truncate flex items-center gap-1.5">
                          <span>{user.aliasName}</span>
                          {user.isAdmin && (
                            <span className="text-[9px] uppercase tracking-wider bg-neutral-900 text-white rounded px-1.5 py-0.5">Admin</span>
                          )}
                          {mine && (
                            <span className="text-[9px] uppercase tracking-wider bg-orange-500 text-white rounded px-1.5 py-0.5">You</span>
                          )}
                        </div>
                        <div className={`text-[10px] font-semibold ${typing ? 'text-sky-600' : 'text-neutral-400'}`}>
                          {typing ? 'typing...' : 'active'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <section className="order-1 lg:order-2 rounded-3xl border border-neutral-200 bg-white/85 backdrop-blur-sm shadow-xl shadow-neutral-900/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-neutral-100 bg-gradient-to-r from-orange-50 to-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar user={me} size={40} ring />
                  <div className="min-w-0">
                    <h1 className="text-sm md:text-base font-black text-neutral-900 truncate flex items-center gap-2">
                      {me.aliasName}
                      {me.isAdmin && <span className="text-[10px] uppercase tracking-wider bg-neutral-900 text-white rounded px-1.5 py-0.5">Admin</span>}
                    </h1>
                    <p className="text-[11px] font-semibold text-neutral-500 truncate">Live room • {room.activeCount} online</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Messages</p>
                  <p className="text-sm font-black text-neutral-800">{room.totalMessages}</p>
                </div>
              </div>

              <div className="h-[58vh] md:h-[62vh] overflow-y-auto px-4 py-4 space-y-3 bg-[linear-gradient(180deg,_rgba(255,255,255,0.8)_0%,_rgba(255,255,255,0.92)_70%,_rgba(255,255,255,1)_100%)]">
                {messages.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm font-black text-neutral-700">No messages yet</p>
                      <p className="text-xs font-semibold text-neutral-500 mt-1">Start the first conversation in this room.</p>
                    </div>
                  </div>
                )}

                {messages.map((m) => {
                  const mine = m.sender.email === me.email;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[70%] ${mine ? 'items-end' : 'items-start'} flex gap-2`}>
                        {!mine && <Avatar user={{ aliasName: m.sender.aliasName, photoUrl: m.sender.photoUrl, isAdmin: m.sender.isAdmin }} size={30} />}
                        <div>
                          {!mine && (
                            <div className="text-[11px] font-black text-neutral-500 mb-1 ml-1">
                              {m.sender.aliasName}{m.sender.isAdmin ? ' (Admin)' : ''}
                            </div>
                          )}
                          <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm border ${mine ? 'bg-orange-500 text-white border-orange-500 rounded-br-md' : 'bg-white text-neutral-800 border-neutral-200 rounded-bl-md'}`}>
                            {m.text}
                          </div>
                          <div className={`text-[10px] font-semibold text-neutral-400 mt-1 ${mine ? 'text-right mr-1' : 'ml-1'}`}>
                            {fmtTime(m.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typingNames.length > 0 && (
                  <div className="text-[11px] font-semibold text-sky-600 px-1">
                    {typingNames.slice(0, 2).map((u) => u.aliasName).join(', ')}
                    {typingNames.length > 2 ? ` +${typingNames.length - 2}` : ''} typing...
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              <div className="border-t border-neutral-100 p-3 md:p-4 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type message..."
                    rows={2}
                    className="flex-1 resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-semibold text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!text.trim()}
                    className="h-11 px-4 rounded-2xl bg-orange-500 hover:bg-orange-400 active:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black transition-colors"
                  >
                    Send
                  </button>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-neutral-400">Press Enter to send • Shift + Enter for new line</p>
              </div>
            </section>

            <aside className="order-3 rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-sm font-black text-neutral-800">Room Safety</h2>
              </div>

              <div className="p-4 space-y-3">
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-orange-600">Total Messages</p>
                  <p className="text-xl font-black text-orange-700 mt-0.5">{room.totalMessages}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Active Right Now</p>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">{room.activeCount}</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-600">Typing Users</p>
                  <p className="text-sm font-black text-sky-700 mt-0.5">{typingNames.length || 0}</p>
                  {typingNames.length > 0 && (
                    <p className="text-[11px] font-semibold text-sky-600 mt-1">{typingNames.map((u) => u.aliasName).join(', ')}</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
