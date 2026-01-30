import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { emailSchema } from "@/lib/auth/validation";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { successResponse, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = emailSchema.parse(body.email);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Find user (but don't reveal if they exist)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Delete any existing tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });

      // Create new token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Send email
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl);
    }

    // Always return success to prevent email enumeration
    return successResponse({
      message: "If an account exists, a reset email has been sent",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
