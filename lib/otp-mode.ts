/**
 * Temporary kill-switch for the email OTP step.
 *
 * SMTP is unavailable (the jecrcfoundation.live mailbox stopped working when the
 * domain lapsed), so email passes cannot be delivered. While OTP_DISABLED is set,
 * the email step alone is enough to start a session — no code is generated or sent.
 *
 * Flip this back off (remove the env var) as soon as SMTP is working again.
 */
export function isOtpDisabled(): boolean {
  const raw = String(process.env.OTP_DISABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}
