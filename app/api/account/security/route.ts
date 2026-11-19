import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, createSession } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { emailSchema, passwordSchema } from '@/lib/auth/validation';
import { checkRateLimit, errorResponse, handleApiError, successResponse } from '@/lib/api/response';
const schema = z.object({ currentPassword: z.string().min(1).max(1024), email: emailSchema.optional(), newPassword: passwordSchema.refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 UTF-8 bytes').optional() }).refine(x => !!x.email || !!x.newPassword, 'Enter a new email or password.');
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return errorResponse("FORBIDDEN", "Use the account form on this site.", 403);
    if (!checkRateLimit(`account-security:${session.userId}`, 5, 15 * 60 * 1000).allowed) return errorResponse('RATE_LIMITED', 'Too many attempts. Try again in 15 minutes.', 429);
    const input = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !await verifyPassword(input.currentPassword, user.passwordHash)) return errorResponse('INVALID_PASSWORD', 'Your current password is incorrect.', 403);
    const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : user.passwordHash;
    const updated = await prisma.$transaction(async tx => {
      // Concurrent password changes must not accept an outdated credential.
      const result = await tx.user.updateMany({ where: { id: user.id, passwordHash: user.passwordHash }, data: { email: input.email ?? user.email, passwordHash } });
      if (result.count !== 1) throw new Error('Unauthorized');
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      return { id: user.id, email: input.email ?? user.email, role: user.role };
    });
    await createSession(updated);
    return successResponse({ email: updated.email, message: 'Account details updated.' });
  } catch (error) { return handleApiError(error); }
}
