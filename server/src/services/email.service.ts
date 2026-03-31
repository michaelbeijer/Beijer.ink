import { Resend } from 'resend';
import { config } from '../config.js';

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    if (!config.resendApiKey) throw new Error('RESEND_API_KEY is not set');
    resend = new Resend(config.resendApiKey);
  }
  return resend;
}

export async function sendPasswordResetEmail(resetUrl: string) {
  await getResend().emails.send({
    from: 'Beijer.ink <onboarding@resend.dev>',
    to: config.adminEmail,
    subject: 'Beijer.ink — Password Reset',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0f172a; margin-bottom: 16px;">Password Reset</h2>
        <p style="color: #475569; line-height: 1.6;">
          A password reset was requested for your Beijer.ink account.
          Click the button below to set a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; margin: 24px 0; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
          Reset Password
        </a>
        <p style="color: #94a3b8; font-size: 14px;">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
