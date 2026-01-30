import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

describe("POST /api/auth/login", () => {
  const testEmail = `test-login-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";

  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await hashPassword(testPassword),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  it("logs in with valid credentials", async () => {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.user.email).toBe(testEmail);

    // Check for session cookie
    const cookies = response.headers.get("set-cookie");
    expect(cookies).toContain("session=");
  });

  it("rejects invalid password", async () => {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "WrongPassword123!",
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error_code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects non-existent user", async () => {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "SomePassword123!",
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    // Same error to prevent email enumeration
    expect(data.error_code).toBe("INVALID_CREDENTIALS");
  });
});
