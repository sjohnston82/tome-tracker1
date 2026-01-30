import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { passwordSchema } from "@/lib/auth/validation";
import {
  successResponse,
  errorResponse,
  handleApiError,
} from "@/lib/api/response";

const confirmSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = confirmSchema.parse(body);

    // Find valid token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return errorResponse(
        "INVALID_TOKEN",
        "This reset link is invalid or has expired",
        400
      );
    }

    if (resetToken.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      return errorResponse(
        "INVALID_TOKEN",
        "This reset link is invalid or has expired",
        400
      );
    }

    // Update password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: await hashPassword(password) },
    });

    // Delete token
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });

    return successResponse({
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
