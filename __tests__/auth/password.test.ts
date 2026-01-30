import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("Password utilities", () => {
  it("hashes password and verifies correctly", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("generates different hashes for same password", async () => {
    const password = "TestPassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    // Both should still verify
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it("takes reasonable time for security", async () => {
    const start = Date.now();
    await hashPassword("TestPassword123!");
    const duration = Date.now() - start;

    // Should take at least 100ms with 12 rounds
    expect(duration).toBeGreaterThan(50);
  });
});
