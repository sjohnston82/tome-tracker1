# Architecture Overview

## Directory Structure

```
/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, register)
│   ├── api/               # API routes
│   ├── library/           # Library pages
│   ├── scan/              # Barcode scanning
│   ├── settings/          # User settings
│   └── admin/             # Admin dashboard
├── components/            # UI components
├── lib/                   # Core business logic
│   ├── auth/              # Auth helpers
│   ├── books/             # Book services
│   ├── import/            # CSV import logic
│   ├── metadata/          # External metadata providers
│   ├── offline/           # IndexedDB caching
│   └── hooks/             # Client hooks
├── prisma/                # Prisma schema + migrations
├── public/                # Static assets + PWA manifest
├── __tests__/             # Vitest test suites
└── README.md
```

## Data Flow

1. User interacts with UI components (App Router pages)
2. Client hooks call internal API routes
3. API routes validate input, authenticate, and call services
4. Services read/write via Prisma to Neon Postgres
5. External APIs (Open Library, Google Books) enrich metadata
6. IndexedDB caches library data for offline access

## Key Services

- `lib/books/service.ts`: Book CRUD, ownership checks, duplicate handling
- `lib/library/sync.ts`: Library snapshot + stats for client caching
- `lib/metadata/*`: Metadata providers with fallback strategy
- `lib/import/*`: CSV parsing, preview, and import execution
- `lib/offline/db.ts`: IndexedDB cache storage
- `lib/auth/*`: JWT, hashing, sessions

## Offline Strategy

- Service worker caches static assets and cover images
- IndexedDB stores full library snapshot
- Library page falls back to cached data
- Certain actions require online access (add, import, lookup)
