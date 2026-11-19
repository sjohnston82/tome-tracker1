CREATE TABLE "reading_sessions" (
  "id" TEXT NOT NULL,
  "book_id" TEXT NOT NULL,
  "baseline_page" INTEGER NOT NULL DEFAULT 0,
  "total_pages" INTEGER,
  "started_at" TIMESTAMP(3),
  "tracked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "reading_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reading_sessions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reading_session_pages_valid" CHECK ("baseline_page" >= 0 AND ("total_pages" IS NULL OR "total_pages" >= "baseline_page"))
);
CREATE INDEX "reading_sessions_book_id_tracked_at_idx" ON "reading_sessions"("book_id", "tracked_at");
-- Prisma cannot express partial unique indexes: at most one open read per edition.
CREATE UNIQUE INDEX "reading_sessions_one_active" ON "reading_sessions"("book_id") WHERE "finished_at" IS NULL;
CREATE TABLE "reading_logs" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "page" INTEGER NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "is_completion" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reading_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reading_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "reading_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reading_logs_page_valid" CHECK ("page" >= 0)
);
CREATE UNIQUE INDEX "reading_logs_session_id_request_id_key" ON "reading_logs"("session_id", "request_id");
CREATE INDEX "reading_logs_session_id_occurred_at_idx" ON "reading_logs"("session_id", "occurred_at");
