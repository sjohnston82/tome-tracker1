import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

describe("Import API", () => {
  const testEmail = `import-test-${Date.now()}@example.com`;
  let sessionCookie: string;
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await hashPassword("TestPassword123!"),
      },
    });
    userId = user.id;

    const loginResponse = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "TestPassword123!",
      }),
    });
    sessionCookie = loginResponse.headers.get("set-cookie")!.split(";")[0];
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  it("previews CSV file", async () => {
    const csvContent =
      "Title,Author,ISBN\nMistborn,Brandon Sanderson,9780765311788";

    const response = await fetch("http://localhost:3000/api/import/preview", {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ csv: csvContent }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.preview.totalRows).toBe(1);
    expect(data.preview.columns).toContain("Title");
    expect(data.preview.suggestedMapping.title).toBe("Title");
  }, 60000);

  it("executes import", async () => {
    const csvContent =
      "Title,Author,ISBN\nThe Way of Kings,Brandon Sanderson,9780765326355";

    const mapping = {
      title: "Title",
      author: "Author",
      isbn: "ISBN",
      seriesName: null,
      seriesNumber: null,
      publisher: null,
      publicationYear: null,
    };

    const response = await fetch("http://localhost:3000/api/import/execute", {
      method: "POST",
      headers: {
        Cookie: sessionCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        csv: csvContent,
        mapping,
        format: "csv",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.result.imported).toBe(1);
    expect(data.result.duplicates).toBe(0);
  }, 60000);
});
