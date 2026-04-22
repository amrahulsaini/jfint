import { NextRequest, NextResponse } from 'next/server';
import {
  createChatMessage,
  ensureChatTables,
  getRoomState,
  listMessagesSince,
  listRecentMessages,
  requireChatAuth,
  resolveChatIdentity,
  setTypingStatus,
  touchPresence,
  upsertChatUser,
} from '@/lib/chat';

export async function GET(req: NextRequest) {
  const auth = await requireChatAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Email verification required.' }, { status: 401 });
  }

  try {
    await ensureChatTables();
    const identity = await resolveChatIdentity(auth.email);
    await upsertChatUser(identity);
    await touchPresence(identity);

    const sinceIdRaw = new URL(req.url).searchParams.get('sinceId');
    const sinceId = Number.isFinite(Number(sinceIdRaw)) ? Number(sinceIdRaw) : 0;

    const [messages, room] = await Promise.all([
      sinceId > 0 ? listMessagesSince(sinceId, 240) : listRecentMessages(100),
      getRoomState(),
    ]);

    const res = NextResponse.json({ messages, room });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[chat/messages:get]', err);
    return NextResponse.json({ error: 'Failed to load chat messages.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireChatAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Email verification required.' }, { status: 401 });
  }

  try {
    await ensureChatTables();
    const identity = await resolveChatIdentity(auth.email);
    await upsertChatUser(identity);
    await touchPresence(identity);

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || '');

    if (!text.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }

    if (text.trim().length > 1200) {
      return NextResponse.json({ error: 'Message is too long. Keep it under 1200 characters.' }, { status: 400 });
    }

    const message = await createChatMessage(identity, text);
    await setTypingStatus(identity, false);
    const room = await getRoomState();

    return NextResponse.json({ message, room });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'EMPTY_MESSAGE') {
      return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
    }
    if (code === 'MESSAGE_TOO_LONG') {
      return NextResponse.json({ error: 'Message is too long. Keep it under 1200 characters.' }, { status: 400 });
    }

    console.error('[chat/messages:post]', err);
    return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
  }
}
