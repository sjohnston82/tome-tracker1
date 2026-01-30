import { NextRequest, NextResponse } from "next/server";
import { getSession, SessionPayload } from "@/lib/auth/session";
import { errorResponse } from "./response";

type AuthenticatedHandler = (
  request: NextRequest,
  session: SessionPayload
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest) => {
    const session = await getSession();

    if (!session) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    return handler(request, session);
  };
}

export function withAdmin(handler: AuthenticatedHandler) {
  return async (request: NextRequest) => {
    const session = await getSession();

    if (!session) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    if (session.role !== "ADMIN") {
      return errorResponse("FORBIDDEN", "Admin access required", 403);
    }

    return handler(request, session);
  };
}
