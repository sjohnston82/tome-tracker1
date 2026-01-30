import { cookies } from "next/headers";
import { createToken, verifyToken, SessionPayload } from "./jwt";

const COOKIE_NAME = "session";

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
});

export async function createSession(user: {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}): Promise<void> {
  const token = await createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getCookieOptions());
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;
  return verifyToken(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

export { type SessionPayload };
