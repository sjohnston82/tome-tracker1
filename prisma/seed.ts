import { PrismaClient, Role, BookSource } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      passwordHash: await hashPassword("TestPassword123!"),
      role: Role.USER,
    },
  });
  console.log("Created test user:", testUser.email);

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: await hashPassword("AdminPassword123!"),
      role: Role.ADMIN,
    },
  });
  console.log("Created admin user:", adminUser.email);

  // Create sample author for test user
  const author = await prisma.author.upsert({
    where: {
      userId_name: { userId: testUser.id, name: "Brandon Sanderson" },
    },
    update: {},
    create: {
      userId: testUser.id,
      name: "Brandon Sanderson",
      bio: "American fantasy and science fiction writer",
    },
  });
  console.log("Created author:", author.name);

  // Create sample book
  const book = await prisma.book.upsert({
    where: {
      userId_isbn13: { userId: testUser.id, isbn13: "9780765311788" },
    },
    update: {},
    create: {
      userId: testUser.id,
      authorId: author.id,
      title: "Mistborn: The Final Empire",
      isbn13: "9780765311788",
      isbn10: "0765311785",
      publisher: "Tor Books",
      publicationYear: 2006,
      seriesName: "Mistborn",
      seriesNumber: 1,
      source: BookSource.MANUAL,
    },
  });
  console.log("Created book:", book.title);

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
