import { NextRequest, NextResponse } from 'next/server';
import {
  ensureChatTables,
  getRoomState,
  moderateChatMessage,
  requireChatAuth,
  resolveChatIdentity,
  touchPresence,
  upsertChatUser,
} from '@/lib/chat';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireAdminIdentity(req: NextRequest) {
  const auth = await requireChatAuth(req);
  if (!auth) {
    return { error: NextResponse.json({ error: 'Email verification required.' }, { status: 401 }) };
  }

  await ensureChatTables();
  const identity = await resolveChatIdentity(auth.email);
  await Promise.all([upsertChatUser(identity), touchPresence(identity)]);

  if (!identity.isAdmin) {
    return { error: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  }

  return { identity };
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const access = await requireAdminIdentity(req);
  if ('error' in access) return access.error;

  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toLowerCase();

    if (action !== 'hide' && action !== 'unhide') {
      return NextResponse.json({ error: 'Invalid moderation action.' }, { status: 400 });
    }

    const message = await moderateChatMessage(access.identity, Number(id), action);
    const room = await getRoomState();
    return NextResponse.json({ message, room });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'CHAT_MESSAGE_NOT_FOUND') {
      return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    }
    if (code === 'CHAT_ADMIN_ONLY') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    console.error('[chat/messages:id:patch]', err);
    return NextResponse.json({ error: 'Failed to moderate message.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const access = await requireAdminIdentity(req);
  if ('error' in access) return access.error;

  try {
    const { id } = await context.params;
    const message = await moderateChatMessage(access.identity, Number(id), 'delete');
    const room = await getRoomState();
    return NextResponse.json({ message, room });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'CHAT_MESSAGE_NOT_FOUND') {
      return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    }
    if (code === 'CHAT_ADMIN_ONLY') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    console.error('[chat/messages:id:delete]', err);
    return NextResponse.json({ error: 'Failed to delete message.' }, { status: 500 });
  }
}
