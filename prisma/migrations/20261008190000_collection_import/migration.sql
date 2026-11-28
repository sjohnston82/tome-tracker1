-- Additive: preserve every existing physical book and manually corrected field.
ALTER TABLE "books" ADD COLUMN "import_key" TEXT;
ALTER TABLE "works" ADD COLUMN "publication_year" INTEGER, ADD COLUMN "import_key" TEXT;
CREATE UNIQUE INDEX "books_user_id_import_key_key" ON "books"("user_id", "import_key");
CREATE UNIQUE INDEX "works_user_id_import_key_key" ON "works"("user_id", "import_key");
CREATE TABLE "book_contents" (
  "book_id" TEXT NOT NULL,
  "work_id" TEXT NOT NULL,
  CONSTRAINT "book_contents_pkey" PRIMARY KEY ("book_id", "work_id")
);
CREATE INDEX "book_contents_work_id_idx" ON "book_contents"("work_id");
ALTER TABLE "book_contents" ADD CONSTRAINT "book_contents_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_contents" ADD CONSTRAINT "book_contents_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "collection_imports" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "dataset" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "report" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collection_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collection_imports_user_id_dataset_key" ON "collection_imports"("user_id", "dataset");
ALTER TABLE "collection_imports" ADD CONSTRAINT "collection_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
