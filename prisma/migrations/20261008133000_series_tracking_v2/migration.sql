-- Additive migration: existing book rows and legacy series fields remain intact.
CREATE TYPE "ReadingStatus" AS ENUM ('UNKNOWN', 'UNREAD', 'READING', 'READ');
CREATE TYPE "SeriesEntryType" AS ENUM ('MAIN', 'PREQUEL', 'NOVELLA', 'COMPANION', 'OTHER');

ALTER TABLE "books"
  ADD COLUMN "work_id" TEXT,
  ADD COLUMN "reading_status" "ReadingStatus" NOT NULL DEFAULT 'UNKNOWN';

CREATE TABLE "works" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "author_name" TEXT NOT NULL,
  "open_library_id" TEXT,
  "hardcover_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "series" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "external_source" TEXT,
  "external_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "series_entries" (
  "id" TEXT NOT NULL,
  "series_id" TEXT NOT NULL,
  "work_id" TEXT NOT NULL,
  "position" DECIMAL(8,3),
  "entry_type" "SeriesEntryType" NOT NULL DEFAULT 'MAIN',
  "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "series_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "books_work_id_idx" ON "books"("work_id");
CREATE INDEX "works_user_id_title_idx" ON "works"("user_id", "title");
CREATE INDEX "works_user_id_open_library_id_idx" ON "works"("user_id", "open_library_id");
CREATE UNIQUE INDEX "series_user_id_name_key" ON "series"("user_id", "name");
CREATE UNIQUE INDEX "series_entries_series_id_work_id_key" ON "series_entries"("series_id", "work_id");
CREATE INDEX "series_entries_series_id_position_idx" ON "series_entries"("series_id", "position");
CREATE INDEX "series_entries_work_id_idx" ON "series_entries"("work_id");

ALTER TABLE "books" ADD CONSTRAINT "books_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "works" ADD CONSTRAINT "works_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "series" ADD CONSTRAINT "series_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "series_entries" ADD CONSTRAINT "series_entries_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "series_entries" ADD CONSTRAINT "series_entries_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
