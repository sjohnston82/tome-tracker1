// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { createToken, verifyToken } from "@/lib/auth/jwt";

// Set test JWT secret
beforeAll(() => {
  process.env.JWT_SECRET =
    "test-secret-at-least-32-characters-long-for-testing";
});

describe("JWT utilities", () => {
  const testPayload = {
    userId: "user-123",
    email: "test@example.com",
    role: "USER" as const,
  };

  it("creates and verifies valid token", async () => {
    const token = await createToken(testPayload);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format

    const verified = await verifyToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(testPayload.userId);
    expect(verified?.email).toBe(testPayload.email);
    expect(verified?.role).toBe(testPayload.role);
  });

  it("returns null for invalid token", async () => {
    const result = await verifyToken("invalid-token");
    expect(result).toBeNull();
  });

  it("returns null for tampered token", async () => {
    const token = await createToken(testPayload);
    const tampered = token.slice(0, -5) + "xxxxx";
    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  it("returns null for empty token", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  it("includes issued at and expiration", async () => {
    const token = await createToken(testPayload);
    const verified = await verifyToken(token);

    expect(verified?.iat).toBeDefined();
    expect(verified?.exp).toBeDefined();
    expect(verified!.exp! > verified!.iat!).toBe(true);
  });
});
