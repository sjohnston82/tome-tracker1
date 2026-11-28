import { Resend } from "resend";
import { getPasswordResetEmailConfig } from './config';

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<boolean> {
  try {
    const config = getPasswordResetEmailConfig();
    if (!config) return false;
    const resend = new Resend(config.apiKey);

    const { data, error } = await resend.emails.send({
      from: `Tome Tracker <${config.from}>`,
      to: email,
      subject: "Reset your password",
      text: `Reset your Tome Tracker password: ${resetUrl}\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h1 style="color: #333;">Password Reset Request</h1>
            <p>You requested to reset your password. Click the link below:</p>
            <p>
              <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">
              This link expires in 1 hour.
            </p>
            <p style="color: #666; font-size: 14px;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </body>
        </html>
      `,
    });
    if (error || !data?.id) {
      console.error('Password reset email was not accepted by the email provider');
      return false;
    }
    return true;
  } catch {
    // Provider errors may contain recipients, API keys, or the reset URL.
    console.error("Password reset email delivery failed");
    return false;
  }
}
