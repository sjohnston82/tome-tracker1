import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  emailSchema,
  registerSchema,
} from "@/lib/auth/validation";

describe("Validation schemas", () => {
  describe("passwordSchema", () => {
    it("accepts valid passwords", () => {
      expect(passwordSchema.safeParse("ValidPass123!").success).toBe(true);
      expect(passwordSchema.safeParse("MySecure@Pass99").success).toBe(true);
      expect(passwordSchema.safeParse("Complex#Pass1234").success).toBe(true);
    });

    it("rejects short passwords", () => {
      const result = passwordSchema.safeParse("Short1!");
      expect(result.success).toBe(false);
    });

    it("rejects passwords without numbers", () => {
      const result = passwordSchema.safeParse("NoNumbersHere!");
      expect(result.success).toBe(false);
    });

    it("rejects passwords without symbols", () => {
      const result = passwordSchema.safeParse("NoSymbolsHere123");
      expect(result.success).toBe(false);
    });
  });

  describe("emailSchema", () => {
    it("accepts valid emails and lowercases them", () => {
      expect(emailSchema.parse("Test@Example.COM")).toBe("test@example.com");
      expect(emailSchema.parse("USER@DOMAIN.ORG")).toBe("user@domain.org");
    });

    it("rejects invalid emails", () => {
      expect(emailSchema.safeParse("notanemail").success).toBe(false);
      expect(emailSchema.safeParse("missing@").success).toBe(false);
      expect(emailSchema.safeParse("@nodomain.com").success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("validates complete registration data", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "ValidPassword123!",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid registration data", () => {
      const result = registerSchema.safeParse({
        email: "invalid",
        password: "short",
      });
      expect(result.success).toBe(false);
    });
  });
});
