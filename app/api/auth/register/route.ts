import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/auth/validation";
import {
  successResponse,
  errorResponse,
  handleApiError,
} from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = registerSchema.parse(body);

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return errorResponse(
        "EMAIL_EXISTS",
        "An account with this email already exists",
        409
      );
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
      },
    });

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
