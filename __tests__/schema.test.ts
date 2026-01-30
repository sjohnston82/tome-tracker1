import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Database Schema", () => {
  it("can import Prisma client", () => {
    const prisma = new PrismaClient();
    expect(prisma).toBeDefined();
  });

  it("has correct enums", async () => {
    const { Role, BookSource } = await import("@prisma/client");

    expect(Role.USER).toBe("USER");
    expect(Role.ADMIN).toBe("ADMIN");
    expect(BookSource.SCAN).toBe("SCAN");
    expect(BookSource.MANUAL).toBe("MANUAL");
    expect(BookSource.IMPORT).toBe("IMPORT");
  });
});
