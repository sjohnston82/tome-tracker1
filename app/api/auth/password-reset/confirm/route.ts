import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { passwordSchema } from "@/lib/auth/validation";
import { retryTransaction } from '@/lib/transaction-retry';
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

    const passwordHash = await hashPassword(password);
    const changed = await retryTransaction(() => prisma.$transaction(async tx => {
      const resetToken = await tx.passwordResetToken.findUnique({ where: { token } });
      if (!resetToken) return false;
      const claimed = await tx.passwordResetToken.deleteMany({ where: { id: resetToken.id, expiresAt: { gt: new Date() } } });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
      // Any other outstanding link becomes invalid once the password changes.
      await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } });
      return true;
    }, { isolationLevel: 'Serializable' }));
    if (!changed) return errorResponse('INVALID_TOKEN', 'This reset link is invalid or has expired', 400);

    return successResponse({
      message: "Password has been reset successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
