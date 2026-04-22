import { NextRequest, NextResponse } from 'next/server';
import {
  ensureChatTables,
  getRoomState,
  listRecentMessages,
  publicIdentity,
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
    await setTypingStatus(identity, false);

    const [messages, room] = await Promise.all([
      listRecentMessages(100),
      getRoomState(),
    ]);

    const res = NextResponse.json({
      me: publicIdentity(identity),
      messages,
      room,
      serverNow: new Date().toISOString(),
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[chat/bootstrap]', err);
    return NextResponse.json({ error: 'Failed to load chat.' }, { status: 500 });
  }
}
