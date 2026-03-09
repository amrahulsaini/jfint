import crypto from 'crypto';

const secret = () => process.env.OTP_SECRET!; // reuse same signing secret

const PAID_COOKIE = 'jfint_paid';
const PAID_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Creates a signed value for the jfint_paid cookie */
export function createPaidCookie(): string {
  const exp = Date.now() + PAID_TTL_MS;
  const payload = `${exp}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** Validates the jfint_paid cookie. Returns true if valid and not expired. */
export function validatePaidCookie(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot === -1) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('hex');
  // timing-safe compare
  try {
    const eBuf = Buffer.from(expected, 'hex');
    const sBuf = Buffer.from(sig, 'hex');
    if (eBuf.length !== sBuf.length) return false;
    if (!crypto.timingSafeEqual(eBuf, sBuf)) return false;
  } catch {
    return false;
  }
  const exp = parseInt(payload, 10);
  return Date.now() < exp;
}

export { PAID_COOKIE };
