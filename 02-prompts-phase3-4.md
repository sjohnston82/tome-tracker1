# Tome Tracker PWA - Implementation Prompts
# Phase 3: Core Library API & Phase 4: Metadata Lookup (Prompts 8-14)

---

## Prompt 8: Book CRUD - Create and Read

```text
With authentication complete, start building the core library API.

**TASK: Implement POST /api/books and GET /api/books/:id endpoints.**

1. **Create `lib/books/validation.ts`:**
   ```typescript
   import { z } from 'zod'
   
   export const createBookSchema = z.object({
     title: z.string().min(1, 'Title is required').max(500),
     authorName: z.string().min(1, 'Author is required').max(200),
     isbn13: z.string().length(13).regex(/^\d+$/).optional().nullable(),
     isbn10: z.string().length(10).optional().nullable(),
     publisher: z.string().max(200).optional().nullable(),
     publicationYear: z.number().int().min(1000).max(2100).optional().nullable(),
     coverUrl: z.string().url().optional().nullable(),
     seriesName: z.string().max(200).optional().nullable(),
     seriesNumber: z.number().positive().optional().nullable(),
     tags: z.array(z.string().max(50)).max(20).default([]),
     genres: z.array(z.string().max(50)).max(20).default([]),
     source: z.enum(['SCAN', 'MANUAL', 'IMPORT']),
   })
   
   export type CreateBookInput = z.infer<typeof createBookSchema>
   ```

2. **Create `lib/books/isbn.ts`:**
   ```typescript
   export function normalizeToIsbn13(isbn: string): string | null {
     const cleaned = isbn.replace(/[-\s]/g, '')
     
     if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
       return cleaned
     }
     
     if (cleaned.length === 10 && /^\d{9}[\dX]$/i.test(cleaned)) {
       return isbn10ToIsbn13(cleaned)
     }
     
     return null
   }
   
   export function isbn10ToIsbn13(isbn10: string): string {
     const base = '978' + isbn10.slice(0, 9)
     const checkDigit = calculateIsbn13CheckDigit(base)
     return base + checkDigit
   }
   
   export function calculateIsbn13CheckDigit(first12: string): string {
     let sum = 0
     for (let i = 0; i < 12; i++) {
       const digit = parseInt(first12[i])
       sum += i % 2 === 0 ? digit : digit * 3
     }
     const check = (10 - (sum % 10)) % 10
     return check.toString()
   }
   
   export function isValidIsbn13(isbn: string): boolean {
     if (!/^\d{13}$/.test(isbn)) return false
     
     let sum = 0
     for (let i = 0; i < 13; i++) {
       const digit = parseInt(isbn[i])
       sum += i % 2 === 0 ? digit : digit * 3
     }
     return sum % 10 === 0
   }
   
   export function extractIsbnFromBarcode(barcode: string): string | null {
     const normalized = normalizeToIsbn13(barcode)
     if (normalized && isValidIsbn13(normalized)) {
       return normalized
     }
     
     const patterns = [/978\d{10}/, /979\d{10}/, /\d{9}[\dX]/i]
     
     for (const pattern of patterns) {
       const match = barcode.match(pattern)
       if (match) {
         const result = normalizeToIsbn13(match[0])
         if (result && isValidIsbn13(result)) {
           return result
         }
       }
     }
     
     return null
   }
   ```

3. **Create `lib/books/service.ts`:**
   ```typescript
   import { prisma } from '@/lib/db'
   import { CreateBookInput } from './validation'
   import { normalizeToIsbn13 } from './isbn'
   
   export async function createBook(userId: string, input: CreateBookInput) {
     const isbn13 = input.isbn13 ? normalizeToIsbn13(input.isbn13) : null
     
     if (isbn13) {
       const existing = await prisma.book.findUnique({
         where: { userId_isbn13: { userId, isbn13 } },
       })
       
       if (existing) {
         return { success: false, error: 'DUPLICATE_ISBN', existingBook: existing }
       }
     }
     
     const author = await prisma.author.upsert({
       where: { userId_name: { userId, name: input.authorName } },
       update: {},
       create: { userId, name: input.authorName },
     })
     
     const book = await prisma.book.create({
       data: {
         userId,
         authorId: author.id,
         title: input.title,
         isbn13,
         isbn10: input.isbn10,
         publisher: input.publisher,
         publicationYear: input.publicationYear,
         coverUrl: input.coverUrl,
         seriesName: input.seriesName,
         seriesNumber: input.seriesNumber,
         tags: input.tags,
         genres: input.genres,
         source: input.source,
       },
       include: { author: true },
     })
     
     return { success: true, book }
   }
   
   export async function getBookById(userId: string, bookId: string) {
     return prisma.book.findFirst({
       where: { id: bookId, userId },
       include: { author: true },
     })
   }
   
   export async function checkOwnership(userId: string, isbn13: string) {
     const book = await prisma.book.findUnique({
       where: { userId_isbn13: { userId, isbn13 } },
     })
     return book !== null
   }
   ```

4. **Create `app/api/books/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { createBookSchema } from '@/lib/books/validation'
   import { createBook } from '@/lib/books/service'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
   
   export const POST = withAuth(async (request: NextRequest, session) => {
     try {
       const body = await request.json()
       const input = createBookSchema.parse(body)
       
       const result = await createBook(session.userId, input)
       
       if (!result.success) {
         if (result.error === 'DUPLICATE_ISBN') {
           return errorResponse(
             'DUPLICATE_ISBN',
             'You already own this book',
             409,
             { existingBookId: result.existingBook?.id }
           )
         }
       }
       
       return successResponse({ book: result.book }, 201)
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

5. **Create `app/api/books/[id]/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { getBookById } from '@/lib/books/service'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
   
   export const GET = withAuth(async (request: NextRequest, session) => {
     try {
       const id = request.nextUrl.pathname.split('/').pop()!
       const book = await getBookById(session.userId, id)
       
       if (!book) {
         return errorResponse('NOT_FOUND', 'Book not found', 404)
       }
       
       return successResponse({ book })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

6. **Create tests `__tests__/lib/isbn.test.ts`:**
   ```typescript
   import { describe, it, expect } from 'vitest'
   import {
     normalizeToIsbn13,
     isbn10ToIsbn13,
     isValidIsbn13,
     extractIsbnFromBarcode,
   } from '@/lib/books/isbn'
   
   describe('ISBN utilities', () => {
     describe('normalizeToIsbn13', () => {
       it('returns valid ISBN-13 as-is', () => {
         expect(normalizeToIsbn13('9780765311788')).toBe('9780765311788')
       })
       
       it('converts ISBN-10 to ISBN-13', () => {
         expect(normalizeToIsbn13('0765311785')).toBe('9780765311788')
       })
       
       it('handles ISBN with dashes', () => {
         expect(normalizeToIsbn13('978-0-7653-1178-8')).toBe('9780765311788')
       })
       
       it('returns null for invalid ISBN', () => {
         expect(normalizeToIsbn13('invalid')).toBeNull()
       })
     })
     
     describe('isValidIsbn13', () => {
       it('validates correct ISBN-13', () => {
         expect(isValidIsbn13('9780765311788')).toBe(true)
       })
       
       it('rejects invalid check digit', () => {
         expect(isValidIsbn13('9780765311789')).toBe(false)
       })
     })
   })
   ```

**SUCCESS CRITERIA:**
- Books can be created with valid data
- Duplicate ISBNs are rejected with 409
- Authors are created/reused automatically
- ISBN normalization works for both ISBN-10 and ISBN-13
- All tests pass

**DO NOT:**
- Implement UPDATE or DELETE yet (next prompt)
- Create metadata lookup integration
- Build UI components
```

---

## Prompt 9: Book CRUD - Update and Delete

```text
Continue the library API with book update and delete functionality.

**TASK: Implement PATCH /api/books/:id and DELETE /api/books/:id endpoints.**

1. **Update `lib/books/validation.ts`:**
   ```typescript
   // Add to existing file
   
   export const updateBookSchema = z.object({
     title: z.string().min(1).max(500).optional(),
     authorName: z.string().min(1).max(200).optional(),
     isbn13: z.string().length(13).regex(/^\d+$/).optional().nullable(),
     isbn10: z.string().length(10).optional().nullable(),
     publisher: z.string().max(200).optional().nullable(),
     publicationYear: z.number().int().min(1000).max(2100).optional().nullable(),
     coverUrl: z.string().url().optional().nullable(),
     seriesName: z.string().max(200).optional().nullable(),
     seriesNumber: z.number().positive().optional().nullable(),
     tags: z.array(z.string().max(50)).max(20).optional(),
     genres: z.array(z.string().max(50)).max(20).optional(),
   })
   
   export type UpdateBookInput = z.infer<typeof updateBookSchema>
   ```

2. **Update `lib/books/service.ts`:**
   ```typescript
   // Add to existing file
   
   export async function updateBook(
     userId: string,
     bookId: string,
     input: UpdateBookInput
   ) {
     const existing = await prisma.book.findFirst({
       where: { id: bookId, userId },
     })
     
     if (!existing) {
       return { success: false, error: 'NOT_FOUND' }
     }
     
     if (input.isbn13 && input.isbn13 !== existing.isbn13) {
       const duplicate = await prisma.book.findUnique({
         where: { userId_isbn13: { userId, isbn13: input.isbn13 } },
       })
       
       if (duplicate && duplicate.id !== bookId) {
         return { success: false, error: 'DUPLICATE_ISBN' }
       }
     }
     
     let authorId = existing.authorId
     if (input.authorName) {
       const author = await prisma.author.upsert({
         where: { userId_name: { userId, name: input.authorName } },
         update: {},
         create: { userId, name: input.authorName },
       })
       authorId = author.id
     }
     
     const { authorName, ...bookData } = input
     
     const book = await prisma.book.update({
       where: { id: bookId },
       data: { ...bookData, authorId, updatedAt: new Date() },
       include: { author: true },
     })
     
     return { success: true, book }
   }
   
   export async function deleteBook(userId: string, bookId: string) {
     const existing = await prisma.book.findFirst({
       where: { id: bookId, userId },
     })
     
     if (!existing) {
       return { success: false, error: 'NOT_FOUND' }
     }
     
     await prisma.book.delete({ where: { id: bookId } })
     await cleanupOrphanedAuthors(userId)
     
     return { success: true }
   }
   
   async function cleanupOrphanedAuthors(userId: string) {
     await prisma.author.deleteMany({
       where: { userId, books: { none: {} } },
     })
   }
   ```

3. **Update `app/api/books/[id]/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { getBookById, updateBook, deleteBook } from '@/lib/books/service'
   import { updateBookSchema } from '@/lib/books/validation'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
   
   export const GET = withAuth(async (request: NextRequest, session) => {
     try {
       const id = request.nextUrl.pathname.split('/').pop()!
       const book = await getBookById(session.userId, id)
       
       if (!book) {
         return errorResponse('NOT_FOUND', 'Book not found', 404)
       }
       
       return successResponse({ book })
     } catch (error) {
       return handleApiError(error)
     }
   })
   
   export const PATCH = withAuth(async (request: NextRequest, session) => {
     try {
       const id = request.nextUrl.pathname.split('/').pop()!
       const body = await request.json()
       const input = updateBookSchema.parse(body)
       
       const result = await updateBook(session.userId, id, input)
       
       if (!result.success) {
         if (result.error === 'NOT_FOUND') {
           return errorResponse('NOT_FOUND', 'Book not found', 404)
         }
         if (result.error === 'DUPLICATE_ISBN') {
           return errorResponse('DUPLICATE_ISBN', 'ISBN already exists', 409)
         }
       }
       
       return successResponse({ book: result.book })
     } catch (error) {
       return handleApiError(error)
     }
   })
   
   export const DELETE = withAuth(async (request: NextRequest, session) => {
     try {
       const id = request.nextUrl.pathname.split('/').pop()!
       const result = await deleteBook(session.userId, id)
       
       if (!result.success) {
         return errorResponse('NOT_FOUND', 'Book not found', 404)
       }
       
       return successResponse({ success: true })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

**SUCCESS CRITERIA:**
- Books can be updated with partial data
- Author changes create new author if needed
- Deleting books works and cleans up orphaned authors
- All tests pass
- Cannot update/delete other users' books

**DO NOT:**
- Create sync endpoint yet (next prompt)
- Build UI components
```

---

## Prompt 10: Library Sync Endpoint

```text
Create the sync endpoint that provides a complete library snapshot for offline caching.

**TASK: Implement GET /api/library/sync endpoint.**

1. **Create `lib/library/sync.ts`:**
   ```typescript
   import { prisma } from '@/lib/db'
   
   export interface LibrarySnapshot {
     syncedAt: string
     authors: AuthorWithBooks[]
   }
   
   export interface AuthorWithBooks {
     id: string
     name: string
     bio: string | null
     photoUrl: string | null
     books: BookSummary[]
   }
   
   export interface BookSummary {
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
     source: string
     createdAt: string
     updatedAt: string
   }
   
   export async function getLibrarySnapshot(userId: string): Promise<LibrarySnapshot> {
     const authors = await prisma.author.findMany({
       where: {
         userId,
         books: { some: {} },
       },
       include: {
         books: {
           orderBy: [
             { seriesName: 'asc' },
             { seriesNumber: 'asc' },
             { title: 'asc' },
           ],
         },
       },
       orderBy: { name: 'asc' },
     })
     
     return {
       syncedAt: new Date().toISOString(),
       authors: authors.map(author => ({
         id: author.id,
         name: author.name,
         bio: author.bio,
         photoUrl: author.photoUrl,
         books: author.books.map(book => ({
           id: book.id,
           title: book.title,
           isbn13: book.isbn13,
           isbn10: book.isbn10,
           publisher: book.publisher,
           publicationYear: book.publicationYear,
           coverUrl: book.coverUrl,
           seriesName: book.seriesName,
           seriesNumber: book.seriesNumber,
           tags: book.tags,
           genres: book.genres,
           source: book.source,
           createdAt: book.createdAt.toISOString(),
           updatedAt: book.updatedAt.toISOString(),
         })),
       })),
     }
   }
   
   export async function getLibraryStats(userId: string) {
     const [bookCount, authorCount] = await Promise.all([
       prisma.book.count({ where: { userId } }),
       prisma.author.count({ where: { userId, books: { some: {} } } }),
     ])
     
     return { bookCount, authorCount }
   }
   ```

2. **Create `app/api/library/sync/route.ts`:**
   ```typescript
   import { withAuth } from '@/lib/api/withAuth'
   import { getLibrarySnapshot, getLibraryStats } from '@/lib/library/sync'
   import { successResponse, handleApiError } from '@/lib/api/response'
   
   export const GET = withAuth(async (request, session) => {
     try {
       const [snapshot, stats] = await Promise.all([
         getLibrarySnapshot(session.userId),
         getLibraryStats(session.userId),
       ])
       
       return successResponse({ ...snapshot, stats })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

3. **Create `app/api/library/check/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { normalizeToIsbn13 } from '@/lib/books/isbn'
   import { prisma } from '@/lib/db'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
   
   export const GET = withAuth(async (request: NextRequest, session) => {
     try {
       const isbn = request.nextUrl.searchParams.get('isbn')
       
       if (!isbn) {
         return errorResponse('MISSING_ISBN', 'ISBN parameter is required', 400)
       }
       
       const normalized = normalizeToIsbn13(isbn)
       
       if (!normalized) {
         return successResponse({ owned: false, validIsbn: false })
       }
       
       const book = await prisma.book.findUnique({
         where: { userId_isbn13: { userId: session.userId, isbn13: normalized } },
         select: { id: true },
       })
       
       return successResponse({
         owned: book !== null,
         bookId: book?.id || null,
         validIsbn: true,
         normalizedIsbn: normalized,
       })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

**SUCCESS CRITERIA:**
- Sync returns all authors and books organized by author
- Books are sorted by series/title within each author
- Stats are included in response
- Quick ownership check works with ISBN normalization
- All tests pass

**DO NOT:**
- Implement delta sync (full snapshot only for v1)
- Create UI components
```

---

## Prompt 11: Author Management API

```text
Add author-specific endpoints for the author-centric view.

**TASK: Implement author listing and detail endpoints.**

1. **Create `lib/authors/service.ts`:**
   ```typescript
   import { prisma } from '@/lib/db'
   
   export async function getAuthorsWithBookCounts(userId: string) {
     const authors = await prisma.author.findMany({
       where: { userId, books: { some: {} } },
       include: { _count: { select: { books: true } } },
       orderBy: { name: 'asc' },
     })
     
     return authors.map(author => ({
       id: author.id,
       name: author.name,
       photoUrl: author.photoUrl,
       bookCount: author._count.books,
     }))
   }
   
   export async function getAuthorWithBooks(userId: string, authorId: string) {
     return prisma.author.findFirst({
       where: { id: authorId, userId },
       include: {
         books: {
           orderBy: [
             { seriesName: 'asc' },
             { seriesNumber: 'asc' },
             { title: 'asc' },
           ],
         },
       },
     })
   }
   
   export async function updateAuthor(
     userId: string,
     authorId: string,
     data: { bio?: string | null; photoUrl?: string | null }
   ) {
     const existing = await prisma.author.findFirst({
       where: { id: authorId, userId },
     })
     
     if (!existing) return null
     
     return prisma.author.update({
       where: { id: authorId },
       data,
     })
   }
   ```

2. **Create `app/api/authors/route.ts`:**
   ```typescript
   import { withAuth } from '@/lib/api/withAuth'
   import { getAuthorsWithBookCounts } from '@/lib/authors/service'
   import { successResponse, handleApiError } from '@/lib/api/response'
   
   export const GET = withAuth(async (request, session) => {
     try {
       const authors = await getAuthorsWithBookCounts(session.userId)
       return successResponse({ authors })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

3. **Create `app/api/authors/[id]/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { z } from 'zod'
   import { withAuth } from '@/lib/api/withAuth'
   import { getAuthorWithBooks, updateAuthor } from '@/lib/authors/service'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
   
   const updateAuthorSchema = z.object({
     bio: z.string().max(2000).optional().nullable(),
     photoUrl: z.string().url().optional().nullable(),
   })
   
   export const GET = withAuth(async (request: NextRequest, session) => {
     try {
       const id = request.nextUrl.pathname.split('/').pop()!
       const author = await getAuthorWithBooks(session.userId, id)
       
       if (!author) {
         return errorResponse('NOT_FOUND', 'Author not found', 404)
       }
       
       return successResponse({ author })
     } catch (error) {
       return handleApiError(error)
     }
   })
   
   export const PATCH = withAuth(async (request: NextRequest, session) => {
     try {
       const id = request.nextUrl.pathname.split('/').pop()!
       const body = await request.json()
       const data = updateAuthorSchema.parse(body)
       
       const author = await updateAuthor(session.userId, id, data)
       
       if (!author) {
         return errorResponse('NOT_FOUND', 'Author not found', 404)
       }
       
       return successResponse({ author })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

**SUCCESS CRITERIA:**
- Authors list includes book counts
- Author detail includes all books sorted properly
- Author bio/photo can be updated
- All tests pass

**DO NOT:**
- Create UI components yet
- Start metadata lookup
```

---

## Prompt 12: Open Library Integration

```text
Create the primary metadata lookup service using Open Library API.

**TASK: Implement Open Library API integration for ISBN lookup and search.**

1. **Create `lib/metadata/types.ts`:**
   ```typescript
   export interface BookMetadata {
     title: string
     authors: string[]
     isbn13?: string
     isbn10?: string
     publisher?: string
     publishedYear?: number
     coverUrl?: string
     description?: string
     subjects?: string[]
     seriesName?: string
     seriesNumber?: number
     pageCount?: number
   }
   
   export interface SearchResult {
     title: string
     authors: string[]
     isbn13?: string
     coverUrl?: string
     publishedYear?: number
   }
   
   export interface MetadataProvider {
     name: string
     lookupByIsbn(isbn: string): Promise<BookMetadata | null>
     search(query: string): Promise<SearchResult[]>
   }
   ```

2. **Create `lib/metadata/open-library.ts`:**
   ```typescript
   import { BookMetadata, SearchResult, MetadataProvider } from './types'
   
   const BASE_URL = 'https://openlibrary.org'
   const COVERS_URL = 'https://covers.openlibrary.org'
   
   export class OpenLibraryProvider implements MetadataProvider {
     name = 'openlibrary'
     
     async lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
       try {
         const response = await fetch(
           `${BASE_URL}/isbn/${isbn}.json`,
           { next: { revalidate: 86400 } }
         )
         
         if (!response.ok) return null
         
         const data = await response.json()
         const authorNames = await this.fetchAuthorNames(data.authors || [])
         
         return {
           title: data.title,
           authors: authorNames,
           isbn13: isbn.length === 13 ? isbn : undefined,
           isbn10: isbn.length === 10 ? isbn : undefined,
           publisher: data.publishers?.[0],
           publishedYear: this.parseYear(data.publish_date),
           coverUrl: data.covers?.[0]
             ? `${COVERS_URL}/b/id/${data.covers[0]}-L.jpg`
             : undefined,
           description: typeof data.description === 'string'
             ? data.description
             : data.description?.value,
           subjects: data.subjects?.slice(0, 10),
           pageCount: data.number_of_pages,
           seriesName: data.series?.[0],
         }
       } catch (error) {
         console.error('Open Library lookup error:', error)
         return null
       }
     }
     
     async search(query: string): Promise<SearchResult[]> {
       try {
         const params = new URLSearchParams({
           q: query,
           limit: '10',
           fields: 'title,author_name,isbn,cover_i,first_publish_year',
         })
         
         const response = await fetch(
           `${BASE_URL}/search.json?${params}`,
           { next: { revalidate: 3600 } }
         )
         
         if (!response.ok) return []
         
         const data = await response.json()
         
         return data.docs.map((doc: any) => ({
           title: doc.title,
           authors: doc.author_name || [],
           isbn13: doc.isbn?.find((i: string) => i.length === 13),
           coverUrl: doc.cover_i
             ? `${COVERS_URL}/b/id/${doc.cover_i}-M.jpg`
             : undefined,
           publishedYear: doc.first_publish_year,
         }))
       } catch (error) {
         console.error('Open Library search error:', error)
         return []
       }
     }
     
     private async fetchAuthorNames(authorRefs: Array<{ key: string }>): Promise<string[]> {
       const names = await Promise.all(
         authorRefs.slice(0, 5).map(async ref => {
           try {
             const response = await fetch(`${BASE_URL}${ref.key}.json`)
             if (!response.ok) return null
             const author = await response.json()
             return author.name as string
           } catch {
             return null
           }
         })
       )
       return names.filter((n): n is string => n !== null)
     }
     
     private parseYear(dateStr?: string): number | undefined {
       if (!dateStr) return undefined
       const match = dateStr.match(/\d{4}/)
       return match ? parseInt(match[0]) : undefined
     }
   }
   
   export const openLibrary = new OpenLibraryProvider()
   ```

3. **Create integration test with real API:**
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { openLibrary } from '@/lib/metadata/open-library'
   
   describe('OpenLibrary Provider', () => {
     it('finds book by ISBN-13', async () => {
       const result = await openLibrary.lookupByIsbn('9780765326355')
       
       expect(result).not.toBeNull()
       expect(result!.title).toContain('Way of Kings')
       expect(result!.authors.length).toBeGreaterThan(0)
     }, 15000)
     
     it('returns null for non-existent ISBN', async () => {
       const result = await openLibrary.lookupByIsbn('9999999999999')
       expect(result).toBeNull()
     }, 15000)
     
     it('searches for books', async () => {
       const results = await openLibrary.search('mistborn sanderson')
       
       expect(results.length).toBeGreaterThan(0)
       expect(results[0].title.toLowerCase()).toContain('mistborn')
     }, 15000)
   })
   ```

**SUCCESS CRITERIA:**
- ISBN lookup retrieves correct book data
- Author names are properly fetched
- Cover URLs are constructed correctly
- Search returns relevant results
- Tests pass with real API calls

**DO NOT:**
- Implement Google Books fallback yet (next prompt)
- Create API routes yet
```

---

## Prompt 13: Google Books Fallback

```text
Add Google Books as a fallback metadata provider.

**TASK: Implement Google Books API integration as fallback.**

1. **Create `lib/metadata/google-books.ts`:**
   ```typescript
   import { BookMetadata, SearchResult, MetadataProvider } from './types'
   
   const BASE_URL = 'https://www.googleapis.com/books/v1'
   
   export class GoogleBooksProvider implements MetadataProvider {
     name = 'googlebooks'
     
     async lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
       try {
         const response = await fetch(
           `${BASE_URL}/volumes?q=isbn:${isbn}`,
           { next: { revalidate: 86400 } }
         )
         
         if (!response.ok) return null
         
         const data = await response.json()
         
         if (!data.items || data.items.length === 0) return null
         
         const info = data.items[0].volumeInfo
         
         const isbn13 = info.industryIdentifiers?.find(
           (id: any) => id.type === 'ISBN_13'
         )?.identifier
         const isbn10 = info.industryIdentifiers?.find(
           (id: any) => id.type === 'ISBN_10'
         )?.identifier
         
         return {
           title: info.title,
           authors: info.authors || [],
           isbn13,
           isbn10,
           publisher: info.publisher,
           publishedYear: this.parseYear(info.publishedDate),
           coverUrl: this.upgradeCoverUrl(info.imageLinks?.thumbnail),
           description: info.description,
           subjects: info.categories?.slice(0, 10),
           pageCount: info.pageCount,
         }
       } catch (error) {
         console.error('Google Books lookup error:', error)
         return null
       }
     }
     
     async search(query: string): Promise<SearchResult[]> {
       try {
         const params = new URLSearchParams({ q: query, maxResults: '10' })
         
         const response = await fetch(
           `${BASE_URL}/volumes?${params}`,
           { next: { revalidate: 3600 } }
         )
         
         if (!response.ok) return []
         
         const data = await response.json()
         
         if (!data.items) return []
         
         return data.items.map((item: any) => {
           const info = item.volumeInfo
           const isbn13 = info.industryIdentifiers?.find(
             (id: any) => id.type === 'ISBN_13'
           )?.identifier
           
           return {
             title: info.title,
             authors: info.authors || [],
             isbn13,
             coverUrl: this.upgradeCoverUrl(info.imageLinks?.thumbnail),
             publishedYear: this.parseYear(info.publishedDate),
           }
         })
       } catch (error) {
         console.error('Google Books search error:', error)
         return []
       }
     }
     
     private parseYear(dateStr?: string): number | undefined {
       if (!dateStr) return undefined
       const match = dateStr.match(/\d{4}/)
       return match ? parseInt(match[0]) : undefined
     }
     
     private upgradeCoverUrl(url?: string): string | undefined {
       if (!url) return undefined
       return url.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
     }
   }
   
   export const googleBooks = new GoogleBooksProvider()
   ```

2. **Create `lib/metadata/index.ts` - Combined provider:**
   ```typescript
   import { BookMetadata, SearchResult } from './types'
   import { openLibrary } from './open-library'
   import { googleBooks } from './google-books'
   
   export async function lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
     // Try Open Library first
     let result = await openLibrary.lookupByIsbn(isbn)
     
     if (result) return result
     
     // Fallback to Google Books
     result = await googleBooks.lookupByIsbn(isbn)
     
     return result
   }
   
   export async function searchBooks(query: string): Promise<SearchResult[]> {
     // Try Open Library first
     let results = await openLibrary.search(query)
     
     if (results.length > 0) return results
     
     // Fallback to Google Books
     results = await googleBooks.search(query)
     
     return results
   }
   
   export { type BookMetadata, type SearchResult } from './types'
   ```

**SUCCESS CRITERIA:**
- Google Books lookup works correctly
- Fallback logic tries Open Library first, then Google Books
- Both providers return consistent data structure
- All tests pass with real API calls

**DO NOT:**
- Create API routes yet (next prompt)
```

---

## Prompt 14: Lookup API Routes

```text
Create the API routes that expose metadata lookup to the client.

**TASK: Implement /api/lookup/isbn/:code and /api/lookup/search endpoints.**

1. **Create `app/api/lookup/isbn/[code]/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { lookupByIsbn } from '@/lib/metadata'
   import { extractIsbnFromBarcode, normalizeToIsbn13, isValidIsbn13 } from '@/lib/books/isbn'
   import { checkOwnership } from '@/lib/books/service'
   import { successResponse, handleApiError } from '@/lib/api/response'
   import { checkRateLimit } from '@/lib/api/response'
   
   export const GET = withAuth(async (request: NextRequest, session) => {
     try {
       // Rate limit: 30 lookups per minute per user
       const rateLimit = checkRateLimit(`lookup:${session.userId}`, 30, 60 * 1000)
       
       if (!rateLimit.allowed) {
         return errorResponse('RATE_LIMITED', 'Too many lookup requests', 429)
       }
       
       const code = request.nextUrl.pathname.split('/').pop()!
       
       let isbn = extractIsbnFromBarcode(code)
       if (!isbn) isbn = normalizeToIsbn13(code)
       
       const response = {
         isIsbn: false,
         normalizedIsbn: null as string | null,
         owned: false,
         metadata: null as any,
       }
       
       if (!isbn || !isValidIsbn13(isbn)) {
         return successResponse(response)
       }
       
       response.isIsbn = true
       response.normalizedIsbn = isbn
       response.owned = await checkOwnership(session.userId, isbn)
       response.metadata = await lookupByIsbn(isbn)
       
       return successResponse(response)
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

2. **Create `app/api/lookup/search/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { searchBooks } from '@/lib/metadata'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
   import { checkRateLimit } from '@/lib/api/response'
   
   export const GET = withAuth(async (request: NextRequest, session) => {
     try {
       const rateLimit = checkRateLimit(`search:${session.userId}`, 20, 60 * 1000)
       
       if (!rateLimit.allowed) {
         return errorResponse('RATE_LIMITED', 'Too many search requests', 429)
       }
       
       const query = request.nextUrl.searchParams.get('q')
       
       if (!query || query.trim().length < 2) {
         return errorResponse('INVALID_QUERY', 'Search query must be at least 2 characters', 400)
       }
       
       const results = await searchBooks(query.trim())
       
       return successResponse({ results })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

3. **Create integration test:**
   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest'
   import { prisma } from '@/lib/db'
   import { hashPassword } from '@/lib/auth/password'
   
   describe('Lookup API', () => {
     const testEmail = `lookup-test-${Date.now()}@example.com`
     let sessionCookie: string
     let userId: string
     
     beforeAll(async () => {
       const user = await prisma.user.create({
         data: {
           email: testEmail,
           passwordHash: await hashPassword('TestPassword123!'),
         },
       })
       userId = user.id
       
       // Add a book to test ownership
       const author = await prisma.author.create({
         data: { userId, name: 'Brandon Sanderson' },
       })
       
       await prisma.book.create({
         data: {
           userId,
           authorId: author.id,
           title: 'The Way of Kings',
           isbn13: '9780765326355',
           source: 'MANUAL',
         },
       })
       
       const loginResponse = await fetch(
         'http://localhost:3000/api/auth/login',
         {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             email: testEmail,
             password: 'TestPassword123!',
           }),
         }
       )
       sessionCookie = loginResponse.headers.get('set-cookie')!.split(';')[0]
     })
     
     afterAll(async () => {
       await prisma.user.delete({ where: { id: userId } })
     })
     
     it('looks up owned book', async () => {
       const response = await fetch(
         'http://localhost:3000/api/lookup/isbn/9780765326355',
         { headers: { Cookie: sessionCookie } }
       )
       
       expect(response.status).toBe(200)
       const data = await response.json()
       
       expect(data.isIsbn).toBe(true)
       expect(data.owned).toBe(true)
       expect(data.metadata).not.toBeNull()
     }, 15000)
     
     it('looks up unowned book', async () => {
       const response = await fetch(
         'http://localhost:3000/api/lookup/isbn/9780765311788',
         { headers: { Cookie: sessionCookie } }
       )
       
       expect(response.status).toBe(200)
       const data = await response.json()
       
       expect(data.isIsbn).toBe(true)
       expect(data.owned).toBe(false)
     }, 15000)
     
     it('searches for books', async () => {
       const response = await fetch(
         'http://localhost:3000/api/lookup/search?q=mistborn',
         { headers: { Cookie: sessionCookie } }
       )
       
       expect(response.status).toBe(200)
       const data = await response.json()
       
       expect(data.results.length).toBeGreaterThan(0)
     }, 15000)
   })
   ```

**SUCCESS CRITERIA:**
- ISBN lookup returns metadata and ownership status
- Invalid barcodes are handled gracefully
- Search returns results from metadata providers
- Rate limiting prevents abuse
- All tests pass

**DO NOT:**
- Create UI components yet
- Start import implementation
```

---

## End of Phase 3 & 4

The Core Library API and Metadata Lookup are now complete. Continue with:

- **Phase 5**: Basic UI Shell (Prompts 15-18)
- **Phase 6**: Scanner & Manual Add (Prompts 19-22)
- **Phase 7**: Import System (Prompts 23-26)
- **Phase 8**: PWA & Offline (Prompts 27-30)
- **Phase 9**: Admin & Polish (Prompts 31-33)

