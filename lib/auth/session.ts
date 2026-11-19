import { cookies } from "next/headers";
import { createToken, verifyToken, SessionPayload } from "./jwt";

import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
const credentialStamp = (hash: string, email: string) => createHash("sha256").update(hash + "\0" + email).digest("hex");

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
  const current = await prisma.user.findUnique({ where: { id: user.id } });
  if (!current) throw new Error("Unauthorized");
  const token = await createToken({
    userId: user.id,
    email: current.email,
    role: current.role,
    credentialStamp: credentialStamp(current.passwordHash, current.email),
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getCookieOptions());
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return null;
  if (payload.credentialStamp) {
    if (payload.credentialStamp !== credentialStamp(user.passwordHash, user.email)) return null;
  } else if (payload.email !== user.email || (payload.iat ?? 0) < Math.floor(user.updatedAt.getTime() / 1000)) return null;
  return { ...payload, email: user.email, role: user.role };
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
