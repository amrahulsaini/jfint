import crypto from 'crypto';

const secret = () => process.env.OTP_SECRET!;

export const PAID_COOKIE = 'jfint_paid';
const ENTRY_TTL_MS = 4 * 60 * 60 * 1000; // 4h server-side backup (cookie itself is session-only)

/** Internal cookie entry — r = roll_no, '*' = all-access (coupon) */
interface PaidEntry { r: string; exp: number; }

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex');
}

function encode(entries: PaidEntry[]): string {
  const payload = Buffer.from(JSON.stringify(entries)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(value: string): PaidEntry[] | null {
  const dot = value.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(payload);
  try {
    const eBuf = Buffer.from(expected, 'hex');
    const sBuf = Buffer.from(sig, 'hex');
    if (eBuf.length !== sBuf.length || !crypto.timingSafeEqual(eBuf, sBuf)) return null;
  } catch { return null; }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PaidEntry[];
  } catch { return null; }
}

/**
 * Add a roll_no (or '*' for all-access via coupon) to the paid cookie.
 * Returns the new cookie string value.
 */
export function addPaidEntry(currentCookie: string | undefined, rollNo: string): string {
  const entries = currentCookie ? (decode(currentCookie) ?? []) : [];
  const now = Date.now();
  // Remove expired entries and any existing entry for the same roll
  const filtered = entries.filter(e => e.exp > now && e.r !== rollNo);
  filtered.push({ r: rollNo, exp: now + ENTRY_TTL_MS });
  return encode(filtered);
}

/** Returns true if rollNo is paid (or wildcard '*' access exists and is not expired) */
export function isRollNoPaid(cookieValue: string | undefined, rollNo: string): boolean {
  if (!cookieValue) return false;
  const entries = decode(cookieValue);
  if (!entries) return false;
  const now = Date.now();
  return entries.some(e => e.exp > now && (e.r === rollNo || e.r === '*'));
}

/** Decode all non-expired entries (for status API) */
export function getPaidEntries(cookieValue: string | undefined): PaidEntry[] {
  if (!cookieValue) return [];
  const entries = decode(cookieValue);
  if (!entries) return [];
  const now = Date.now();
  return entries.filter(e => e.exp > now);
}
