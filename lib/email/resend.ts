import { Resend } from "resend";

const getResend = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(apiKey);
};

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<boolean> {
  try {
    const resend = getResend();

    await resend.emails.send({
      from: "Tome Tracker <noreply@yourdomain.com>",
      to: email,
      subject: "Reset your password",
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
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
