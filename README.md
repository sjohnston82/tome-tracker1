# Tome Tracker PWA

A Progressive Web App for scanning and managing your personal book library.

## Features

- 📷 Scan book barcodes with your camera
- 📚 Organize books by author with series grouping
- 🔍 Search your library and online databases
- 📥 Import from Goodreads, StoryGraph, or CSV
- 📴 Offline viewing of your library
- 🌙 Dark mode support

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Neon Postgres with Prisma ORM
- **Auth**: JWT with httpOnly cookies
- **Email**: Resend
- **Metadata**: Open Library + Google Books APIs

## Prerequisites

- Node.js 18+
- npm or yarn
- Neon Postgres account (free tier works)
- Resend account for emails (free tier works)

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd tome-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure environment variables in `.env.local`:
   ```
   DATABASE_URL=postgresql://...  # From Neon dashboard
   JWT_SECRET=your-secure-secret-min-32-chars
   RESEND_API_KEY=re_...          # From Resend dashboard
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. (Optional) Seed test data:
   ```bash
   npx prisma db seed
   ```

7. Start development server:
   ```bash
   npm run dev
   ```

8. Open http://localhost:3000

## Deployment to Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Configure environment variables in Vercel:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
4. Deploy!

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- __tests__/lib/isbn.test.ts
```

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
- [ ] Test offline mode (disconnect network, browse library)
- [ ] Test on mobile device

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/password-reset/request` - Request reset
- `POST /api/auth/password-reset/confirm` - Confirm reset

### Account
- `GET /api/account` - Get current user
- `DELETE /api/account` - Delete account

### Library
- `GET /api/library/sync` - Get full library
- `GET /api/library/check?isbn=...` - Check ownership

### Books
- `POST /api/books` - Add book
- `GET /api/books/:id` - Get book
- `PATCH /api/books/:id` - Update book
- `DELETE /api/books/:id` - Delete book

### Lookup
- `GET /api/lookup/isbn/:code` - Lookup by ISBN
- `GET /api/lookup/search?q=...` - Search online

### Import
- `POST /api/import/preview` - Preview CSV
- `POST /api/import/execute` - Execute import

## Architecture

```
Client (PWA)
    │
    ├── React UI (Next.js App Router)
    ├── Service Worker (offline caching)
    └── IndexedDB (local library cache)
    │
    ▼
Next.js API Routes
    │
    ├── Auth (JWT cookies)
    ├── Library CRUD
    └── Metadata lookup
    │
    ▼
Neon Postgres (via Prisma)
    │
    ▼
External APIs
    ├── Open Library
    ├── Google Books
    └── Resend
```

## Offline Behavior

- ✅ View library
- ✅ Search cached books
- ✅ Check ownership (cached)
- ❌ Add new books
- ❌ Import
- ❌ Search online

## License

MIT

