import type { ResultSetHeader } from 'mysql2';
import { NextRequest } from 'next/server';
import { cacheGetJson, cacheGetString, cacheIncrement, cacheSetJson } from '@/lib/cache';
import { getPool } from '@/lib/db';
import { getActiveSessionRecord, SESSION_COOKIE, verifySessionToken } from '@/lib/session';

const VERIFIED_COOKIE = 'jfint_student_verified';
export const CHAT_ADMIN_EMAIL = 'rahulsaini.cse28@jecrc.ac.in';

const ACTIVE_WINDOW_SECONDS = 120;
const TYPING_WINDOW_SECONDS = 8;
const IST_OFFSET_MINUTES = 330;
const CHAT_IDENTITY_CACHE_TTL_SECONDS = 15 * 60;
const CHAT_RECENT_CACHE_TTL_SECONDS = 2;
const CHAT_SINCE_CACHE_TTL_SECONDS = 1;
const CHAT_ROOM_CACHE_TTL_SECONDS = 2;
const CHAT_MESSAGE_VERSION_KEY = 'chat:messages:version';
const CHAT_ROOM_VERSION_KEY = 'chat:room:version';

let ensureTablesPromise: Promise<void> | null = null;

type DictRow = Record<string, unknown>;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function formatIstDateTime(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = pad2(shifted.getUTCMonth() + 1);
  const dd = pad2(shifted.getUTCDate());
  const hh = pad2(shifted.getUTCHours());
  const mi = pad2(shifted.getUTCMinutes());
  const ss = pad2(shifted.getUTCSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function nowIstDateTime(): string {
  return formatIstDateTime(new Date());
}

function istDateTimeFromNow(secondsDelta: number): string {
  return formatIstDateTime(new Date(Date.now() + secondsDelta * 1000));
}

function parseIstDateTimeToIso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();

  const raw = String(value).trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs).toISOString();
}

async function getCacheVersion(key: string): Promise<number> {
  const raw = await cacheGetString(key);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function bumpCacheVersion(key: string): Promise<void> {
  await cacheIncrement(key);
}

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

export function isChatAdminEmail(email: string): boolean {
  return normalizeEmail(email) === normalizeEmail(CHAT_ADMIN_EMAIL);
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
  last_seen?: string | Date | null;
}): ChatUserSummary {
  return {
    email: normalizeEmail(row.email),
    aliasName: String(row.alias_name || ''),
    firstName: extractFirstName(String(row.alias_name || ''), String(row.email || '')),
    photoUrl: row.photo_url ? String(row.photo_url) : null,
    isAdmin: Number(row.is_admin) === 1,
    lastSeen: row.last_seen ? parseIstDateTimeToIso(row.last_seen) : null,
  };
}

function toChatMessage(row: {
  id: number;
  sender_email: string;
  sender_alias: string;
  sender_photo_url: string | null;
  sender_is_admin: number;
  message_text: string;
  created_at: string | Date;
  hidden_at?: string | Date | null;
  hidden_by_email?: string | null;
  deleted_at?: string | Date | null;
  deleted_by_email?: string | null;
}): ChatMessage {
  const deleted = Boolean(row.deleted_at);
  return {
    id: Number(row.id),
    text: deleted ? '' : String(row.message_text || ''),
    createdAt: parseIstDateTimeToIso(row.created_at),
    hidden: Boolean(row.hidden_at) && !deleted,
    hiddenAt: row.hidden_at ? parseIstDateTimeToIso(row.hidden_at) : null,
    hiddenByEmail: row.hidden_by_email ? normalizeEmail(row.hidden_by_email) : null,
    deleted,
    deletedAt: row.deleted_at ? parseIstDateTimeToIso(row.deleted_at) : null,
    deletedByEmail: row.deleted_by_email ? normalizeEmail(row.deleted_by_email) : null,
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
          hidden_at DATETIME DEFAULT NULL,
          hidden_by_email VARCHAR(255) DEFAULT NULL,
          deleted_at DATETIME DEFAULT NULL,
          deleted_by_email VARCHAR(255) DEFAULT NULL,
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

      await pool.query(
        'ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS hidden_at DATETIME DEFAULT NULL',
      );
      await pool.query(
        'ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS hidden_by_email VARCHAR(255) DEFAULT NULL',
      );
      await pool.query(
        'ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL',
      );
      await pool.query(
        'ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_by_email VARCHAR(255) DEFAULT NULL',
      );
    })();
  }

  await ensureTablesPromise;
}

export async function resolveChatIdentity(email: string): Promise<ChatIdentity> {
  const normalizedEmail = normalizeEmail(email);
  const identityCacheKey = `chat:identity:${normalizedEmail}`;
  const cachedIdentity = await cacheGetJson<ChatIdentity>(identityCacheKey);
  if (cachedIdentity && normalizeEmail(cachedIdentity.email) === normalizedEmail) {
    return cachedIdentity;
  }

  const isAdmin = isChatAdminEmail(normalizedEmail);
  let resolved: ChatIdentity;

  if (isAdmin) {
    resolved = {
      email: normalizedEmail,
      aliasName: 'Admin',
      firstName: 'Admin',
      rollNo: null,
      photoUrl: null,
      isAdmin: true,
    };
    await cacheSetJson(identityCacheKey, resolved, CHAT_IDENTITY_CACHE_TTL_SECONDS);
    return resolved;
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
    resolved = {
      email: normalizedEmail,
      aliasName: firstName,
      firstName,
      rollNo: rollNo || null,
      photoUrl: rollForPhoto ? `/student_photos/photo_${rollForPhoto}.jpg` : null,
      isAdmin: false,
    };
    await cacheSetJson(identityCacheKey, resolved, CHAT_IDENTITY_CACHE_TTL_SECONDS);
    return resolved;
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
    resolved = {
      email: normalizedEmail,
      aliasName: firstName,
      firstName,
      rollNo: rollNo || null,
      photoUrl: rollForPhoto ? `/1styearphotos/photo_${rollForPhoto}.jpg` : null,
      isAdmin: false,
    };
    await cacheSetJson(identityCacheKey, resolved, CHAT_IDENTITY_CACHE_TTL_SECONDS);
    return resolved;
  }

  const fallbackName = extractFirstName('', normalizedEmail);
  resolved = {
    email: normalizedEmail,
    aliasName: fallbackName,
    firstName: fallbackName,
    rollNo: null,
    photoUrl: null,
    isAdmin: false,
  };
  await cacheSetJson(identityCacheKey, resolved, CHAT_IDENTITY_CACHE_TTL_SECONDS);
  return resolved;
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
  const nowIst = nowIstDateTime();
  await pool.query(
    `INSERT INTO chat_presence (email, alias_name, photo_url, is_admin, last_seen)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       alias_name = VALUES(alias_name),
       photo_url = VALUES(photo_url),
       is_admin = VALUES(is_admin),
       last_seen = VALUES(last_seen)`,
    [identity.email, identity.aliasName, identity.photoUrl, identity.isAdmin ? 1 : 0, nowIst],
  );
}

export async function setTypingStatus(identity: ChatIdentity, isTyping: boolean): Promise<void> {
  const pool = getPool();
  if (!isTyping) {
    await pool.query('DELETE FROM chat_typing WHERE email = ?', [identity.email]);
    await bumpCacheVersion(CHAT_ROOM_VERSION_KEY);
    return;
  }

  const nowIst = nowIstDateTime();
  await pool.query(
    `INSERT INTO chat_typing (email, alias_name, is_admin, last_typing_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       alias_name = VALUES(alias_name),
       is_admin = VALUES(is_admin),
       last_typing_at = VALUES(last_typing_at)`,
    [identity.email, identity.aliasName, identity.isAdmin ? 1 : 0, nowIst],
  );
  await bumpCacheVersion(CHAT_ROOM_VERSION_KEY);
}

export async function createChatMessage(identity: ChatIdentity, text: string): Promise<ChatMessage> {
  const cleaned = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!cleaned) throw new Error('EMPTY_MESSAGE');
  if (cleaned.length > 1200) throw new Error('MESSAGE_TOO_LONG');

  const createdAtIst = nowIstDateTime();
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO chat_messages (sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [identity.email, identity.aliasName, identity.photoUrl, identity.isAdmin ? 1 : 0, cleaned, createdAtIst],
  ) as [ResultSetHeader, unknown];

  const insertId = Number(result.insertId || 0);
  await Promise.all([
    bumpCacheVersion(CHAT_MESSAGE_VERSION_KEY),
    bumpCacheVersion(CHAT_ROOM_VERSION_KEY),
  ]);

  return {
    id: insertId,
    text: cleaned,
    createdAt: parseIstDateTimeToIso(createdAtIst),
    sender: {
      email: identity.email,
      aliasName: identity.aliasName,
      photoUrl: identity.photoUrl,
      isAdmin: identity.isAdmin,
    },
  };
}

export async function listRecentMessages(limit = 80): Promise<ChatMessage[]> {
  const safeLimit = Math.max(1, Math.min(limit, 300));
  const messageVersion = await getCacheVersion(CHAT_MESSAGE_VERSION_KEY);
  const cacheKey = `chat:messages:recent:${safeLimit}:v${messageVersion}`;
  const cached = await cacheGetJson<ChatMessage[]>(cacheKey);
  if (cached) return cached;

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(hidden_at, '%Y-%m-%d %H:%i:%s') AS hidden_at,
            hidden_by_email,
            DATE_FORMAT(deleted_at, '%Y-%m-%d %H:%i:%s') AS deleted_at,
            deleted_by_email
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
    created_at: string;
    hidden_at: string | null;
    hidden_by_email: string | null;
    deleted_at: string | null;
    deleted_by_email: string | null;
  }>).map(toChatMessage);

  mapped.reverse();
  await cacheSetJson(cacheKey, mapped, CHAT_RECENT_CACHE_TTL_SECONDS);
  return mapped;
}

export async function listMessagesSince(sinceId: number, limit = 200): Promise<ChatMessage[]> {
  const safeSince = Number.isFinite(sinceId) ? Math.max(0, Math.floor(sinceId)) : 0;
  const safeLimit = Math.max(1, Math.min(limit, 300));
  const messageVersion = await getCacheVersion(CHAT_MESSAGE_VERSION_KEY);
  const cacheKey = `chat:messages:since:${safeSince}:limit:${safeLimit}:v${messageVersion}`;
  const cached = await cacheGetJson<ChatMessage[]>(cacheKey);
  if (cached) return cached;

  const pool = getPool();

  const [rows] = await pool.query(
    `SELECT id, sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(hidden_at, '%Y-%m-%d %H:%i:%s') AS hidden_at,
            hidden_by_email,
            DATE_FORMAT(deleted_at, '%Y-%m-%d %H:%i:%s') AS deleted_at,
            deleted_by_email
     FROM chat_messages
     WHERE id > ?
     ORDER BY id ASC
     LIMIT ?`,
    [safeSince, safeLimit],
  ) as [unknown[], unknown];

  const mapped = (rows as Array<{
    id: number;
    sender_email: string;
    sender_alias: string;
    sender_photo_url: string | null;
    sender_is_admin: number;
    message_text: string;
    created_at: string;
    hidden_at: string | null;
    hidden_by_email: string | null;
    deleted_at: string | null;
    deleted_by_email: string | null;
  }>).map(toChatMessage);

  await cacheSetJson(cacheKey, mapped, CHAT_SINCE_CACHE_TTL_SECONDS);
  return mapped;
}

export async function getRoomState(): Promise<ChatRoomState> {
  const roomVersion = await getCacheVersion(CHAT_ROOM_VERSION_KEY);
  const secondBucket = Math.floor(Date.now() / 1000);
  const cacheKey = `chat:room:v${roomVersion}:t${secondBucket}`;
  const cached = await cacheGetJson<ChatRoomState>(cacheKey);
  if (cached) return cached;

  const pool = getPool();

  const prunePresenceCutoff = istDateTimeFromNow(-(ACTIVE_WINDOW_SECONDS * 5));
  const pruneTypingCutoff = istDateTimeFromNow(-(TYPING_WINDOW_SECONDS * 6));
  const activeCutoff = istDateTimeFromNow(-ACTIVE_WINDOW_SECONDS);
  const typingCutoff = istDateTimeFromNow(-TYPING_WINDOW_SECONDS);

  await pool.query(
    `DELETE FROM chat_presence
     WHERE last_seen < ?`,
    [prunePresenceCutoff],
  );
  await pool.query(
    `DELETE FROM chat_typing
     WHERE last_typing_at < ?`,
    [pruneTypingCutoff],
  );

  const [presenceRows] = await pool.query(
    `SELECT email, alias_name, photo_url, is_admin,
            DATE_FORMAT(last_seen, '%Y-%m-%d %H:%i:%s') AS last_seen
     FROM chat_presence
     WHERE last_seen >= ?
     ORDER BY is_admin DESC, alias_name ASC
     LIMIT 300`,
    [activeCutoff],
  ) as [unknown[], unknown];

  const [typingRows] = await pool.query(
    `SELECT email, alias_name, is_admin
     FROM chat_typing
     WHERE last_typing_at >= ?
     ORDER BY is_admin DESC, alias_name ASC
     LIMIT 120`,
    [typingCutoff],
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
    last_seen: string | null;
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

  const state = {
    activeCount: activeUsers.length,
    totalMessages,
    activeUsers,
    typingUsers,
  };

  await cacheSetJson(cacheKey, state, CHAT_ROOM_CACHE_TTL_SECONDS);
  return state;
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

async function loadChatMessageById(messageId: number): Promise<ChatMessage | null> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, sender_email, sender_alias, sender_photo_url, sender_is_admin, message_text,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(hidden_at, '%Y-%m-%d %H:%i:%s') AS hidden_at,
            hidden_by_email,
            DATE_FORMAT(deleted_at, '%Y-%m-%d %H:%i:%s') AS deleted_at,
            deleted_by_email
     FROM chat_messages
     WHERE id = ?
     LIMIT 1`,
    [messageId],
  ) as [unknown[], unknown];

  const row = (rows as Array<{
    id: number;
    sender_email: string;
    sender_alias: string;
    sender_photo_url: string | null;
    sender_is_admin: number;
    message_text: string;
    created_at: string;
    hidden_at: string | null;
    hidden_by_email: string | null;
    deleted_at: string | null;
    deleted_by_email: string | null;
  }>)[0];

  return row ? toChatMessage(row) : null;
}

export async function moderateChatMessage(
  identity: ChatIdentity,
  messageId: number,
  action: 'hide' | 'unhide' | 'delete',
): Promise<ChatMessage> {
  if (!identity.isAdmin) {
    throw new Error('CHAT_ADMIN_ONLY');
  }

  const safeMessageId = Number.isFinite(messageId) ? Math.floor(messageId) : 0;
  if (safeMessageId <= 0) {
    throw new Error('CHAT_MESSAGE_NOT_FOUND');
  }

  const pool = getPool();
  const nowIst = nowIstDateTime();

  if (action === 'hide') {
    await pool.query(
      `UPDATE chat_messages
       SET hidden_at = ?, hidden_by_email = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [nowIst, identity.email, safeMessageId],
    );
  } else if (action === 'unhide') {
    await pool.query(
      `UPDATE chat_messages
       SET hidden_at = NULL, hidden_by_email = NULL
       WHERE id = ? AND deleted_at IS NULL`,
      [safeMessageId],
    );
  } else if (action === 'delete') {
    await pool.query(
      `UPDATE chat_messages
       SET deleted_at = ?, deleted_by_email = ?, hidden_at = NULL, hidden_by_email = NULL
       WHERE id = ?`,
      [nowIst, identity.email, safeMessageId],
    );
  } else {
    throw new Error('CHAT_INVALID_ACTION');
  }

  const updated = await loadChatMessageById(safeMessageId);
  if (!updated) {
    throw new Error('CHAT_MESSAGE_NOT_FOUND');
  }

  await Promise.all([
    bumpCacheVersion(CHAT_MESSAGE_VERSION_KEY),
    bumpCacheVersion(CHAT_ROOM_VERSION_KEY),
  ]);

  return updated;
}
