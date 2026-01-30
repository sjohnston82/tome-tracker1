# Personal Library ISBN Scanner PWA
# Complete Implementation Blueprint & Code Generation Prompts

## Document Overview

This blueprint provides a complete, step-by-step implementation plan for building a Progressive Web App that allows users to scan book ISBNs, manage a personal library, and check ownership while at bookstores—even offline.

The implementation is broken into **33 prompts** across **9 phases**, each designed for a code-generation LLM to implement in a test-driven manner with real data and API calls.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Implementation Phases](#implementation-phases)
5. [Prompt Index](#prompt-index)
6. [Key Design Decisions](#key-design-decisions)
7. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### What We're Building
A PWA-first application that:
- Scans book barcodes using device cameras
- Maintains a personal library database
- Provides instant "Do I own this?" checks at bookstores
- Works offline for viewing (not adding)
- Organizes books by author with series grouping
- Supports imports from Goodreads/StoryGraph/CSV

### Core Principles
1. **Test-Driven Development**: Every prompt includes tests with real data
2. **Incremental Progress**: Each step builds on the previous
3. **No Orphaned Code**: Everything is integrated before moving on
4. **Real APIs**: Actual API calls, no mocks
5. **Small Steps**: Focused, achievable prompts

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (PWA)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React/    │  │  Service    │  │    IndexedDB +          │  │
│  │   Next.js   │  │  Worker     │  │    Cache Storage        │  │
│  │   UI        │  │  (Offline)  │  │    (Local Data)         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Auth      │  │   Library   │  │    Lookup/Import        │  │
│  │   Routes    │  │   Routes    │  │    Routes               │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────┐  ┌─────────────────────────────────────────┐
│   Neon Postgres     │  │        External Services                │
│   (via Prisma)      │  │  ┌───────────┐  ┌───────────────────┐  │
│                     │  │  │ Open      │  │ Google Books      │  │
│                     │  │  │ Library   │  │ (Fallback)        │  │
│                     │  │  └───────────┘  └───────────────────┘  │
│                     │  │  ┌───────────────────────────────────┐  │
│                     │  │  │ Resend (Email)                    │  │
│                     │  │  └───────────────────────────────────┘  │
└─────────────────────┘  └─────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14+ (App Router) | React-based PWA with SSR |
| Styling | Tailwind CSS | Utility-first CSS |
| State | React Context + IndexedDB | Client state + offline cache |
| Backend | Next.js API Routes | REST endpoints |
| ORM | Prisma | Type-safe database access |
| Database | Neon Postgres | Serverless PostgreSQL |
| Email | Resend | Transactional emails |
| Scanning | ZXing-js | Barcode detection |
| Hosting | Vercel | Deployment platform |

---

## Implementation Phases

### Phase 1: Project Foundation (Prompts 1-3)
Set up the project with all configuration, Prisma schema, and migrations.

### Phase 2: Authentication System (Prompts 4-7)
Complete auth flow including JWT sessions, login/register, password reset, and account deletion.

### Phase 3: Core Library API (Prompts 8-11)
Book CRUD operations, sync endpoint, and author management.

### Phase 4: Metadata Lookup (Prompts 12-14)
Open Library and Google Books integrations with fallback logic.

### Phase 5: Basic UI Shell (Prompts 15-18)
Layout, navigation, auth pages, library list, and book detail pages.

### Phase 6: Scanner & Manual Add (Prompts 19-22)
Camera barcode scanning, scan flow, manual add, and online search.

### Phase 7: Import System (Prompts 23-26)
CSV parsing, Goodreads/StoryGraph support, import UI, and enrichment.

### Phase 8: PWA & Offline (Prompts 27-30)
Service worker, IndexedDB caching, offline UI, and settings.

### Phase 9: Admin & Polish (Prompts 31-33)
Admin dashboard, onboarding, and final integration.

---

## Prompt Index

| # | Phase | Prompt Title | Key Deliverables |
|---|-------|--------------|------------------|
| 1 | Foundation | Project Initialization | Next.js setup, configs, env validation |
| 2 | Foundation | Database Schema | Prisma models (User, Author, Book) |
| 3 | Foundation | Migration & Seed | Migrations, seed data, password utils |
| 4 | Auth | JWT Session Management | Token creation/verification, session helpers |
| 5 | Auth | Register & Login | Auth endpoints with validation |
| 6 | Auth | Logout & Password Reset | Reset flow with Resend email |
| 7 | Auth | Account Deletion & Middleware | Delete endpoint, auth middleware |
| 8 | Library | Book Create & Read | POST/GET book endpoints, ISBN utils |
| 9 | Library | Book Update & Delete | PATCH/DELETE endpoints |
| 10 | Library | Library Sync | Full snapshot endpoint for caching |
| 11 | Library | Author Management | Author listing and detail endpoints |
| 12 | Metadata | Open Library Integration | Primary metadata provider |
| 13 | Metadata | Google Books Fallback | Secondary provider with fallback |
| 14 | Metadata | Lookup API Routes | ISBN lookup and search endpoints |
| 15 | UI | Layout & Navigation | Header, mobile nav, app shell |
| 16 | UI | Authentication Pages | Login, register, forgot password |
| 17 | UI | Library List Page | Author-centric view with grouping |
| 18 | UI | Book Detail Page | View/edit book with delete |
| 19 | Scanner | Barcode Scanner Component | ZXing camera integration |
| 20 | Scanner | Scan Page Integration | Full scan → lookup → add flow |
| 21 | Scanner | Manual Add Form | Form with fuzzy duplicate detection |
| 22 | Scanner | Online Search & Add | Search metadata and add results |
| 23 | Import | CSV Parser | PapaParse, column detection, mapping |
| 24 | Import | Import API Routes | Preview and execute endpoints |
| 25 | Import | Import UI | Upload, mapping, results flow |
| 26 | Import | Background Enrichment | Post-import metadata enrichment |
| 27 | PWA | Service Worker Setup | next-pwa, manifest, caching |
| 28 | PWA | IndexedDB Cache | idb, offline data storage |
| 29 | PWA | Offline Mode UI | Banners, guards, fallbacks |
| 30 | PWA | Settings Page | Theme, cache controls, account |
| 31 | Admin | Admin Dashboard | User list, basic stats |
| 32 | Admin | Onboarding Flow | First-time user tooltips |
| 33 | Admin | Final Integration | README, testing, verification |

---

## Key Design Decisions

### 1. User-Scoped Authors
Each user has their own author records, simplifying deletion cascades and avoiding complex shared-data management.

### 2. ISBN as Primary Deduplication Key
Prevents duplicate books definitively when ISBN is available. Fuzzy matching for manual entries without ISBN.

### 3. Network-First Sync Strategy
Always try to fetch fresh data from the network, falling back to IndexedDB cache only when offline.

### 4. No Offline Adds
Adding books requires network connectivity to fetch metadata and prevent sync conflicts. This dramatically simplifies the architecture.

### 5. Author-Centric UI
Main library view organizes by author (not book title) to better answer "what do I have by this author?"

### 6. Metadata Fallback Chain
Open Library first (free, comprehensive), Google Books fallback (different coverage). Server-side lookup protects API usage.

---

## Testing Strategy

### Unit Tests
- ISBN normalization and validation
- Password hashing and verification
- Validation schemas
- Fuzzy matching algorithms
- Import parsing logic

### Integration Tests
- All API endpoints with real database
- Real calls to Open Library and Google Books
- Full auth flows (register → login → logout)
- Complete scan → add → view flows

### Manual Testing Checklist
- [ ] Register new account
- [ ] Login/logout
- [ ] Password reset flow
- [ ] Scan a book barcode
- [ ] Add book manually
- [ ] Search online and add
- [ ] Import CSV file
- [ ] Edit book details
- [ ] Delete a book
- [ ] Test offline mode
- [ ] Test on mobile device
- [ ] Install as PWA

---

## How to Use These Prompts

1. **Execute prompts sequentially** - Each builds on the previous
2. **Run tests after each prompt** - Verify before moving on
3. **Commit after each successful prompt** - Maintain checkpoints
4. **Read the full prompt** - Context and constraints matter
5. **Check success criteria** - Don't proceed until met

### Example Workflow

```bash
# After implementing Prompt 5 (Register & Login)
npm test -- __tests__/api/auth/register.test.ts
npm test -- __tests__/api/auth/login.test.ts

# If tests pass:
git add .
git commit -m "feat: implement registration and login endpoints"

# Then proceed to Prompt 6
```

---

## File Organization

The prompts create this directory structure:

```
/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, register)
│   ├── api/               # API routes
│   │   ├── auth/          # Auth endpoints
│   │   ├── books/         # Book CRUD
│   │   ├── library/       # Library sync
│   │   ├── lookup/        # Metadata lookup
│   │   ├── import/        # Import endpoints
│   │   └── admin/         # Admin endpoints
│   ├── library/           # Library pages
│   ├── scan/              # Scanner page
│   ├── settings/          # Settings page
│   └── admin/             # Admin pages
│
├── components/            # React components
│   ├── ui/               # Base UI (Button, Input)
│   ├── layout/           # Header, MobileNav
│   ├── library/          # AuthorCard, BookList
│   ├── scanner/          # BarcodeScanner, ScanResult
│   ├── search/           # SearchResults
│   ├── onboarding/       # OnboardingModal
│   └── offline/          # OfflineBanner, OfflineGuard
│
├── lib/                   # Shared libraries
│   ├── api/              # Response helpers, withAuth
│   ├── auth/             # JWT, session, password, validation
│   ├── books/            # ISBN utils, service, fuzzy match
│   ├── authors/          # Author service
│   ├── library/          # Sync service
│   ├── hooks/            # React hooks
│   ├── import/           # Parser, executor
│   ├── metadata/         # OpenLibrary, GoogleBooks
│   ├── offline/          # IndexedDB
│   ├── email/            # Resend
│   └── enrichment/       # Background enrichment
│
├── prisma/               # Database
│   ├── schema.prisma
│   └── seed.ts
│
├── public/               # Static assets
│   ├── manifest.json
│   └── icons/
│
└── __tests__/            # Test files
    ├── api/
    └── lib/
```

---

## Next Steps

1. Start with **Prompt 1** to initialize the project
2. Work through prompts sequentially
3. Run tests after each prompt
4. Commit working code before proceeding
5. Reference this index when you need context

The detailed prompts follow in the accompanying documents.

