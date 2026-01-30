# Tome Tracker PWA — Implementation Checklist (todo.md)

> This checklist is organized by the blueprint phases/prompts (1–33). Mark items as you complete them.

## Phase 0 — Prereqs / Accounts / Secrets

- [ ] Create a Neon Postgres project and obtain `DATABASE_URL` (serverless Postgres).
- [ ] Create a Resend account + API key (`RESEND_API_KEY`) for transactional emails.
- [ ] Choose and generate a strong `JWT_SECRET` (>= 32 chars).
- [ ] Set `NEXT_PUBLIC_APP_URL` (dev: http://localhost:3000; prod: your deployed URL).
- [ ] Create `.env.local` for local dev, and keep `.env.example` updated.

---

## Phase 1 — Project Foundation (Prompts 1–3)

### Prompt 1: Project Initialization and Configuration

- [x] Initialize Next.js 14+ project (App Router) with TypeScript, Tailwind, ESLint.
- [x] Install dependencies: Prisma, @prisma/client, bcryptjs (+ types), jose, resend, zod; and dev deps: vitest, @testing-library/react, @testing-library/jest-dom.
- [x] Add `prisma/schema.prisma` with datasource/generator only (no models yet).
- [x] Add `.env.example` with required keys.
- [x] Add `vitest.config.ts` (jsdom, globals, alias `@`).
- [x] Add `lib/env.ts` for Zod env validation.
- [x] Add base `app/layout.tsx` and placeholder `app/page.tsx`.
- [x] Add Prisma singleton `lib/db.ts`.
- [ ] Verify: `npm run dev`, `npm run lint`, `npm run build`, env validation errors are clear.

### Prompt 2: Database Schema — Core Models

- [x] Extend Prisma schema with models:
  - [x] `User` (role enum, passwordHash mapping, timestamps, relations)
  - [x] `Author` (user-scoped, unique [userId, name], relation/cascade)
  - [x] `Book` (isbn10/isbn13 optional, tags/genres arrays, BookSource enum, indices, unique [userId, isbn13])
  - [x] `PasswordResetToken` (token unique, expiresAt)
- [x] Add client-facing TS types in `lib/types/index.ts` (User/Author/Book).
- [x] Add `__tests__/schema.test.ts` verifying Prisma client import + enums.
- [x] Verify: `npx prisma validate`, `npx prisma generate`.

### Prompt 3: Migration + Seed + Auth Utilities

- [x] Connect Neon URL in `.env.local`; run initial migration (`npx prisma migrate dev --name init`).
- [x] Add password hashing helpers (`lib/auth/password.ts`) using bcrypt (12 rounds).
- [x] Add Zod auth validation (`lib/auth/validation.ts`) with strong password rules.
- [x] Add `prisma/seed.ts` to seed:
  - [x] test user (USER)
  - [x] admin user (ADMIN)
  - [x] sample author + book
- [x] Wire Prisma seed command in `package.json`.
- [x] Add tests:
  - [x] `__tests__/auth/password.test.ts`
  - [x] `__tests__/auth/validation.test.ts`
- [x] Verify: `npx prisma db seed`, all tests pass.

---

## Phase 2 — Authentication System (Prompts 4–7)

### Prompt 4: JWT Session Management

- [x] Add JWT utilities `lib/auth/jwt.ts`:
  - [x] typed payload { userId, email, role }
  - [x] HS256, 7d expiration
  - [x] verify returns payload or null
- [x] Add session helpers `lib/auth/session.ts`:
  - [x] httpOnly cookie `session`
  - [x] createSession / getSession / destroySession
  - [x] requireAuth / requireAdmin
- [x] Add API response helpers `lib/api/response.ts`:
  - [x] successResponse / errorResponse / handleApiError
  - [x] Zod validation errors map to 400
  - [x] basic in-memory rate limiter (checkRateLimit)
- [x] Add JWT unit tests `__tests__/auth/jwt.test.ts`.
- [x] Verify: cookie flags correct (secure in prod), tests pass.

### Prompt 5: Auth API — Register + Login

- [x] Implement `POST /api/auth/register` (`app/api/auth/register/route.ts`)
  - [x] validate body (registerSchema)
  - [x] reject existing email (409 EMAIL_EXISTS)
  - [x] create user + session cookie
- [x] Implement `POST /api/auth/login` (`app/api/auth/login/route.ts`)
  - [x] validate body (loginSchema)
  - [x] verify password
  - [x] return generic 401 on invalid creds (no enumeration)
- [x] Add integration tests:
  - [x] `__tests__/api/auth/register.test.ts`
  - [x] `__tests__/api/auth/login.test.ts`
- [x] Verify: session cookie set on success; DB contains user; tests pass with dev server running.

### Prompt 6: Auth API — Logout + Password Reset

- [x] Implement `POST /api/auth/logout` to clear session cookie.
- [x] Add Resend email helper `lib/email/resend.ts` (sendPasswordResetEmail).
- [x] Implement password reset request endpoint:
  - [x] `POST /api/auth/password-reset/request`
  - [x] accept email, always return success (don’t reveal existence)
  - [x] create token (crypto random), store in PasswordResetToken with 1h expiry
  - [x] clear old tokens for user when creating a new one
  - [x] build reset URL using `NEXT_PUBLIC_APP_URL` + token
  - [x] send email via Resend (handle send failures)
- [x] Implement password reset confirm endpoint:
  - [x] `POST /api/auth/password-reset/confirm`
  - [x] validate token + expiry
  - [x] update passwordHash (strong rules)
  - [x] delete token(s) after use
- [x] Add tests `__tests__/api/auth/password-reset.test.ts`:
  - [x] request doesn’t reveal user existence
  - [x] tokens expire after 1 hour
  - [x] invalid token returns INVALID_TOKEN (400)
- [x] Verify: logout clears cookie; reset flow works end-to-end.

### Prompt 7: Account Deletion + Auth Middleware

- [x] Add `lib/api/withAuth.ts` (+ withAdmin) wrappers for API routes.
- [x] Implement `GET /api/account` (current user info + bookCount).
- [x] Implement `DELETE /api/account`:
  - [x] hard delete User (cascade deletes Authors/Books)
  - [x] destroy session after deletion
- [x] Add root `middleware.ts`:
  - [x] protect routes: /library, /settings, /scan, /admin
  - [x] redirect authenticated users away from /login, /register to /library
  - [x] redirect unauthenticated to /login?redirect=...
  - [x] block /admin for non-admins (redirect to /library)
- [x] Add integration tests `__tests__/api/account.test.ts`:
  - [x] rejects unauth
  - [x] returns user info
  - [x] deletes user + cascades books/authors
- [x] Verify: all auth tests pass.

---

## Phase 3 — Core Library API (Prompts 8–11)

### Prompt 8: Book CRUD — Create + Read

- [ ] Add ISBN utilities `lib/books/isbn.ts`:
  - [ ] normalize to ISBN-13
  - [ ] validate ISBN-13 and extract ISBN from barcode
- [ ] Add validation schema `lib/books/validation.ts` for book payloads (zod).
- [ ] Add service layer `lib/books/service.ts`:
  - [ ] createBook (creates/links author)
  - [ ] list books (user-scoped)
  - [ ] fetch book by id (user-scoped)
  - [ ] ownership check by ISBN-13 (dedupe)
- [ ] Implement `app/api/books/route.ts`:
  - [ ] `POST /api/books` (withAuth) create
  - [ ] `GET /api/books` list
- [ ] Add ISBN tests `__tests__/lib/isbn.test.ts`.
- [ ] Verify: ISBN dedupe works when isbn13 present.

### Prompt 9: Book CRUD — Update + Delete

- [ ] Extend service layer:
  - [ ] updateBook (user-scoped; update author if needed)
  - [ ] deleteBook (user-scoped)
- [ ] Implement `app/api/books/[id]/route.ts`:
  - [ ] `PATCH /api/books/:id`
  - [ ] `DELETE /api/books/:id`
- [ ] Verify: unauthorized and cross-user access rejected.

### Prompt 10: Library Sync Endpoint (Network-first caching)

- [ ] Create `lib/library/sync.ts` to return:
  - [ ] authors with books (grouping-ready)
  - [ ] stats { bookCount, authorCount }
  - [ ] syncedAt timestamp
- [ ] Implement `GET /api/library/sync` for full snapshot.
- [ ] Implement `GET /api/library/check` (quick online check / ping).
- [ ] Verify: payload supports offline caching.

### Prompt 11: Author Management API

- [ ] Create author service `lib/authors/service.ts`:
  - [ ] list authors (with counts)
  - [ ] author detail (with books)
- [ ] Implement `GET /api/authors` (and optional detail route if specified).
- [ ] Verify: author records are user-scoped.

---

## Phase 4 — Metadata Lookup (Prompts 12–14)

### Prompt 12: Open Library Integration (primary)

- [ ] Add types `lib/metadata/types.ts` (BookMetadata, SearchResult).
- [ ] Add provider `lib/metadata/open-library.ts`:
  - [ ] lookupByIsbn
  - [ ] search(query)
  - [ ] normalize returned fields (authors[], coverUrl, year, etc.)
  - [ ] cache/revalidate strategy (as specified)

### Prompt 13: Google Books Fallback (secondary)

- [ ] Add provider `lib/metadata/google-books.ts`:
  - [ ] lookupByIsbn
  - [ ] search(query)
  - [ ] parse year from publishedDate
  - [ ] upgrade cover URL to https and higher zoom
- [ ] Add combined provider `lib/metadata/index.ts`:
  - [ ] try Open Library first, then Google Books fallback

### Prompt 14: Lookup API Routes + Rate Limiting

- [ ] Implement `GET /api/lookup/isbn/[code]` (withAuth):
  - [ ] rate limit: 30/min/user
  - [ ] detect ISBN in barcode; normalize to ISBN-13
  - [ ] response includes { isIsbn, normalizedIsbn, owned, metadata }
  - [ ] return isIsbn=false response if not valid
- [ ] Implement `GET /api/lookup/search` (withAuth):
  - [ ] rate limit: 20/min/user
  - [ ] query param validation
  - [ ] return results list (provider-fallback)
- [ ] Verify: ownership check uses library service; lookups work.

---

## Phase 5 — Basic UI Shell (Prompts 15–18)

### Prompt 15: Layout + Navigation + UI Primitives

- [ ] Create UI components:
  - [ ] `components/ui/button.tsx` (variants, loading)
  - [ ] `components/ui/input.tsx` (label, error)
  - [ ] `lib/utils.ts` (cn helper)
- [ ] Create layout components:
  - [ ] `components/layout/header.tsx` (title, actions)
  - [ ] `components/layout/mobile-nav.tsx` (nav links)
- [ ] Update `app/layout.tsx` to wrap app shell, include nav.

### Prompt 16: Auth Pages

- [ ] Add `lib/hooks/useAuth.ts`:
  - [ ] current user fetch (`/api/account`)
  - [ ] login/register/logout methods
  - [ ] loading/error state
- [ ] Build pages (App Router groups):
  - [ ] `app/(auth)/login/page.tsx`
  - [ ] `app/(auth)/register/page.tsx`
  - [ ] `app/(auth)/forgot-password/page.tsx`
  - [ ] `app/(auth)/reset-password/page.tsx`
- [ ] Ensure redirect behavior works with middleware and `redirect` query param.
- [ ] Verify: full password reset UI flow works.

### Prompt 17: Library List Page (author-centric)

- [ ] Add `lib/hooks/useLibrary.ts` (calls `/api/library/sync`, stores lastSynced).
- [ ] Add `components/library/author-card.tsx`:
  - [ ] expand/collapse author
  - [ ] option to group by series
  - [ ] link to book detail
- [ ] Build `app/library/page.tsx`:
  - [ ] stats summary + refresh/sync
  - [ ] loading and error handling

### Prompt 18: Book Detail Page

- [ ] Add `lib/hooks/useBook.ts`:
  - [ ] fetch by id
  - [ ] update + delete
  - [ ] local form state, saving/error handling
- [ ] Build `app/library/[id]/page.tsx` (or equivalent in prompt):
  - [ ] edit fields (title, author, publisher, year, series, tags/genres)
  - [ ] delete with confirm
- [ ] Verify: update/delete reflect in library view.

---

## Phase 6 — Scanner & Manual Add (Prompts 19–22)

### Prompt 19: Barcode Scanner Component (ZXing)

- [ ] Install ZXing dependency (if not already).
- [ ] Build `components/scanner/barcode-scanner.tsx`:
  - [ ] request camera permissions
  - [ ] stream to video element
  - [ ] decode continuously
  - [ ] debounce duplicate scans
  - [ ] handle stop/unmount
- [ ] Build `components/scanner/scan-result.tsx`:
  - [ ] states: loading, not-a-book, owned, not-found, found
  - [ ] actions: add, view, scan again/cancel
- [ ] Verify: camera starts/stops reliably across mobile.

### Prompts 20–22: Scan Page + Manual Add + Online Search

- [ ] Build `app/scan/page.tsx` scan flow:
  - [ ] scan barcode -> call `/api/lookup/isbn/[code]`
  - [ ] if owned: offer view
  - [ ] if metadata found: offer “Add to library”
  - [ ] handle all error/empty states
- [ ] Add API route `POST /api/books/check-duplicate`:
  - [ ] fuzzy duplicate detection for manual adds
- [ ] Add fuzzy matcher `lib/books/fuzzy-match.ts`:
  - [ ] compare titles/authors
  - [ ] configurable threshold
- [ ] Build manual add page `app/library/add/page.tsx`:
  - [ ] form validation, show potential duplicates
  - [ ] allow override/add anyway
- [ ] Build online search page `app/library/search/page.tsx`:
  - [ ] query -> `/api/lookup/search`
  - [ ] show results + add to library
- [ ] Verify: manual add works without ISBN; scanner add uses source=SCAN.

---

## Phase 7 — Import System (Prompts 23–26)

### Prompt 23: CSV Import Parser

- [ ] Add import types `lib/import/types.ts` (mapping types, preview types).
- [ ] Add CSV parser `lib/import/parser.ts`:
  - [ ] PapaParse parsing (headers + rows)
  - [ ] detect format (generic vs Goodreads/StoryGraph)
  - [ ] suggestMapping(headers)
  - [ ] applyMapping(row, mapping) -> normalized row or null
  - [ ] extractSeriesFromTitle() for Goodreads-style “(Series, #1)”
  - [ ] createPreview(file) (sample rows + inferred mapping)
- [ ] Add Goodreads mapping constants `lib/import/goodreads.ts`.
- [ ] Add tests `__tests__/lib/import/parser.test.ts`.

### Prompt 24: Import API Routes

- [ ] Implement `POST /api/import/preview` (withAuth):
  - [ ] multipart form upload (file)
  - [ ] validate .csv
  - [ ] createPreview
- [ ] Add executor `lib/import/executor.ts`:
  - [ ] create authors/books
  - [ ] normalize ISBN where possible
  - [ ] de-dupe against existing library (isbn and/or fuzzy)
  - [ ] track counts: created, skipped, errors
- [ ] Implement `POST /api/import/execute` (withAuth):
  - [ ] rate limit: 5 imports/hour/user
  - [ ] accept file + mapping + format
  - [ ] parseCSV + executeImport
- [ ] Add integration test `__tests__/api/import.test.ts`.

### Prompt 25: Import UI

- [ ] Build `app/library/import/page.tsx`:
  - [ ] file upload
  - [ ] preview (first rows)
  - [ ] mapping UI (select columns for title/author/isbn/etc.)
  - [ ] format selection (csv/goodreads/storygraph)
  - [ ] execute import and show results summary

### Prompt 26: Background Metadata Enrichment

- [ ] Add enrichment service `lib/enrichment/service.ts`:
  - [ ] find books missing metadata
  - [ ] call lookup providers to fill in fields
- [ ] Add `POST /api/enrichment/trigger`:
  - [ ] run enrichment job (per user)
- [ ] Add `GET /api/enrichment/status`:
  - [ ] show progress / last run
- [ ] Wire import completion to optionally trigger enrichment.
- [ ] Verify: enrichment doesn’t overload APIs; respects rate limiting/caching.

---

## Phase 8 — PWA & Offline (Prompts 27–30)

### Prompt 27: Service Worker + Manifest

- [ ] Configure `next-pwa` in `next.config.js`.
- [ ] Add `public/manifest.json` (name, icons, theme/background colors, start_url, display).
- [ ] Update `app/layout.tsx` metadata for PWA (manifest link, theme-color).
- [ ] Ensure caching strategy aligns with app needs (static assets + API requests where appropriate).
- [ ] Verify: installable on mobile; service worker registers; offline basic shell works.

### Prompt 28: IndexedDB Local Cache

- [ ] Add IndexedDB wrapper `lib/offline/db.ts` (idb):
  - [ ] stores for authors/books/stats/lastSynced
  - [ ] versioning/migrations
- [ ] Add offline library hook `lib/hooks/useOfflineLibrary.ts`:
  - [ ] network-first: fetch `/api/library/sync`
  - [ ] on success: persist to IndexedDB
  - [ ] on failure/offline: load from IndexedDB
- [ ] Verify: library loads with airplane mode after first sync.

### Prompt 29: Offline Mode UI

- [ ] Add `components/offline/offline-banner.tsx`:
  - [ ] detect navigator.onLine, show banner
  - [ ] show lastSynced info
- [ ] Add `components/offline/offline-guard.tsx`:
  - [ ] guard routes/actions that require network (scan lookup, online search, import, etc.)
- [ ] Update `app/layout.tsx` to include banner globally.
- [ ] Verify: graceful fallback messaging; no confusing hard errors.

### Prompt 30: Settings Page + Cache Controls

- [ ] Build `app/settings/page.tsx`:
  - [ ] account info (email, role, book count)
  - [ ] logout button
  - [ ] delete account (confirm)
  - [ ] offline cache controls:
    - [ ] clear IndexedDB cache
    - [ ] show cache size / last synced
  - [ ] optional theme toggle
- [ ] (If split across files) ensure “continued” prompt items are merged here.
- [ ] Verify: destructive actions have confirmations; cache clear works.

---

## Phase 9 — Admin & Polish (Prompts 31–33)

### Prompt 31: Admin Dashboard

- [ ] Add admin layout `app/admin/layout.tsx` and page `app/admin/page.tsx`.
- [ ] Implement `GET /api/admin/users` (withAdmin):
  - [ ] list users with counts, createdAt, role
  - [ ] basic stats (total users, total books)
- [ ] Add basic server logging `lib/logging/service.ts` (as specified).
- [ ] Verify: middleware blocks non-admins.

### Prompt 32: Onboarding Flow

- [ ] Add onboarding hook `lib/hooks/useOnboarding.ts`:
  - [ ] detect first-time user (localStorage flag)
  - [ ] expose dismiss/complete actions
- [ ] Add `components/onboarding/onboarding-modal.tsx`:
  - [ ] step-by-step tips: scan, manual add, search, import, offline
- [ ] Verify: shown once, can be reopened from settings (if specified).

### Prompt 33: Final Integration + Testing + Docs

- [ ] Write `README.md`:
  - [ ] setup instructions (env vars, Neon, Resend)
  - [ ] local dev + tests
  - [ ] deployment notes (Vercel)
  - [ ] PWA install instructions
- [ ] Write `ARCHITECTURE.md`:
  - [ ] data model, offline strategy, external integrations, auth
- [ ] Review `package.json` scripts:
  - [ ] dev/build/lint/test/prisma/seed
- [ ] Run full test suite and fix flakes:
  - [ ] unit tests (vitest)
  - [ ] integration tests (requires dev server + DB)
- [ ] Manual QA checklist:
  - [ ] register/login/logout
  - [ ] password reset email + confirm
  - [ ] add book via scan
  - [ ] add book manually + duplicate warning
  - [ ] search + add
  - [ ] import preview + execute + enrichment
  - [ ] offline: initial sync, airplane mode viewing, cache clear
  - [ ] admin dashboard visible only to ADMIN
- [ ] Final security sweep:
  - [ ] user scoping everywhere (no cross-user access)
  - [ ] rate limits enforced (lookup/search/import)
  - [ ] cookies httpOnly + secure in prod
  - [ ] no secrets in client bundles
