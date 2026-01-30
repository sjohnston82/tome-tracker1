# Tome Tracker PWA - Implementation Prompts
# Phase 1: Foundation & Phase 2: Authentication (Prompts 1-7)

---

## Prompt 1: Project Initialization and Configuration

```text
You are building a Personal Library ISBN Scanner PWA using Next.js 14+ with the App Router, TypeScript, Tailwind CSS, Prisma, and Neon Postgres.

**TASK: Initialize the project with all necessary configuration files.**

Create the following project structure:

1. Initialize a new Next.js project with:
   - TypeScript enabled
   - Tailwind CSS configured
   - App Router (not Pages Router)
   - ESLint configured

2. Install and configure these dependencies:
   ```
   Production:
   - prisma (dev dependency)
   - @prisma/client
   - bcryptjs + @types/bcryptjs
   - jose (for JWT)
   - resend
   - zod (validation)
   
   Dev:
   - vitest
   - @testing-library/react
   - @testing-library/jest-dom
   ```

3. Create configuration files:
   
   a) `prisma/schema.prisma` - Start with just the datasource and generator:
   ```prisma
   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

   b) `.env.example` with all required environment variables:
   ```
   DATABASE_URL=
   JWT_SECRET=
   RESEND_API_KEY=
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   c) `vitest.config.ts` for testing:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   import path from 'path'

   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       globals: true,
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './'),
       },
     },
   })
   ```

   d) `lib/env.ts` - Environment variable validation using Zod:
   ```typescript
   import { z } from 'zod'

   const envSchema = z.object({
     DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
     JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
     RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
     NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
   })

   function validateEnv() {
     const parsed = envSchema.safeParse(process.env)
     
     if (!parsed.success) {
       console.error('❌ Invalid environment variables:')
       console.error(parsed.error.flatten().fieldErrors)
       throw new Error('Invalid environment variables')
     }
     
     return parsed.data
   }

   export const env = validateEnv()
   ```

4. Create a basic `app/layout.tsx` with:
   ```typescript
   import type { Metadata, Viewport } from 'next'
   import { Inter } from 'next/font/google'
   import './globals.css'

   const inter = Inter({ subsets: ['latin'] })

   export const metadata: Metadata = {
     title: 'Tome Tracker',
     description: 'Scan and manage your personal book library',
   }

   export const viewport: Viewport = {
     width: 'device-width',
     initialScale: 1,
     maximumScale: 1,
   }

   export default function RootLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return (
       <html lang="en">
         <body className={inter.className}>{children}</body>
       </html>
     )
   }
   ```

5. Create `app/page.tsx` as a simple placeholder:
   ```typescript
   export default function Home() {
     return (
       <main className="min-h-screen flex items-center justify-center">
         <h1 className="text-2xl font-bold">Tome Tracker</h1>
       </main>
     )
   }
   ```

6. Create `lib/db.ts` - Prisma client singleton:
   ```typescript
   import { PrismaClient } from '@prisma/client'

   const globalForPrisma = globalThis as unknown as {
     prisma: PrismaClient | undefined
   }

   export const prisma = globalForPrisma.prisma ?? new PrismaClient()

   if (process.env.NODE_ENV !== 'production') {
     globalForPrisma.prisma = prisma
   }
   ```

**SUCCESS CRITERIA:**
- `npm run dev` starts without errors
- `npm run lint` passes
- `npm run build` succeeds
- TypeScript compilation has no errors
- Environment validation throws clear error when DATABASE_URL is missing

**DO NOT:**
- Add any database models yet
- Create any API routes yet
- Add authentication logic
```

---

## Prompt 2: Database Schema - Core Models

```text
Building on the initialized Next.js project, now create the Prisma database schema.

**TASK: Define the complete Prisma schema with all models and relationships.**

Update `prisma/schema.prisma` with these models:

1. **User Model**
   ```prisma
   model User {
     id            String   @id @default(uuid())
     email         String   @unique
     passwordHash  String   @map("password_hash")
     role          Role     @default(USER)
     createdAt     DateTime @default(now()) @map("created_at")
     updatedAt     DateTime @updatedAt @map("updated_at")
     
     books         Book[]
     authors       Author[]
     
     @@map("users")
   }
   
   enum Role {
     USER
     ADMIN
   }
   ```

2. **Author Model** (user-scoped for simplicity)
   ```prisma
   model Author {
     id             String   @id @default(uuid())
     userId         String   @map("user_id")
     name           String
     bio            String?
     photoUrl       String?  @map("photo_url")
     externalSource String?  @map("external_source")
     externalId     String?  @map("external_id")
     createdAt      DateTime @default(now()) @map("created_at")
     updatedAt      DateTime @updatedAt @map("updated_at")
     
     user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     books          Book[]
     
     @@unique([userId, name])
     @@map("authors")
   }
   ```

3. **Book Model**
   ```prisma
   model Book {
     id              String     @id @default(uuid())
     userId          String     @map("user_id")
     authorId        String     @map("author_id")
     title           String
     isbn13          String?
     isbn10          String?
     publisher       String?
     publicationYear Int?       @map("publication_year")
     coverUrl        String?    @map("cover_url")
     seriesName      String?    @map("series_name")
     seriesNumber    Float?     @map("series_number")
     tags            String[]   @default([])
     genres          String[]   @default([])
     source          BookSource
     createdAt       DateTime   @default(now()) @map("created_at")
     updatedAt       DateTime   @updatedAt @map("updated_at")
     
     user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
     author          Author     @relation(fields: [authorId], references: [id], onDelete: Cascade)
     
     @@unique([userId, isbn13])
     @@index([userId])
     @@index([authorId])
     @@map("books")
   }
   
   enum BookSource {
     SCAN
     MANUAL
     IMPORT
   }
   ```

4. **PasswordResetToken Model**
   ```prisma
   model PasswordResetToken {
     id        String   @id @default(uuid())
     userId    String   @map("user_id")
     token     String   @unique
     expiresAt DateTime @map("expires_at")
     createdAt DateTime @default(now()) @map("created_at")
     
     @@map("password_reset_tokens")
   }
   ```

**After creating the schema:**

1. Create `lib/types/index.ts` with TypeScript types for client-side use:
   ```typescript
   export interface User {
     id: string
     email: string
     role: 'USER' | 'ADMIN'
     createdAt: string
   }

   export interface Author {
     id: string
     name: string
     bio: string | null
     photoUrl: string | null
   }

   export interface Book {
     id: string
     title: string
     isbn13: string | null
     isbn10: string | null
     publisher: string | null
     publicationYear: number | null
     coverUrl: string | null
     seriesName: string | null
     seriesNumber: number | null
     tags: string[]
     genres: string[]
     source: 'SCAN' | 'MANUAL' | 'IMPORT'
     author: Author
     createdAt: string
     updatedAt: string
   }
   ```

2. Create a test file `__tests__/schema.test.ts`:
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { PrismaClient } from '@prisma/client'

   describe('Database Schema', () => {
     it('can import Prisma client', () => {
       const prisma = new PrismaClient()
       expect(prisma).toBeDefined()
     })

     it('has correct enums', async () => {
       const { Role, BookSource } = await import('@prisma/client')
       
       expect(Role.USER).toBe('USER')
       expect(Role.ADMIN).toBe('ADMIN')
       expect(BookSource.SCAN).toBe('SCAN')
       expect(BookSource.MANUAL).toBe('MANUAL')
       expect(BookSource.IMPORT).toBe('IMPORT')
     })
   })
   ```

**SUCCESS CRITERIA:**
- `npx prisma validate` passes
- `npx prisma generate` succeeds
- TypeScript types are properly generated
- Test file verifies schema structure

**DO NOT:**
- Run migrations yet (we need Neon connected first)
- Create any API routes
- Add authentication logic
```

---

## Prompt 3: Database Migration and Seed Setup

```text
With the Prisma schema defined, now set up database migrations and seeding.

**TASK: Create migration, seed script, and database utility functions.**

1. **Set up Neon database:**
   - Create a Neon project at https://neon.tech (free tier)
   - Copy the connection string
   - Create `.env.local` with your DATABASE_URL

2. **Create the initial migration:**
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Create `lib/auth/password.ts`:**
   ```typescript
   import bcrypt from 'bcryptjs'

   const SALT_ROUNDS = 12

   export async function hashPassword(password: string): Promise<string> {
     return bcrypt.hash(password, SALT_ROUNDS)
   }

   export async function verifyPassword(
     password: string,
     hash: string
   ): Promise<boolean> {
     return bcrypt.compare(password, hash)
   }
   ```

4. **Create `lib/auth/validation.ts`:**
   ```typescript
   import { z } from 'zod'

   // Password: min 12 chars, at least 1 number, 1 symbol
   export const passwordSchema = z
     .string()
     .min(12, 'Password must be at least 12 characters')
     .regex(/[0-9]/, 'Password must contain at least one number')
     .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol')

   export const emailSchema = z
     .string()
     .email('Invalid email address')
     .toLowerCase()

   export const registerSchema = z.object({
     email: emailSchema,
     password: passwordSchema,
   })

   export const loginSchema = z.object({
     email: emailSchema,
     password: z.string().min(1, 'Password is required'),
   })
   ```

5. **Create `prisma/seed.ts`:**
   ```typescript
   import { PrismaClient, Role, BookSource } from '@prisma/client'
   import { hashPassword } from '../lib/auth/password'

   const prisma = new PrismaClient()

   async function main() {
     console.log('Starting seed...')

     // Create test user
     const testUser = await prisma.user.upsert({
       where: { email: 'test@example.com' },
       update: {},
       create: {
         email: 'test@example.com',
         passwordHash: await hashPassword('TestPassword123!'),
         role: Role.USER,
       },
     })
     console.log('Created test user:', testUser.email)

     // Create admin user
     const adminUser = await prisma.user.upsert({
       where: { email: 'admin@example.com' },
       update: {},
       create: {
         email: 'admin@example.com',
         passwordHash: await hashPassword('AdminPassword123!'),
         role: Role.ADMIN,
       },
     })
     console.log('Created admin user:', adminUser.email)

     // Create sample author for test user
     const author = await prisma.author.upsert({
       where: {
         userId_name: { userId: testUser.id, name: 'Brandon Sanderson' },
       },
       update: {},
       create: {
         userId: testUser.id,
         name: 'Brandon Sanderson',
         bio: 'American fantasy and science fiction writer',
       },
     })
     console.log('Created author:', author.name)

     // Create sample book
     const book = await prisma.book.upsert({
       where: {
         userId_isbn13: { userId: testUser.id, isbn13: '9780765311788' },
       },
       update: {},
       create: {
         userId: testUser.id,
         authorId: author.id,
         title: 'Mistborn: The Final Empire',
         isbn13: '9780765311788',
         isbn10: '0765311785',
         publisher: 'Tor Books',
         publicationYear: 2006,
         seriesName: 'Mistborn',
         seriesNumber: 1,
         source: BookSource.MANUAL,
       },
     })
     console.log('Created book:', book.title)

     console.log('Seed completed successfully!')
   }

   main()
     .catch((e) => {
       console.error('Seed error:', e)
       process.exit(1)
     })
     .finally(async () => {
       await prisma.$disconnect()
     })
   ```

6. **Update `package.json`:**
   ```json
   {
     "prisma": {
       "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
     }
   }
   ```

7. **Create test `__tests__/auth/password.test.ts`:**
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { hashPassword, verifyPassword } from '@/lib/auth/password'

   describe('Password utilities', () => {
     it('hashes password and verifies correctly', async () => {
       const password = 'TestPassword123!'
       const hash = await hashPassword(password)

       expect(hash).not.toBe(password)
       expect(hash.length).toBeGreaterThan(50)
       expect(await verifyPassword(password, hash)).toBe(true)
       expect(await verifyPassword('wrongpassword', hash)).toBe(false)
     })

     it('generates different hashes for same password', async () => {
       const password = 'TestPassword123!'
       const hash1 = await hashPassword(password)
       const hash2 = await hashPassword(password)

       expect(hash1).not.toBe(hash2)
       // Both should still verify
       expect(await verifyPassword(password, hash1)).toBe(true)
       expect(await verifyPassword(password, hash2)).toBe(true)
     })

     it('takes reasonable time for security', async () => {
       const start = Date.now()
       await hashPassword('TestPassword123!')
       const duration = Date.now() - start

       // Should take at least 100ms with 12 rounds
       expect(duration).toBeGreaterThan(50)
     })
   })
   ```

8. **Create test `__tests__/auth/validation.test.ts`:**
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { passwordSchema, emailSchema, registerSchema } from '@/lib/auth/validation'

   describe('Validation schemas', () => {
     describe('passwordSchema', () => {
       it('accepts valid passwords', () => {
         expect(passwordSchema.safeParse('ValidPass123!').success).toBe(true)
         expect(passwordSchema.safeParse('MySecure@Pass99').success).toBe(true)
         expect(passwordSchema.safeParse('Complex#Pass1234').success).toBe(true)
       })

       it('rejects short passwords', () => {
         const result = passwordSchema.safeParse('Short1!')
         expect(result.success).toBe(false)
       })

       it('rejects passwords without numbers', () => {
         const result = passwordSchema.safeParse('NoNumbersHere!')
         expect(result.success).toBe(false)
       })

       it('rejects passwords without symbols', () => {
         const result = passwordSchema.safeParse('NoSymbolsHere123')
         expect(result.success).toBe(false)
       })
     })

     describe('emailSchema', () => {
       it('accepts valid emails and lowercases them', () => {
         expect(emailSchema.parse('Test@Example.COM')).toBe('test@example.com')
         expect(emailSchema.parse('USER@DOMAIN.ORG')).toBe('user@domain.org')
       })

       it('rejects invalid emails', () => {
         expect(emailSchema.safeParse('notanemail').success).toBe(false)
         expect(emailSchema.safeParse('missing@').success).toBe(false)
         expect(emailSchema.safeParse('@nodomain.com').success).toBe(false)
       })
     })

     describe('registerSchema', () => {
       it('validates complete registration data', () => {
         const result = registerSchema.safeParse({
           email: 'test@example.com',
           password: 'ValidPassword123!',
         })
         expect(result.success).toBe(true)
       })

       it('rejects invalid registration data', () => {
         const result = registerSchema.safeParse({
           email: 'invalid',
           password: 'short',
         })
         expect(result.success).toBe(false)
       })
     })
   })
   ```

**SUCCESS CRITERIA:**
- `npx prisma migrate dev` creates migration successfully
- `npx prisma db seed` populates test data
- `npm test` runs all tests and they pass
- Password hashing takes reasonable time (>50ms for security)
- Validation correctly enforces all password rules

**DO NOT:**
- Create API routes yet
- Implement JWT/session handling
- Create UI components
```

---

## Prompt 4: JWT Session Management

```text
With password utilities in place, now implement JWT-based session management.

**TASK: Create JWT utilities and session management functions.**

1. **Create `lib/auth/jwt.ts`:**
   ```typescript
   import { SignJWT, jwtVerify, JWTPayload } from 'jose'

   export interface SessionPayload extends JWTPayload {
     userId: string
     email: string
     role: 'USER' | 'ADMIN'
   }

   const getSecret = () => {
     const secret = process.env.JWT_SECRET
     if (!secret) {
       throw new Error('JWT_SECRET environment variable is not set')
     }
     return new TextEncoder().encode(secret)
   }

   const ALG = 'HS256'
   const EXPIRATION = '7d'

   export async function createToken(
     payload: Omit<SessionPayload, 'iat' | 'exp'>
   ): Promise<string> {
     return new SignJWT(payload)
       .setProtectedHeader({ alg: ALG })
       .setIssuedAt()
       .setExpirationTime(EXPIRATION)
       .sign(getSecret())
   }

   export async function verifyToken(token: string): Promise<SessionPayload | null> {
     try {
       const { payload } = await jwtVerify(token, getSecret())
       return payload as SessionPayload
     } catch {
       return null
     }
   }
   ```

2. **Create `lib/auth/session.ts`:**
   ```typescript
   import { cookies } from 'next/headers'
   import { createToken, verifyToken, SessionPayload } from './jwt'

   const COOKIE_NAME = 'session'

   const getCookieOptions = () => ({
     httpOnly: true,
     secure: process.env.NODE_ENV === 'production',
     sameSite: 'lax' as const,
     path: '/',
     maxAge: 60 * 60 * 24 * 7, // 7 days
   })

   export async function createSession(user: {
     id: string
     email: string
     role: 'USER' | 'ADMIN'
   }): Promise<void> {
     const token = await createToken({
       userId: user.id,
       email: user.email,
       role: user.role,
     })

     const cookieStore = await cookies()
     cookieStore.set(COOKIE_NAME, token, getCookieOptions())
   }

   export async function getSession(): Promise<SessionPayload | null> {
     const cookieStore = await cookies()
     const token = cookieStore.get(COOKIE_NAME)?.value

     if (!token) return null
     return verifyToken(token)
   }

   export async function destroySession(): Promise<void> {
     const cookieStore = await cookies()
     cookieStore.delete(COOKIE_NAME)
   }

   export async function requireAuth(): Promise<SessionPayload> {
     const session = await getSession()
     if (!session) {
       throw new Error('Unauthorized')
     }
     return session
   }

   export async function requireAdmin(): Promise<SessionPayload> {
     const session = await requireAuth()
     if (session.role !== 'ADMIN') {
       throw new Error('Forbidden')
     }
     return session
   }

   export { type SessionPayload }
   ```

3. **Create `lib/api/response.ts`:**
   ```typescript
   import { NextResponse } from 'next/server'
   import { ZodError } from 'zod'

   export interface ApiError {
     error_code: string
     message: string
     details?: unknown
   }

   export function successResponse<T>(data: T, status = 200) {
     return NextResponse.json(data, { status })
   }

   export function errorResponse(
     errorCode: string,
     message: string,
     status: number,
     details?: unknown
   ) {
     const body: ApiError = { error_code: errorCode, message }
     if (details) body.details = details
     return NextResponse.json(body, { status })
   }

   export function handleApiError(error: unknown) {
     console.error('API Error:', error)

     if (error instanceof ZodError) {
       return errorResponse(
         'VALIDATION_ERROR',
         'Invalid request data',
         400,
         error.flatten().fieldErrors
       )
     }

     if (error instanceof Error) {
       if (error.message === 'Unauthorized') {
         return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
       }
       if (error.message === 'Forbidden') {
         return errorResponse('FORBIDDEN', 'Insufficient permissions', 403)
       }
     }

     return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500)
   }

   // Simple in-memory rate limiter for serverless
   const rateLimits = new Map<string, { count: number; resetAt: number }>()

   export function checkRateLimit(
     key: string,
     limit: number,
     windowMs: number
   ): { allowed: boolean; remaining: number } {
     const now = Date.now()
     const record = rateLimits.get(key)

     if (!record || record.resetAt < now) {
       rateLimits.set(key, { count: 1, resetAt: now + windowMs })
       return { allowed: true, remaining: limit - 1 }
     }

     if (record.count >= limit) {
       return { allowed: false, remaining: 0 }
     }

     record.count++
     return { allowed: true, remaining: limit - record.count }
   }
   ```

4. **Create test `__tests__/auth/jwt.test.ts`:**
   ```typescript
   import { describe, it, expect, beforeAll } from 'vitest'
   import { createToken, verifyToken } from '@/lib/auth/jwt'

   // Set test JWT secret
   beforeAll(() => {
     process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-testing'
   })

   describe('JWT utilities', () => {
     const testPayload = {
       userId: 'user-123',
       email: 'test@example.com',
       role: 'USER' as const,
     }

     it('creates and verifies valid token', async () => {
       const token = await createToken(testPayload)

       expect(token).toBeDefined()
       expect(typeof token).toBe('string')
       expect(token.split('.')).toHaveLength(3) // JWT format

       const verified = await verifyToken(token)

       expect(verified).not.toBeNull()
       expect(verified?.userId).toBe(testPayload.userId)
       expect(verified?.email).toBe(testPayload.email)
       expect(verified?.role).toBe(testPayload.role)
     })

     it('returns null for invalid token', async () => {
       const result = await verifyToken('invalid-token')
       expect(result).toBeNull()
     })

     it('returns null for tampered token', async () => {
       const token = await createToken(testPayload)
       const tampered = token.slice(0, -5) + 'xxxxx'
       const result = await verifyToken(tampered)
       expect(result).toBeNull()
     })

     it('returns null for empty token', async () => {
       const result = await verifyToken('')
       expect(result).toBeNull()
     })

     it('includes issued at and expiration', async () => {
       const token = await createToken(testPayload)
       const verified = await verifyToken(token)

       expect(verified?.iat).toBeDefined()
       expect(verified?.exp).toBeDefined()
       expect(verified!.exp! > verified!.iat!).toBe(true)
     })
   })
   ```

**SUCCESS CRITERIA:**
- JWT tokens are created with correct payload
- Tokens are verified correctly
- Invalid/tampered tokens return null
- Session functions use httpOnly, secure cookies
- All tests pass

**DO NOT:**
- Create API routes yet
- Store sessions in database
- Implement refresh tokens
```

---

## Prompt 5: Auth API Routes - Register and Login

```text
With session management ready, create the registration and login API routes.

**TASK: Implement POST /api/auth/register and POST /api/auth/login endpoints.**

1. **Create `app/api/auth/register/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { prisma } from '@/lib/db'
   import { hashPassword } from '@/lib/auth/password'
   import { createSession } from '@/lib/auth/session'
   import { registerSchema } from '@/lib/auth/validation'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

   export async function POST(request: NextRequest) {
     try {
       const body = await request.json()
       const { email, password } = registerSchema.parse(body)

       // Check if user exists
       const existing = await prisma.user.findUnique({
         where: { email },
       })

       if (existing) {
         return errorResponse(
           'EMAIL_EXISTS',
           'An account with this email already exists',
           409
         )
       }

       // Create user
       const user = await prisma.user.create({
         data: {
           email,
           passwordHash: await hashPassword(password),
         },
       })

       // Create session
       await createSession({
         id: user.id,
         email: user.email,
         role: user.role,
       })

       return successResponse(
         {
           user: {
             id: user.id,
             email: user.email,
             role: user.role,
           },
         },
         201
       )
     } catch (error) {
       return handleApiError(error)
     }
   }
   ```

2. **Create `app/api/auth/login/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { prisma } from '@/lib/db'
   import { verifyPassword } from '@/lib/auth/password'
   import { createSession } from '@/lib/auth/session'
   import { loginSchema } from '@/lib/auth/validation'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

   export async function POST(request: NextRequest) {
     try {
       const body = await request.json()
       const { email, password } = loginSchema.parse(body)

       // Find user
       const user = await prisma.user.findUnique({
         where: { email },
       })

       if (!user) {
         return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401)
       }

       // Verify password
       const valid = await verifyPassword(password, user.passwordHash)

       if (!valid) {
         return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401)
       }

       // Create session
       await createSession({
         id: user.id,
         email: user.email,
         role: user.role,
       })

       return successResponse({
         user: {
           id: user.id,
           email: user.email,
           role: user.role,
         },
       })
     } catch (error) {
       return handleApiError(error)
     }
   }
   ```

3. **Create integration test `__tests__/api/auth/register.test.ts`:**
   ```typescript
   import { describe, it, expect, afterEach } from 'vitest'
   import { prisma } from '@/lib/db'

   // NOTE: These tests require the dev server to be running
   // Run with: npm run dev & npm test

   describe('POST /api/auth/register', () => {
     const testEmail = `test-register-${Date.now()}@example.com`

     afterEach(async () => {
       // Clean up test user
       await prisma.user.deleteMany({
         where: { email: testEmail },
       })
     })

     it('creates a new user with valid data', async () => {
       const response = await fetch('http://localhost:3000/api/auth/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: 'ValidPassword123!',
         }),
       })

       expect(response.status).toBe(201)

       const data = await response.json()
       expect(data.user.email).toBe(testEmail)
       expect(data.user.role).toBe('USER')
       expect(data.user.id).toBeDefined()

       // Verify user exists in database
       const user = await prisma.user.findUnique({
         where: { email: testEmail },
       })
       expect(user).not.toBeNull()
       expect(user?.email).toBe(testEmail)

       // Check for session cookie
       const cookies = response.headers.get('set-cookie')
       expect(cookies).toContain('session=')
     })

     it('rejects duplicate email', async () => {
       // Create user first
       await fetch('http://localhost:3000/api/auth/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: 'ValidPassword123!',
         }),
       })

       // Try to create again
       const response = await fetch('http://localhost:3000/api/auth/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: 'AnotherPassword123!',
         }),
       })

       expect(response.status).toBe(409)
       const data = await response.json()
       expect(data.error_code).toBe('EMAIL_EXISTS')
     })

     it('rejects weak passwords', async () => {
       const response = await fetch('http://localhost:3000/api/auth/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: 'weak',
         }),
       })

       expect(response.status).toBe(400)
       const data = await response.json()
       expect(data.error_code).toBe('VALIDATION_ERROR')
     })

     it('rejects invalid email', async () => {
       const response = await fetch('http://localhost:3000/api/auth/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: 'notanemail',
           password: 'ValidPassword123!',
         }),
       })

       expect(response.status).toBe(400)
       const data = await response.json()
       expect(data.error_code).toBe('VALIDATION_ERROR')
     })
   })
   ```

4. **Create integration test `__tests__/api/auth/login.test.ts`:**
   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest'
   import { prisma } from '@/lib/db'
   import { hashPassword } from '@/lib/auth/password'

   describe('POST /api/auth/login', () => {
     const testEmail = `test-login-${Date.now()}@example.com`
     const testPassword = 'TestPassword123!'

     beforeAll(async () => {
       // Create test user
       await prisma.user.create({
         data: {
           email: testEmail,
           passwordHash: await hashPassword(testPassword),
         },
       })
     })

     afterAll(async () => {
       await prisma.user.deleteMany({
         where: { email: testEmail },
       })
     })

     it('logs in with valid credentials', async () => {
       const response = await fetch('http://localhost:3000/api/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: testPassword,
         }),
       })

       expect(response.status).toBe(200)

       const data = await response.json()
       expect(data.user.email).toBe(testEmail)

       // Check for session cookie
       const cookies = response.headers.get('set-cookie')
       expect(cookies).toContain('session=')
     })

     it('rejects invalid password', async () => {
       const response = await fetch('http://localhost:3000/api/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: 'WrongPassword123!',
         }),
       })

       expect(response.status).toBe(401)
       const data = await response.json()
       expect(data.error_code).toBe('INVALID_CREDENTIALS')
     })

     it('rejects non-existent user', async () => {
       const response = await fetch('http://localhost:3000/api/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: 'nonexistent@example.com',
           password: 'SomePassword123!',
         }),
       })

       expect(response.status).toBe(401)
       const data = await response.json()
       // Same error to prevent email enumeration
       expect(data.error_code).toBe('INVALID_CREDENTIALS')
     })
   })
   ```

**SUCCESS CRITERIA:**
- Registration creates user and sets session cookie
- Login validates credentials and sets session cookie
- Duplicate emails are rejected with 409
- Weak passwords are rejected with 400
- Invalid credentials return 401 without revealing which field is wrong
- All integration tests pass against real database

**DO NOT:**
- Implement logout yet (next prompt)
- Create UI components
- Add rate limiting yet
```

---

## Prompt 6: Auth API Routes - Logout and Password Reset

```text
Continue building the auth system with logout and password reset functionality.

**TASK: Implement logout and password reset endpoints.**

1. **Create `app/api/auth/logout/route.ts`:**
   ```typescript
   import { destroySession } from '@/lib/auth/session'
   import { successResponse, handleApiError } from '@/lib/api/response'

   export async function POST() {
     try {
       await destroySession()
       return successResponse({ success: true })
     } catch (error) {
       return handleApiError(error)
     }
   }
   ```

2. **Create `lib/email/resend.ts`:**
   ```typescript
   import { Resend } from 'resend'

   const getResend = () => {
     const apiKey = process.env.RESEND_API_KEY
     if (!apiKey) {
       throw new Error('RESEND_API_KEY is not set')
     }
     return new Resend(apiKey)
   }

   export async function sendPasswordResetEmail(
     email: string,
     resetUrl: string
   ): Promise<boolean> {
     try {
       const resend = getResend()
       
       await resend.emails.send({
         from: 'Tome Tracker <noreply@yourdomain.com>',
         to: email,
         subject: 'Reset your password',
         html: `
           <!DOCTYPE html>
           <html>
             <body style="font-family: sans-serif; padding: 20px;">
               <h1 style="color: #333;">Password Reset Request</h1>
               <p>You requested to reset your password. Click the link below:</p>
               <p>
                 <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                   Reset Password
                 </a>
               </p>
               <p style="color: #666; font-size: 14px;">
                 This link expires in 1 hour.
               </p>
               <p style="color: #666; font-size: 14px;">
                 If you didn't request this, you can safely ignore this email.
               </p>
             </body>
           </html>
         `,
       })
       return true
     } catch (error) {
       console.error('Failed to send email:', error)
       return false
     }
   }
   ```

3. **Create `app/api/auth/password-reset/request/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { randomBytes } from 'crypto'
   import { prisma } from '@/lib/db'
   import { emailSchema } from '@/lib/auth/validation'
   import { sendPasswordResetEmail } from '@/lib/email/resend'
   import { successResponse, handleApiError } from '@/lib/api/response'

   export async function POST(request: NextRequest) {
     try {
       const body = await request.json()
       const email = emailSchema.parse(body.email)

       const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

       // Find user (but don't reveal if they exist)
       const user = await prisma.user.findUnique({
         where: { email },
       })

       if (user) {
         // Delete any existing tokens for this user
         await prisma.passwordResetToken.deleteMany({
           where: { userId: user.id },
         })

         // Create new token
         const token = randomBytes(32).toString('hex')
         const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

         await prisma.passwordResetToken.create({
           data: {
             userId: user.id,
             token,
             expiresAt,
           },
         })

         // Send email
         const resetUrl = `${appUrl}/reset-password?token=${token}`
         await sendPasswordResetEmail(email, resetUrl)
       }

       // Always return success to prevent email enumeration
       return successResponse({
         message: 'If an account exists, a reset email has been sent',
       })
     } catch (error) {
       return handleApiError(error)
     }
   }
   ```

4. **Create `app/api/auth/password-reset/confirm/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { z } from 'zod'
   import { prisma } from '@/lib/db'
   import { hashPassword } from '@/lib/auth/password'
   import { passwordSchema } from '@/lib/auth/validation'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

   const confirmSchema = z.object({
     token: z.string().min(1, 'Token is required'),
     password: passwordSchema,
   })

   export async function POST(request: NextRequest) {
     try {
       const body = await request.json()
       const { token, password } = confirmSchema.parse(body)

       // Find valid token
       const resetToken = await prisma.passwordResetToken.findUnique({
         where: { token },
       })

       if (!resetToken) {
         return errorResponse(
           'INVALID_TOKEN',
           'This reset link is invalid or has expired',
           400
         )
       }

       if (resetToken.expiresAt < new Date()) {
         // Clean up expired token
         await prisma.passwordResetToken.delete({
           where: { id: resetToken.id },
         })
         return errorResponse(
           'INVALID_TOKEN',
           'This reset link is invalid or has expired',
           400
         )
       }

       // Update password
       await prisma.user.update({
         where: { id: resetToken.userId },
         data: { passwordHash: await hashPassword(password) },
       })

       // Delete token
       await prisma.passwordResetToken.delete({
         where: { id: resetToken.id },
       })

       return successResponse({
         message: 'Password has been reset successfully',
       })
     } catch (error) {
       return handleApiError(error)
     }
   }
   ```

5. **Create integration test `__tests__/api/auth/password-reset.test.ts`:**
   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest'
   import { prisma } from '@/lib/db'
   import { hashPassword, verifyPassword } from '@/lib/auth/password'

   describe('Password Reset Flow', () => {
     const testEmail = `reset-test-${Date.now()}@example.com`
     let testUserId: string

     beforeAll(async () => {
       const user = await prisma.user.create({
         data: {
           email: testEmail,
           passwordHash: await hashPassword('OldPassword123!'),
         },
       })
       testUserId = user.id
     })

     afterAll(async () => {
       await prisma.passwordResetToken.deleteMany({
         where: { userId: testUserId },
       })
       await prisma.user.delete({
         where: { id: testUserId },
       }).catch(() => {}) // Ignore if already deleted
     })

     it('creates reset token for valid email', async () => {
       const response = await fetch(
         'http://localhost:3000/api/auth/password-reset/request',
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: testEmail }),
         }
       )

       expect(response.status).toBe(200)

       // Verify token was created
       const token = await prisma.passwordResetToken.findFirst({
         where: { userId: testUserId },
       })
       expect(token).not.toBeNull()
       expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now())
     })

     it('returns success even for non-existent email (no enumeration)', async () => {
       const response = await fetch(
         'http://localhost:3000/api/auth/password-reset/request',
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email: 'nonexistent@example.com' }),
         }
       )

       expect(response.status).toBe(200)
     })

     it('resets password with valid token', async () => {
       // Get the token
       const tokenRecord = await prisma.passwordResetToken.findFirst({
         where: { userId: testUserId },
       })

       expect(tokenRecord).not.toBeNull()

       const newPassword = 'NewPassword456!'

       const response = await fetch(
         'http://localhost:3000/api/auth/password-reset/confirm',
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             token: tokenRecord!.token,
             password: newPassword,
           }),
         }
       )

       expect(response.status).toBe(200)

       // Verify password was changed
       const user = await prisma.user.findUnique({
         where: { id: testUserId },
       })
       const isValid = await verifyPassword(newPassword, user!.passwordHash)
       expect(isValid).toBe(true)

       // Verify token was deleted
       const deletedToken = await prisma.passwordResetToken.findFirst({
         where: { userId: testUserId },
       })
       expect(deletedToken).toBeNull()
     })

     it('rejects invalid token', async () => {
       const response = await fetch(
         'http://localhost:3000/api/auth/password-reset/confirm',
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             token: 'invalid-token-that-does-not-exist',
             password: 'NewPassword123!',
           }),
         }
       )

       expect(response.status).toBe(400)
       const data = await response.json()
       expect(data.error_code).toBe('INVALID_TOKEN')
     })
   })
   ```

**SUCCESS CRITERIA:**
- Logout clears session cookie
- Password reset request doesn't reveal if email exists
- Reset tokens expire after 1 hour
- Password reset with valid token works
- Old tokens are cleaned up when new ones are created
- All tests pass

**DO NOT:**
- Send actual emails in tests (mock or use test mode)
- Create account deletion yet (next prompt)
- Create UI components
```

---

## Prompt 7: Account Deletion and Auth Middleware

```text
Complete the authentication system with account deletion and reusable middleware.

**TASK: Implement account deletion endpoint and create auth middleware for protected routes.**

1. **Create `lib/api/withAuth.ts`:**
   ```typescript
   import { NextRequest, NextResponse } from 'next/server'
   import { getSession, SessionPayload } from '@/lib/auth/session'
   import { errorResponse } from './response'

   type AuthenticatedHandler = (
     request: NextRequest,
     session: SessionPayload
   ) => Promise<NextResponse>

   export function withAuth(handler: AuthenticatedHandler) {
     return async (request: NextRequest) => {
       const session = await getSession()

       if (!session) {
         return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
       }

       return handler(request, session)
     }
   }

   export function withAdmin(handler: AuthenticatedHandler) {
     return async (request: NextRequest) => {
       const session = await getSession()

       if (!session) {
         return errorResponse('UNAUTHORIZED', 'Authentication required', 401)
       }

       if (session.role !== 'ADMIN') {
         return errorResponse('FORBIDDEN', 'Admin access required', 403)
       }

       return handler(request, session)
     }
   }
   ```

2. **Create `app/api/account/route.ts`:**
   ```typescript
   import { prisma } from '@/lib/db'
   import { requireAuth, destroySession } from '@/lib/auth/session'
   import { successResponse, handleApiError } from '@/lib/api/response'

   // GET /api/account - Get current user info
   export async function GET() {
     try {
       const session = await requireAuth()

       const user = await prisma.user.findUnique({
         where: { id: session.userId },
         select: {
           id: true,
           email: true,
           role: true,
           createdAt: true,
           _count: {
             select: { books: true },
           },
         },
       })

       if (!user) {
         throw new Error('Unauthorized')
       }

       return successResponse({
         user: {
           id: user.id,
           email: user.email,
           role: user.role,
           createdAt: user.createdAt.toISOString(),
           bookCount: user._count.books,
         },
       })
     } catch (error) {
       return handleApiError(error)
     }
   }

   // DELETE /api/account - Delete account and all data
   export async function DELETE() {
     try {
       const session = await requireAuth()

       // Hard delete all user data (cascades to books, authors via schema)
       await prisma.user.delete({
         where: { id: session.userId },
       })

       // Clear session
       await destroySession()

       return successResponse({
         message: 'Account deleted successfully',
       })
     } catch (error) {
       return handleApiError(error)
     }
   }
   ```

3. **Create `middleware.ts` (root of project):**
   ```typescript
   import { NextRequest, NextResponse } from 'next/server'
   import { verifyToken } from '@/lib/auth/jwt'

   // Routes that require authentication
   const protectedRoutes = ['/library', '/settings', '/scan', '/admin']

   // Routes that should redirect to library if already authenticated
   const authRoutes = ['/login', '/register']

   export async function middleware(request: NextRequest) {
     const path = request.nextUrl.pathname
     const token = request.cookies.get('session')?.value

     let session = null
     if (token) {
       session = await verifyToken(token)
     }

     // Redirect authenticated users away from auth pages
     if (session && authRoutes.some((route) => path.startsWith(route))) {
       return NextResponse.redirect(new URL('/library', request.url))
     }

     // Redirect unauthenticated users to login
     if (!session && protectedRoutes.some((route) => path.startsWith(route))) {
       const loginUrl = new URL('/login', request.url)
       loginUrl.searchParams.set('redirect', path)
       return NextResponse.redirect(loginUrl)
     }

     // Check admin access
     if (path.startsWith('/admin') && session?.role !== 'ADMIN') {
       return NextResponse.redirect(new URL('/library', request.url))
     }

     return NextResponse.next()
   }

   export const config = {
     matcher: [
       /*
        * Match all request paths except:
        * - api routes (they handle their own auth)
        * - _next/static (static files)
        * - _next/image (image optimization files)
        * - favicon.ico (favicon file)
        * - public files (public folder)
        */
       '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
     ],
   }
   ```

4. **Create integration test `__tests__/api/account.test.ts`:**
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest'
   import { prisma } from '@/lib/db'
   import { hashPassword } from '@/lib/auth/password'

   describe('Account API', () => {
     const testEmail = `account-test-${Date.now()}@example.com`
     let sessionCookie: string
     let userId: string

     beforeEach(async () => {
       // Create user
       const user = await prisma.user.create({
         data: {
           email: testEmail,
           passwordHash: await hashPassword('TestPassword123!'),
         },
       })
       userId = user.id

       // Login to get session cookie
       const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: 'TestPassword123!',
         }),
       })

       const cookies = loginResponse.headers.get('set-cookie')
       sessionCookie = cookies!.split(';')[0]
     })

     afterEach(async () => {
       // Clean up if user still exists
       await prisma.user
         .delete({ where: { id: userId } })
         .catch(() => {}) // Ignore if already deleted
     })

     it('returns current user info', async () => {
       const response = await fetch('http://localhost:3000/api/account', {
         headers: { Cookie: sessionCookie },
       })

       expect(response.status).toBe(200)
       const data = await response.json()
       expect(data.user.email).toBe(testEmail)
       expect(data.user.role).toBe('USER')
       expect(data.user.bookCount).toBe(0)
     })

     it('rejects unauthenticated requests', async () => {
       const response = await fetch('http://localhost:3000/api/account')
       expect(response.status).toBe(401)
     })

     it('deletes account and all data', async () => {
       // First, create some data for this user
       const author = await prisma.author.create({
         data: {
           userId,
           name: 'Test Author',
         },
       })

       await prisma.book.create({
         data: {
           userId,
           authorId: author.id,
           title: 'Test Book',
           source: 'MANUAL',
         },
       })

       // Delete account
       const response = await fetch('http://localhost:3000/api/account', {
         method: 'DELETE',
         headers: { Cookie: sessionCookie },
       })

       expect(response.status).toBe(200)

       // Verify user is deleted
       const deletedUser = await prisma.user.findUnique({
         where: { id: userId },
       })
       expect(deletedUser).toBeNull()

       // Verify cascade delete worked (books should be deleted)
       const orphanedBooks = await prisma.book.findMany({
         where: { userId },
       })
       expect(orphanedBooks).toHaveLength(0)

       // Verify authors are deleted too
       const orphanedAuthors = await prisma.author.findMany({
         where: { userId },
       })
       expect(orphanedAuthors).toHaveLength(0)
     })
   })
   ```

**SUCCESS CRITERIA:**
- Account deletion removes user and all associated data
- Cascade delete works (books, authors deleted with user)
- Session is cleared after account deletion
- withAuth middleware rejects unauthenticated requests
- withAdmin middleware rejects non-admin users
- Route middleware redirects appropriately
- All tests pass

**DO NOT:**
- Create UI components
- Start on library API routes yet
```

---

## End of Phase 1 & 2

Phases 1 (Foundation) and 2 (Authentication) are complete. You now have:

- ✅ Next.js project with TypeScript and Tailwind
- ✅ Prisma schema with User, Author, Book models
- ✅ Database migrations and seed data
- ✅ Password hashing and validation
- ✅ JWT-based session management
- ✅ Register, Login, Logout endpoints
- ✅ Password reset flow with email
- ✅ Account deletion with cascade
- ✅ Auth middleware for protected routes
- ✅ Comprehensive test coverage

Continue with **Phase 3: Core Library API** (Prompts 8-11).

