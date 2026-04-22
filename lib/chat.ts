import type { ResultSetHeader } from 'mysql2';
import { NextRequest } from 'next/server';
import { getPool } from '@/lib/db';
import { getActiveSessionRecord, SESSION_COOKIE, verifySessionToken } from '@/lib/session';

const VERIFIED_COOKIE = 'jfint_student_verified';
export const CHAT_ADMIN_EMAIL = 'rahulsaini.cse28@jecrc.ac.in';

const ACTIVE_WINDOW_SECONDS = 120;
const TYPING_WINDOW_SECONDS = 8;

let ensureTablesPromise: Promise<void> | null = null;

type DictRow = Record<string, unknown>;

export interface ChatIdentity {
  email: string;
  aliasName: string;
  firstName: string;
  rollNo: string | null;
  photoUrl: string | null;
  isAdmin: boolean;
}

export interface ChatUserSummary {
  email: string;
  aliasName: string;
  firstName: string;
  photoUrl: string | null;
  isAdmin: boolean;
  lastSeen?: string | null;
}

export interface ChatMessage {
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

export interface ChatRoomState {
  activeCount: number;
  totalMessages: number;
  activeUsers: ChatUserSummary[];
  typingUsers: ChatUserSummary[];
}

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function extractFirstName(name: string, email: string): string {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ');
  if (cleaned) return cleaned.split(' ')[0];
  const local = String(email || '').split('@')[0] || 'Student';
  const token = local.split(/[._\-\d]+/).filter(Boolean)[0] || local;
  if (!token) return 'Student';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function normalizeRoll(value: string): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /ER_NO_SUCH_TABLE|doesn't exist/i.test(msg);
}

async function findUserByEmail(
  table: string,
  emailColumn: string,
  fields: string,
  email: string,
): Promise<DictRow | null> {
  const pool = getPool();
  try {
    const [rows] = await pool.query(
      `SELECT ${fields}
       FROM \`${table}\`
       WHERE LOWER(TRIM(COALESCE(\`${emailColumn}\`, ''))) = LOWER(TRIM(?))
       LIMIT 1`,
      [email],
    ) as [unknown[], unknown];
    const row = (rows as DictRow[])[0];
    return row ?? null;
  } catch (err) {
    if (isMissingTableError(err)) return null;
    throw err;
  }
}

function rowValue(row: DictRow | null, key: string): string {
  if (!row) return '';
  return String(row[key] ?? '').trim();
}

function toChatUserSummary(row: {
  email: string;
  alias_name: string;
  photo_url: string | null;
  is_admin: number;
  last_seen?: Date | null;
}): ChatUserSummary {
  return {
    email: normalizeEmail(row.email),
    aliasName: String(row.alias_name || ''),
    firstName: extractFirstName(String(row.alias_name || ''), String(row.email || '')),
    photoUrl: row.photo_url ? String(row.photo_url) : null,
    isAdmin: Number(row.is_admin) === 1,
    lastSeen: row.last_seen ? row.last_seen.toISOString() : null,
  };
}

function toChatMessage(row: {
  id: number;
  sender_email: string;
  sender_alias: string;
  sender_photo_url: string | null;
  sender_is_admin: number;
  message_text: string;
  created_at: Date;
}): ChatMessage {
  return {
    id: Number(row.id),
    text: String(row.message_text || ''),
    createdAt: row.created_at.toISOString(),
    sender: {
      email: normalizeEmail(row.sender_email),
      aliasName: String(row.sender_alias || ''),
      photoUrl: row.sender_photo_url ? String(row.sender_photo_url) : null,
      isAdmin: Number(row.sender_is_admin) === 1,
    },
  };
}

export async function requireChatAuth(req: NextRequest): Promise<{ email: string } | null> {
  const verifiedEmail = normalizeEmail(req.cookies.get(VERIFIED_COOKIE)?.value || '');
  if (!verifiedEmail || !verifiedEmail.endsWith('@jecrc.ac.in')) return null;

  const sidCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = sidCookie ? verifySessionToken(sidCookie) : null;
  if (!sessionId) return null;

  const session = await getActiveSessionRecord(sessionId).catch(() => null);
  const sessionEmail = normalizeEmail(session?.email || '');
  if (!session || !sessionEmail || sessionEmail !== verifiedEmail) return null;

  return { email: verifiedEmail };
}

export async function ensureChatTables(): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      const pool = getPool();

      await pool.query(
        `CREATE TABLE IF NOT EXISTS chat_users (
          email VARCHAR(255) PRIMARY KEY,
          alias_name VARCHAR(80) NOT NULL,
          first_name VARCHAR(80) NOT NULL,
          roll_no VARCHAR(64) DEFAULT NULL,
          photo_url VARCHAR(255) DEFAULT NULL,
          is_admin TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_chat_users_roll (roll_no),
          KEY idx_chat_users_admin (is_admin)
        )`,
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS chat_messages (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          sender_email VARCHAR(255) NOT NULL,
          sender_alias VARCHAR(80) NOT NULL,
          sender_photo_url VARCHAR(255) DEFAULT NULL,
          sender_is_admin TINYINT(1) NOT NULL DEFAULT 0,
          message_text TEXT NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_chat_messages_created (created_at),
          KEY idx_chat_messages_sender (sender_email)
        )`,
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS chat_presence (
          email VARCHAR(255) PRIMARY KEY,
          alias_name VARCHAR(80) NOT NULL,
          photo_url VARCHAR(255) DEFAULT NULL,
          is_admin TINYINT(1) NOT NULL DEFAULT 0,
          last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_chat_presence_seen (last_seen)
        )`,
      );

      await pool.query(
        `CREATE TABLE IF NOT EXISTS chat_typing (
          email VARCHAR(255) PRIMARY KEY,
          alias_name VARCHAR(80) NOT NULL,
          is_admin TINYINT(1) NOT NULL DEFAULT 0,
          last_typing_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_chat_typing_last (last_typing_at)
        )`,
      );
    })();
  }

  await ensureTablesPromise;
}

export async function resolveChatIdentity(email: string): Promise<ChatIdentity> {
  const normalizedEmail = normalizeEmail(email);
  const isAdmin = normalizedEmail === normalizeEmail(CHAT_ADMIN_EMAIL);

  if (isAdmin) {
    return {
      email: normalizedEmail,
      aliasName: 'Admin',
      firstName: 'Admin',
      rollNo: null,
      photoUrl: null,
      isAdmin: true,
    };
  }

  const row3rd = await findUserByEmail(
    '2428main',
    'student_emailid',
    '`roll_no`, `student_name`',
    normalizedEmail,
  );

  if (row3rd) {
    const rollNo = rowValue(row3rd, 'roll_no');
    const fullName = rowValue(row3rd, 'student_name');
    const firstName = extractFirstName(fullName, normalizedEmail);
    const rollForPhoto = normalizeRoll(rollNo);
    return {
      email: normalizedEmail,
      aliasName: firstName,
      firstName,
      rollNo: rollNo || null,
      photoUrl: rollForPhoto ? `/student_photos/photo_${rollForPhoto}.jpg` : null,
      isAdmin: false,
    };
  }

  const row1st = await findUserByEmail(
    '2528allinfo',
    'student_email',
    '`earlier_enrollment_no`, `entrance_exam_roll_no`, `applicant_name`',
    normalizedEmail,
  );

  if (row1st) {
    const rollNo = rowValue(row1st, 'earlier_enrollment_no') || rowValue(row1st, 'entrance_exam_roll_no');
    const fullName = rowValue(row1st, 'applicant_name');
    const firstName = extractFirstName(fullName, normalizedEmail);
    const rollForPhoto = normalizeRoll(rollNo);
    return {
      email: normalizedEmail,
      aliasName: firstName,
      firstName,
      rollNo: rollNo || null,
      photoUrl: rollForPhoto ? `/1styearphotos/photo_${rollForPhoto}.jpg` : null,
      isAdmin: false,
    };
  }

  const fallbackName = extractFirstName('', normalizedEmail);
  return {
    email: normalizedEmail,
    aliasName: fallbackName,
    firstName: fallbackName,
    rollNo: null,
    photoUrl: null,
    isAdmin: false,
  };
}

export async function upsertChatUser(identity: ChatIdentity): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO chat_users (email, alias_name, first_name, roll_no, photo_url, is_admin)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       alias_name = VALUES(alias_name),
       first_name = VALUES(first_name),
       roll_no = VALUES(roll_no),
       photo_url = VALUES(photo_url),
       is_admin = VALUES(is_admin)`,
    [
      identity.email,
      identity.aliasName,
      identity.firstName,
      identity.rollNo,
      identity.photoUrl,
      identity.isAdmin ? 1 : 0,
    ],
  );
}

export async function touchPresence(identity: ChatIdentity): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO chat_presence (email, alias_name, photo_url, is_admin, last_seen)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       alias_name = VALUES(alias_name),
       photo_url = VALUES(photo_url),
       is_admin = VALUES(is_admin),
       last_seen = NOW()`,
    [identity.email, identity.aliasName, identity.photoUrl, identity.isAdmin ? 1 : 0],
  );
}

export async function setTypingStatus(identity: ChatIdentity, isTyping: boolean): Promise<void> {
  const pool = getPool();
  if (!isTyping) {
    await pool.query('DELETE FROM chat_typing WHERE email = ?', [identity.email]);
    return;
  }

  await pool.query(
    `INSERT INTO chat_typing (email, alias_name, is_admin, last_typing_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       alias_name = VALUES(alias_name),
       is_admin = VALUES(is_admin),
       last_typing_at = NOW()`,
    [identity.email, identity.aliasName, identity.isAdmin ? 1 : 0],
  );
}

export async function createChatMessage(identity: ChatIdentity, text: string): Promise<ChatMessage> {
  const cleaned = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!cleaned) throw new Error('EMPTY_MESSAGE');
  if (cleaned.length > 1200) throw new Error('MESSAGE_TOO_LONG');

  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO chat_messages (sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text)
     VALUES (?, ?, ?, ?, ?)`,
    [identity.email, identity.aliasName, identity.photoUrl, identity.isAdmin ? 1 : 0, cleaned],
  ) as [ResultSetHeader, unknown];

  const insertId = Number(result.insertId || 0);
  const [rows] = await pool.query(
    `SELECT id, sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text, created_at
     FROM chat_messages
     WHERE id = ?
     LIMIT 1`,
    [insertId],
  ) as [unknown[], unknown];

  const row = (rows as Array<{
    id: number;
    sender_email: string;
    sender_alias: string;
    sender_photo_url: string | null;
    sender_is_admin: number;
    message_text: string;
    created_at: Date;
  }>)[0];

  if (!row) {
    return {
      id: insertId,
      text: cleaned,
      createdAt: new Date().toISOString(),
      sender: {
        email: identity.email,
        aliasName: identity.aliasName,
        photoUrl: identity.photoUrl,
        isAdmin: identity.isAdmin,
      },
    };
  }

  return toChatMessage(row);
}

export async function listRecentMessages(limit = 80): Promise<ChatMessage[]> {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 300));
  const [rows] = await pool.query(
    `SELECT id, sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text, created_at
     FROM chat_messages
     ORDER BY id DESC
     LIMIT ?`,
    [safeLimit],
  ) as [unknown[], unknown];

  const mapped = (rows as Array<{
    id: number;
    sender_email: string;
    sender_alias: string;
    sender_photo_url: string | null;
    sender_is_admin: number;
    message_text: string;
    created_at: Date;
  }>).map(toChatMessage);

  mapped.reverse();
  return mapped;
}

export async function listMessagesSince(sinceId: number, limit = 200): Promise<ChatMessage[]> {
  const pool = getPool();
  const safeSince = Number.isFinite(sinceId) ? Math.max(0, Math.floor(sinceId)) : 0;
  const safeLimit = Math.max(1, Math.min(limit, 300));

  const [rows] = await pool.query(
    `SELECT id, sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text, created_at
     FROM chat_messages
     WHERE id > ?
     ORDER BY id ASC
     LIMIT ?`,
    [safeSince, safeLimit],
  ) as [unknown[], unknown];

  return (rows as Array<{
    id: number;
    sender_email: string;
    sender_alias: string;
    sender_photo_url: string | null;
    sender_is_admin: number;
    message_text: string;
    created_at: Date;
  }>).map(toChatMessage);
}

export async function getRoomState(): Promise<ChatRoomState> {
  const pool = getPool();

  await pool.query(
    `DELETE FROM chat_presence
     WHERE last_seen < (NOW() - INTERVAL ${ACTIVE_WINDOW_SECONDS * 5} SECOND)`,
  );
  await pool.query(
    `DELETE FROM chat_typing
     WHERE last_typing_at < (NOW() - INTERVAL ${TYPING_WINDOW_SECONDS * 6} SECOND)`,
  );

  const [presenceRows] = await pool.query(
    `SELECT email, alias_name, photo_url, is_admin, last_seen
     FROM chat_presence
     WHERE last_seen >= (NOW() - INTERVAL ${ACTIVE_WINDOW_SECONDS} SECOND)
     ORDER BY is_admin DESC, alias_name ASC
     LIMIT 300`,
  ) as [unknown[], unknown];

  const [typingRows] = await pool.query(
    `SELECT email, alias_name, is_admin
     FROM chat_typing
     WHERE last_typing_at >= (NOW() - INTERVAL ${TYPING_WINDOW_SECONDS} SECOND)
     ORDER BY is_admin DESC, alias_name ASC
     LIMIT 120`,
  ) as [unknown[], unknown];

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM chat_messages`,
  ) as [unknown[], unknown];

  const activeUsers = (presenceRows as Array<{
    email: string;
    alias_name: string;
    photo_url: string | null;
    is_admin: number;
    last_seen: Date | null;
  }>).map(toChatUserSummary);

  const typingUsers = (typingRows as Array<{
    email: string;
    alias_name: string;
    is_admin: number;
  }>).map((row) => ({
    email: normalizeEmail(row.email),
    aliasName: String(row.alias_name || ''),
    firstName: extractFirstName(String(row.alias_name || ''), String(row.email || '')),
    photoUrl: null,
    isAdmin: Number(row.is_admin) === 1,
  }));

  const totalMessages = Number((countRows as Array<{ total: number }>)[0]?.total || 0);

  return {
    activeCount: activeUsers.length,
    totalMessages,
    activeUsers,
    typingUsers,
  };
}

export function publicIdentity(identity: ChatIdentity): ChatUserSummary {
  return {
    email: identity.email,
    aliasName: identity.aliasName,
    firstName: identity.firstName,
    photoUrl: identity.photoUrl,
    isAdmin: identity.isAdmin,
  };
}
