import { SignJWT, jwtVerify, JWTPayload } from "jose";

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
}

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
};

const ALG = "HS256";
const EXPIRATION = "7d";

export async function createToken(
  payload: Omit<SessionPayload, "iat" | "exp">
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret());
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
