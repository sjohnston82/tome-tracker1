import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db";

// NOTE: These tests require the dev server to be running
// Run with: npm run dev & npm test

describe("POST /api/auth/register", () => {
  const testEmail = `test-register-${Date.now()}@example.com`;

  afterEach(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  it("creates a new user with valid data", async () => {
    const response = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "ValidPassword123!",
      }),
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.user.email).toBe(testEmail);
    expect(data.user.role).toBe("USER");
    expect(data.user.id).toBeDefined();

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(testEmail);

    // Check for session cookie
    const cookies = response.headers.get("set-cookie");
    expect(cookies).toContain("session=");
  });

  it("rejects duplicate email", async () => {
    // Create user first
    await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "ValidPassword123!",
      }),
    });

    // Try to create again
    const response = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "AnotherPassword123!",
      }),
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error_code).toBe("EMAIL_EXISTS");
  });

  it("rejects weak passwords", async () => {
    const response = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "weak",
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error_code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid email", async () => {
    const response = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "notanemail",
        password: "ValidPassword123!",
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error_code).toBe("VALIDATION_ERROR");
  });
});
