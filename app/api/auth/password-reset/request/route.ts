import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { emailSchema } from "@/lib/auth/validation";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { getPasswordResetEmailConfig } from '@/lib/email/config';
import { successResponse, errorResponse, handleApiError, checkRateLimit } from "@/lib/api/response";
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = emailSchema.parse(body.email);

    const config = getPasswordResetEmailConfig();
    // Report global setup problems identically for existing and unknown emails.
    if (!config) return errorResponse('EMAIL_UNAVAILABLE', 'Password reset email is currently unavailable. Please contact the app owner.', 503);
    const key = createHash('sha256').update(email).digest('hex');
    if (!checkRateLimit(`password-reset:${key}`, 5, 60 * 60 * 1000).allowed) return errorResponse('RATE_LIMITED', 'Too many reset requests. Please try again later.', 429);

    // Find user (but don't reveal if they exist)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Create new token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const record = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Send email
      const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
      const sent = await sendPasswordResetEmail(email, resetUrl);
      if (!sent) {
        // Keep previous usable links, including an administrator recovery link.
        await prisma.passwordResetToken.deleteMany({ where: { id: record.id } });
      }
    }

    // Always return success to prevent email enumeration
    return successResponse({
      message: "If an account exists, a reset email has been requested. Check your inbox and spam folder.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
