import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/validation";
import {
  successResponse,
  errorResponse,
  handleApiError,
} from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return errorResponse(
        "INVALID_CREDENTIALS",
        "Invalid email or password",
        401
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      return errorResponse(
        "INVALID_CREDENTIALS",
        "Invalid email or password",
        401
      );
    }

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
