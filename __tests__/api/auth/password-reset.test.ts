import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Password Reset Flow", () => {
  const testEmail = `reset-test-${Date.now()}@example.com`;
  let testUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await hashPassword("OldPassword123!"),
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user
      .delete({
        where: { id: testUserId },
      })
      .catch(() => {}); // Ignore if already deleted
  });

  it("creates reset token for valid email", async () => {
    const response = await fetch(
      "http://localhost:3000/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      }
    );

    expect(response.status).toBe(200);

    // Verify token was created
    const token = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId },
    });
    expect(token).not.toBeNull();
    expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns success even for non-existent email (no enumeration)", async () => {
    const response = await fetch(
      "http://localhost:3000/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent@example.com" }),
      }
    );

    expect(response.status).toBe(200);
  });

  it("resets password with valid token", async () => {
    // Get the token
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId },
    });

    expect(tokenRecord).not.toBeNull();

    const newPassword = "NewPassword456!";

    const response = await fetch(
      "http://localhost:3000/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenRecord!.token,
          password: newPassword,
        }),
      }
    );

    expect(response.status).toBe(200);

    // Verify password was changed
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
    });
    const isValid = await verifyPassword(newPassword, user!.passwordHash);
    expect(isValid).toBe(true);

    // Verify token was deleted
    const deletedToken = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId },
    });
    expect(deletedToken).toBeNull();
  });

  it("rejects invalid token", async () => {
    const response = await fetch(
      "http://localhost:3000/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "invalid-token-that-does-not-exist",
          password: "NewPassword123!",
        }),
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error_code).toBe("INVALID_TOKEN");
  });
});
