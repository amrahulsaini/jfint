import { NextRequest, NextResponse } from 'next/server';
import {
  ensureChatTables,
  getRoomState,
  requireChatAuth,
  resolveChatIdentity,
  setTypingStatus,
  touchPresence,
  upsertChatUser,
} from '@/lib/chat';

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
    const typing = typeof body?.typing === 'boolean' ? body.typing : null;

    if (typing !== null) {
      await setTypingStatus(identity, typing);
    }

    const room = await getRoomState();
    const res = NextResponse.json({ ok: true, room });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[chat/presence]', err);
    return NextResponse.json({ error: 'Failed to update room presence.' }, { status: 500 });
  }
}
