# Personal Library ISBN Scanner PWA — Implementation Prompts (Part 3)

## Continued from Part 2...

---

## Prompt 30: Settings Page with Cache Controls (Continued)

```text
Create the settings page with theme, cache, and account controls.

**TASK: Build the complete settings page.**

1. **Create `app/settings/page.tsx`:**
   ```typescript
   'use client'
   
   import { useState } from 'react'
   import { useRouter } from 'next/navigation'
   import { useTheme } from '@/lib/hooks/useTheme'
   import { useOfflineLibrary } from '@/lib/hooks/useOfflineLibrary'
   import { useAuth } from '@/lib/hooks/useAuth'
   import { Button } from '@/components/ui/button'
   
   export default function SettingsPage() {
     const router = useRouter()
     const { theme, setTheme } = useTheme()
     const { cacheStats, clearLocalCache, syncAndCache } = useOfflineLibrary()
     const { logout } = useAuth()
     
     const [syncing, setSyncing] = useState(false)
     const [clearing, setClearing] = useState(false)
     const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
     const [deleting, setDeleting] = useState(false)
     
     const handleSync = async () => {
       setSyncing(true)
       await syncAndCache()
       setSyncing(false)
     }
     
     const handleClearCache = async () => {
       setClearing(true)
       await clearLocalCache()
       setClearing(false)
     }
     
     const handleDeleteAccount = async () => {
       setDeleting(true)
       
       try {
         const response = await fetch('/api/account', {
           method: 'DELETE',
         })
         
         if (response.ok) {
           await clearLocalCache()
           router.push('/login')
         }
       } finally {
         setDeleting(false)
       }
     }
     
     return (
       <div className="max-w-2xl mx-auto px-4 py-6">
         <h1 className="text-2xl font-bold mb-6">Settings</h1>
         
         <div className="space-y-6">
           {/* Appearance */}
           <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
             <h2 className="font-medium text-lg mb-4">Appearance</h2>
             
             <div className="space-y-3">
               <label className="flex items-center gap-3">
                 <input
                   type="radio"
                   name="theme"
                   checked={theme === 'light'}
                   onChange={() => setTheme('light')}
                   className="w-4 h-4"
                 />
                 <span>Light</span>
               </label>
               <label className="flex items-center gap-3">
                 <input
                   type="radio"
                   name="theme"
                   checked={theme === 'dark'}
                   onChange={() => setTheme('dark')}
                   className="w-4 h-4"
                 />
                 <span>Dark</span>
               </label>
               <label className="flex items-center gap-3">
                 <input
                   type="radio"
                   name="theme"
                   checked={theme === 'system'}
                   onChange={() => setTheme('system')}
                   className="w-4 h-4"
                 />
                 <span>System default</span>
               </label>
             </div>
           </section>
           
           {/* Cache & Sync */}
           <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
             <h2 className="font-medium text-lg mb-4">Cache & Sync</h2>
             
             {cacheStats && (
               <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                 <p>Cached: {cacheStats.bookCount} books, {cacheStats.authorCount} authors</p>
                 {cacheStats.lastSync && (
                   <p>Last synced: {new Date(cacheStats.lastSync).toLocaleString()}</p>
                 )}
               </div>
             )}
             
             <div className="flex gap-3">
               <Button
                 variant="secondary"
                 onClick={handleSync}
                 loading={syncing}
               >
                 Sync now
               </Button>
               <Button
                 variant="ghost"
                 onClick={handleClearCache}
                 loading={clearing}
               >
                 Clear cache
               </Button>
             </div>
           </section>
           
           {/* Account */}
           <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
             <h2 className="font-medium text-lg mb-4">Account</h2>
             
             <div className="space-y-4">
               <Button variant="secondary" onClick={logout}>
                 Sign out
               </Button>
               
               <div className="pt-4 border-t dark:border-gray-700">
                 <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                   Permanently delete your account and all your library data.
                 </p>
                 <Button
                   variant="danger"
                   onClick={() => setShowDeleteConfirm(true)}
                 >
                   Delete account
                 </Button>
               </div>
             </div>
           </section>
         </div>
         
         {/* Delete confirmation modal */}
         {showDeleteConfirm && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
             <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
               <h2 className="text-xl font-bold mb-4">Delete account?</h2>
               <p className="text-gray-600 dark:text-gray-400 mb-6">
                 This will permanently delete your account and all your library data.
                 This action cannot be undone.
               </p>
               <div className="flex gap-3 justify-end">
                 <Button
                   variant="secondary"
                   onClick={() => setShowDeleteConfirm(false)}
                 >
                   Cancel
                 </Button>
                 <Button
                   variant="danger"
                   onClick={handleDeleteAccount}
                   loading={deleting}
                 >
                   Delete permanently
                 </Button>
               </div>
             </div>
           </div>
         )}
       </div>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Theme switching works and persists
- Cache stats are displayed
- Sync and clear cache buttons work
- Logout works correctly
- Account deletion with confirmation works
- All states have proper loading indicators

**DO NOT:**
- Add export functionality (out of scope)
- Implement notifications settings
```

---

# Phase 9: Admin & Polish

## Prompt 31: Admin Dashboard

```text
Create the basic admin dashboard for user and log management.

**TASK: Build admin-only pages for viewing users and logs.**

1. **Create `app/admin/layout.tsx`:**
   ```typescript
   import { redirect } from 'next/navigation'
   import { getSession } from '@/lib/auth/session'
   
   export default async function AdminLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     const session = await getSession()
     
     if (!session || session.role !== 'ADMIN') {
       redirect('/library')
     }
     
     return (
       <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
         <div className="max-w-6xl mx-auto px-4 py-6">
           <div className="mb-6">
             <h1 className="text-2xl font-bold">Admin Dashboard</h1>
           </div>
           {children}
         </div>
       </div>
     )
   }
   ```

2. **Create `app/api/admin/users/route.ts`:**
   ```typescript
   import { withAdmin } from '@/lib/api/withAuth'
   import { prisma } from '@/lib/db'
   import { successResponse, handleApiError } from '@/lib/api/response'
   
   export const GET = withAdmin(async () => {
     try {
       const users = await prisma.user.findMany({
         select: {
           id: true,
           email: true,
           role: true,
           createdAt: true,
           _count: {
             select: { books: true },
           },
         },
         orderBy: { createdAt: 'desc' },
         take: 100,
       })
       
       return successResponse({
         users: users.map(u => ({
           id: u.id,
           email: u.email,
           role: u.role,
           createdAt: u.createdAt.toISOString(),
           bookCount: u._count.books,
         })),
       })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

3. **Create `lib/logging/service.ts`:**
   ```typescript
   import { prisma } from '@/lib/db'
   
   // Add a simple Log model to schema first:
   // model Log {
   //   id        String   @id @default(uuid())
   //   level     String   // error, warn, info
   //   message   String
   //   metadata  Json?
   //   createdAt DateTime @default(now())
   //   @@map("logs")
   // }
   
   export async function logError(
     message: string,
     metadata?: Record<string, any>
   ) {
     try {
       // For v1, just console.error
       // In production, could write to DB or external service
       console.error(`[ERROR] ${message}`, metadata)
     } catch {
       // Ignore logging errors
     }
   }
   
   export async function getRecentLogs(limit = 50) {
     // For v1, return empty - implement DB logging later
     return []
   }
   ```

4. **Create `app/admin/page.tsx`:**
   ```typescript
   'use client'
   
   import { useState, useEffect } from 'react'
   
   interface User {
     id: string
     email: string
     role: string
     createdAt: string
     bookCount: number
   }
   
   export default function AdminPage() {
     const [users, setUsers] = useState<User[]>([])
     const [loading, setLoading] = useState(true)
     
     useEffect(() => {
       fetch('/api/admin/users')
         .then(r => r.json())
         .then(data => {
           setUsers(data.users || [])
           setLoading(false)
         })
         .catch(() => setLoading(false))
     }, [])
     
     if (loading) {
       return <div className="text-center py-8">Loading...</div>
     }
     
     return (
       <div className="space-y-6">
         {/* Stats */}
         <div className="grid grid-cols-3 gap-4">
           <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
             <p className="text-3xl font-bold">{users.length}</p>
             <p className="text-gray-600 dark:text-gray-400">Total Users</p>
           </div>
           <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
             <p className="text-3xl font-bold">
               {users.reduce((sum, u) => sum + u.bookCount, 0)}
             </p>
             <p className="text-gray-600 dark:text-gray-400">Total Books</p>
           </div>
           <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
             <p className="text-3xl font-bold">
               {users.filter(u => {
                 const created = new Date(u.createdAt)
                 const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                 return created > weekAgo
               }).length}
             </p>
             <p className="text-gray-600 dark:text-gray-400">New This Week</p>
           </div>
         </div>
         
         {/* Users table */}
         <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
           <table className="w-full">
             <thead className="bg-gray-50 dark:bg-gray-700">
               <tr>
                 <th className="text-left px-6 py-3 text-sm font-medium">Email</th>
                 <th className="text-left px-6 py-3 text-sm font-medium">Role</th>
                 <th className="text-left px-6 py-3 text-sm font-medium">Books</th>
                 <th className="text-left px-6 py-3 text-sm font-medium">Joined</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
               {users.map(user => (
                 <tr key={user.id}>
                   <td className="px-6 py-4 text-sm">{user.email}</td>
                   <td className="px-6 py-4 text-sm">
                     <span className={`px-2 py-1 rounded text-xs ${
                       user.role === 'ADMIN'
                         ? 'bg-purple-100 text-purple-800'
                         : 'bg-gray-100 text-gray-800'
                     }`}>
                       {user.role}
                     </span>
                   </td>
                   <td className="px-6 py-4 text-sm">{user.bookCount}</td>
                   <td className="px-6 py-4 text-sm">
                     {new Date(user.createdAt).toLocaleDateString()}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </div>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Admin layout restricts access to admin users
- User list displays with book counts
- Basic stats are shown
- Non-admins are redirected

**DO NOT:**
- Add user management actions (edit/delete)
- Implement complex logging infrastructure
```

---

## Prompt 32: Onboarding Flow

```text
Create the onboarding tooltips for new users.

**TASK: Build a simple onboarding experience for first-time users.**

1. **Create `lib/hooks/useOnboarding.ts`:**
   ```typescript
   'use client'
   
   import { useState, useEffect } from 'react'
   
   const ONBOARDING_KEY = 'library-onboarding-complete'
   
   export function useOnboarding() {
     const [showOnboarding, setShowOnboarding] = useState(false)
     const [step, setStep] = useState(0)
     
     useEffect(() => {
       const complete = localStorage.getItem(ONBOARDING_KEY)
       if (!complete) {
         setShowOnboarding(true)
       }
     }, [])
     
     const nextStep = () => {
       setStep(s => s + 1)
     }
     
     const completeOnboarding = () => {
       localStorage.setItem(ONBOARDING_KEY, 'true')
       setShowOnboarding(false)
     }
     
     const resetOnboarding = () => {
       localStorage.removeItem(ONBOARDING_KEY)
       setShowOnboarding(true)
       setStep(0)
     }
     
     return {
       showOnboarding,
       step,
       nextStep,
       completeOnboarding,
       resetOnboarding,
     }
   }
   ```

2. **Create `components/onboarding/onboarding-modal.tsx`:**
   ```typescript
   'use client'
   
   import { useOnboarding } from '@/lib/hooks/useOnboarding'
   import { Button } from '@/components/ui/button'
   
   const STEPS = [
     {
       title: 'Welcome to Tome Tracker! 📚',
       content: 'Keep track of your book collection and never buy duplicates again.',
       image: '📱',
     },
     {
       title: 'Scan Books Instantly',
       content: 'Use your camera to scan book barcodes. The app will automatically look up the book and add it to your library.',
       image: '📷',
     },
     {
       title: 'Works Offline (for viewing)',
       content: 'Your library is cached on your device. You can browse and search your collection even without internet. Adding new books requires a connection.',
       image: '📡',
     },
   ]
   
   export function OnboardingModal() {
     const { showOnboarding, step, nextStep, completeOnboarding } = useOnboarding()
     
     if (!showOnboarding) return null
     
     const currentStep = STEPS[step]
     const isLastStep = step === STEPS.length - 1
     
     return (
       <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
         <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
           <div className="text-6xl mb-6">{currentStep.image}</div>
           
           <h2 className="text-2xl font-bold mb-4">{currentStep.title}</h2>
           
           <p className="text-gray-600 dark:text-gray-400 mb-8">
             {currentStep.content}
           </p>
           
           {/* Progress dots */}
           <div className="flex justify-center gap-2 mb-6">
             {STEPS.map((_, i) => (
               <div
                 key={i}
                 className={`w-2 h-2 rounded-full ${
                   i === step
                     ? 'bg-blue-600'
                     : 'bg-gray-300 dark:bg-gray-600'
                 }`}
               />
             ))}
           </div>
           
           <div className="flex gap-3 justify-center">
             {!isLastStep ? (
               <>
                 <Button variant="ghost" onClick={completeOnboarding}>
                   Skip
                 </Button>
                 <Button onClick={nextStep}>
                   Next
                 </Button>
               </>
             ) : (
               <Button onClick={completeOnboarding} className="px-8">
                 Get Started
               </Button>
             )}
           </div>
         </div>
       </div>
     )
   }
   ```

3. **Add onboarding to library page:**
   ```typescript
   // In app/library/page.tsx
   import { OnboardingModal } from '@/components/onboarding/onboarding-modal'
   
   export default function LibraryPage() {
     return (
       <>
         <OnboardingModal />
         {/* rest of library page */}
       </>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Onboarding shows on first visit
- User can skip or complete onboarding
- Progress dots show current step
- Completion is persisted in localStorage

**DO NOT:**
- Create complex tooltip positioning
- Add too many steps
```

---

## Prompt 33: Final Integration and Testing

```text
Complete the final integration, ensure all pieces work together, and create the README.

**TASK: Wire everything together and create documentation.**

1. **Create comprehensive `README.md`:**
   ```markdown
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
   ```

2. **Create `.env.example`:**
   ```
   # Database (Neon Postgres)
   DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
   
   # Auth
   JWT_SECRET=your-secret-key-at-least-32-characters-long
   
   # Email (Resend)
   RESEND_API_KEY=re_xxxxxxxxxxxx
   
   # App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. **Final integration checks - update `package.json` scripts:**
   ```json
   {
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "lint": "next lint",
       "test": "vitest",
       "test:watch": "vitest --watch",
       "test:coverage": "vitest --coverage",
       "db:migrate": "prisma migrate dev",
       "db:push": "prisma db push",
       "db:seed": "prisma db seed",
       "db:studio": "prisma studio",
       "postinstall": "prisma generate"
     }
   }
   ```

4. **Create `ARCHITECTURE.md`:**
   ```markdown
   # Architecture Overview
   
   ## Directory Structure
   
   ```
   /
   ├── app/                    # Next.js App Router
   │   ├── (auth)/            # Auth pages (login, register)
   │   ├── api/               # API routes
   │   ├── library/           # Library pages
   │   ├── scan/              # Scanner page
   │   ├── settings/          # Settings page
   │   └── admin/             # Admin pages
   │
   ├── components/            # React components
   │   ├── ui/               # Base UI components
   │   ├── layout/           # Layout components
   │   ├── library/          # Library-specific components
   │   ├── scanner/          # Scanner components
   │   └── onboarding/       # Onboarding components
   │
   ├── lib/                   # Shared libraries
   │   ├── api/              # API utilities
   │   ├── auth/             # Auth utilities
   │   ├── books/            # Book utilities
   │   ├── hooks/            # React hooks
   │   ├── import/           # Import utilities
   │   ├── metadata/         # Metadata providers
   │   └── offline/          # Offline/IndexedDB
   │
   ├── prisma/               # Database schema
   └── public/               # Static assets
   ```
   
   ## Data Flow
   
   1. User actions trigger API calls
   2. API routes validate and process requests
   3. Prisma handles database operations
   4. Responses update React state
   5. Service worker caches for offline
   
   ## Key Design Decisions
   
   - **User-scoped authors**: Each user has their own author records
   - **ISBN as primary dedup key**: Prevents duplicate books
   - **Network-first sync**: Always try network, fall back to cache
   - **No offline adds**: Simplifies conflict resolution
   ```

**SUCCESS CRITERIA:**
- All components are properly imported and wired
- README provides complete setup instructions
- All tests pass
- App builds without errors
- PWA installs on mobile

**FINAL VERIFICATION:**
- Run `npm run build` - should complete successfully
- Run `npm test` - all tests should pass
- Run `npm run lint` - no errors
- Test full flow: register → add book → view → offline
```

---

# Summary: Implementation Order

## Phase 1: Foundation (Prompts 1-3)
1. Project initialization and configuration
2. Database schema with Prisma models
3. Database migration and seed setup

## Phase 2: Authentication (Prompts 4-7)
4. JWT session management
5. Register and login endpoints
6. Logout and password reset
7. Account deletion and middleware

## Phase 3: Core Library API (Prompts 8-11)
8. Book create and read
9. Book update and delete
10. Library sync endpoint
11. Author management

## Phase 4: Metadata Lookup (Prompts 12-14)
12. Open Library integration
13. Google Books fallback
14. Lookup API routes

## Phase 5: Basic UI (Prompts 15-18)
15. Layout and navigation
16. Authentication pages
17. Library list page
18. Book detail page

## Phase 6: Scanner & Manual Add (Prompts 19-22)
19. Barcode scanner component
20. Scan page integration
21. Manual add form
22. Online search and add

## Phase 7: Import System (Prompts 23-26)
23. CSV import parser
24. Import API routes
25. Import UI
26. Background enrichment

## Phase 8: PWA & Offline (Prompts 27-30)
27. Service worker setup
28. IndexedDB local cache
29. Offline mode UI
30. Settings page

## Phase 9: Admin & Polish (Prompts 31-33)
31. Admin dashboard
32. Onboarding flow
33. Final integration and documentation

---

# Key Principles Followed

1. **Test-Driven Development**: Each prompt includes tests with real data
2. **Incremental Progress**: Each step builds on the previous
3. **No Orphaned Code**: Everything is integrated before moving on
4. **Real APIs**: No mocks - actual API calls in tests
5. **Small Steps**: Each prompt is focused and achievable
6. **Clear Success Criteria**: Know when each step is complete

