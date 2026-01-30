-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookSource" AS ENUM ('SCAN', 'MANUAL', 'IMPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "photo_url" TEXT,
    "external_source" TEXT,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isbn13" TEXT,
    "isbn10" TEXT,
    "publisher" TEXT,
    "publication_year" INTEGER,
    "cover_url" TEXT,
    "series_name" TEXT,
    "series_number" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "BookSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "authors_user_id_name_key" ON "authors"("user_id", "name");

-- CreateIndex
CREATE INDEX "books_user_id_idx" ON "books"("user_id");

-- CreateIndex
CREATE INDEX "books_author_id_idx" ON "books"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "books_user_id_isbn13_key" ON "books"("user_id", "isbn13");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- AddForeignKey
ALTER TABLE "authors" ADD CONSTRAINT "authors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
