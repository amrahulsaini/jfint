import nodemailer from 'nodemailer';

// Lazy singleton transporter
let _transport: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transport) {
    const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true' || port === 465;

    const user = String(process.env.SMTP_USER || '').trim();
    let pass = String(process.env.SMTP_PASS || '').trim();
    // Gmail app password is often copied with spaces like "abcd efgh ...".
    if (host.includes('gmail.com')) pass = pass.replace(/\s+/g, '');

    if (!user || !pass) {
      throw new Error('SMTP_USER or SMTP_PASS is missing.');
    }

    _transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }
  return _transport;
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const expMins = 60;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;max-width:480px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:28px 32px;text-align:center;">
            <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;line-height:48px;font-size:24px;font-weight:900;color:#fff;margin-bottom:12px;">J</div>
            <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">JECRC<span style="color:#fed7aa;">.</span></div>
            <div style="font-size:13px;color:#fed7aa;font-weight:600;margin-top:2px;">Internal Marks Portal</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#111827;">Hello,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              Use the access pass below to complete your sign-in. This pass is valid for <strong style="color:#111827;">${expMins} minutes</strong>.
            </p>

            <!-- OTP box -->
            <div style="background:#fff7ed;border:2px solid #fdba74;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <div style="font-size:11px;font-weight:700;color:#f97316;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:12px;">Your access pass</div>
              <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#111827;font-family:'Courier New',monospace;">${otp}</div>
            </div>

            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:12px;color:#92400e;font-weight:600;">
                Do not share this pass with anyone. JECRC Portal will never ask for it via call or chat.
              </p>
            </div>

            <p style="margin:0;font-size:13px;color:#9ca3af;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              JECRC Foundation, Jaipur &nbsp;·&nbsp; This is an automated message
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await getTransporter().sendMail({
    from,
    to,
    subject: `${otp} - Your JECRC Portal access pass`,
    html,
    text: `Your JECRC Portal access pass is: ${otp}\n\nThis pass expires in ${expMins} minutes. Do not share it with anyone.`,
  });
}
