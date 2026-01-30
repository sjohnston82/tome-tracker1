import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

describe("Account API", () => {
  const testEmail = `account-test-${Date.now()}@example.com`;
  let sessionCookie: string;
  let userId: string;

  beforeEach(async () => {
    // Create user
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await hashPassword("TestPassword123!"),
      },
    });
    userId = user.id;

    // Login to get session cookie
    const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "TestPassword123!",
      }),
    });

    const cookies = loginResponse.headers.get("set-cookie");
    sessionCookie = cookies!.split(";")[0];
  });

  afterEach(async () => {
    // Clean up if user still exists
    await prisma.user
      .delete({ where: { id: userId } })
      .catch(() => {}); // Ignore if already deleted
  });

  it("returns current user info", async () => {
    const response = await fetch("http://localhost:3000/api/account", {
      headers: { Cookie: sessionCookie },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.email).toBe(testEmail);
    expect(data.user.role).toBe("USER");
    expect(data.user.bookCount).toBe(0);
  });

  it("rejects unauthenticated requests", async () => {
    const response = await fetch("http://localhost:3000/api/account");
    expect(response.status).toBe(401);
  });

  it("deletes account and all data", async () => {
    // First, create some data for this user
    const author = await prisma.author.create({
      data: {
        userId,
        name: "Test Author",
      },
    });

    await prisma.book.create({
      data: {
        userId,
        authorId: author.id,
        title: "Test Book",
        source: "MANUAL",
      },
    });

    // Delete account
    const response = await fetch("http://localhost:3000/api/account", {
      method: "DELETE",
      headers: { Cookie: sessionCookie },
    });

    expect(response.status).toBe(200);

    // Verify user is deleted
    const deletedUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    expect(deletedUser).toBeNull();

    // Verify cascade delete worked (books should be deleted)
    const orphanedBooks = await prisma.book.findMany({
      where: { userId },
    });
    expect(orphanedBooks).toHaveLength(0);

    // Verify authors are deleted too
    const orphanedAuthors = await prisma.author.findMany({
      where: { userId },
    });
    expect(orphanedAuthors).toHaveLength(0);
  });
});
