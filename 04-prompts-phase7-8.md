# Tome Tracker PWA - Implementation Prompts
# Phase 7: Import System & Phase 8: PWA/Offline (Prompts 23-30)

---

## Prompt 23: CSV Import Parser

```text
Create the core import parsing functionality for CSV files.

**TASK: Build CSV parsing with column detection and mapping.**

1. **Install dependencies:**
   ```bash
   npm install papaparse
   npm install -D @types/papaparse
   ```

2. **Create `lib/import/types.ts`:**
   ```typescript
   export interface ImportRow {
     title: string
     author: string
     isbn?: string
     seriesName?: string
     seriesNumber?: number
     publisher?: string
     publicationYear?: number
   }

   export interface ImportMapping {
     title: string | null
     author: string | null
     isbn: string | null
     seriesName: string | null
     seriesNumber: string | null
     publisher: string | null
     publicationYear: string | null
   }

   export interface ImportPreview {
     format: 'csv' | 'goodreads' | 'storygraph'
     totalRows: number
     columns: string[]
     suggestedMapping: ImportMapping
     sampleRows: Record<string, string>[]
   }

   export interface ImportResult {
     imported: number
     duplicates: number
     errors: Array<{ row: number; error: string }>
   }
   ```

3. **Create `lib/import/parser.ts`:**
   ```typescript
   import Papa from 'papaparse'
   import { ImportMapping, ImportPreview, ImportRow } from './types'

   // Known column names for auto-mapping
   const COLUMN_MAPPINGS = {
     title: ['title', 'book title', 'name', 'book name'],
     author: ['author', 'author name', 'authors', 'author(s)', 'writer'],
     isbn: ['isbn', 'isbn13', 'isbn-13', 'isbn10', 'isbn-10', 'asin'],
     seriesName: ['series', 'series name', 'series title'],
     seriesNumber: ['series number', 'book number', 'number in series', '#'],
     publisher: ['publisher', 'publishing company'],
     publicationYear: ['year', 'publication year', 'year published', 'original publication year'],
   }

   export function detectFormat(headers: string[]): 'goodreads' | 'storygraph' | 'csv' {
     const headerSet = new Set(headers.map((h) => h.toLowerCase()))

     // Goodreads export has specific columns
     if (headerSet.has('book id') && headerSet.has('bookshelves')) {
       return 'goodreads'
     }

     // StoryGraph has different columns
     if (headerSet.has('read status') && headerSet.has('star rating')) {
       return 'storygraph'
     }

     return 'csv'
   }

   export function suggestMapping(headers: string[]): ImportMapping {
     const mapping: ImportMapping = {
       title: null,
       author: null,
       isbn: null,
       seriesName: null,
       seriesNumber: null,
       publisher: null,
       publicationYear: null,
     }

     const lowerHeaders = headers.map((h) => h.toLowerCase().trim())

     for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
       for (const alias of aliases) {
         const index = lowerHeaders.findIndex((h) => h === alias || h.includes(alias))
         if (index !== -1) {
           ;(mapping as any)[field] = headers[index]
           break
         }
       }
     }

     return mapping
   }

   export async function parseCSV(
     file: File
   ): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
     return new Promise((resolve, reject) => {
       Papa.parse(file, {
         header: true,
         skipEmptyLines: true,
         complete: (results) => {
           if (results.errors.length > 0) {
             reject(new Error(results.errors[0].message))
             return
           }

           const headers = results.meta.fields || []
           resolve({
             headers,
             rows: results.data as Record<string, string>[],
           })
         },
         error: (error) => {
           reject(error)
         },
       })
     })
   }

   export function applyMapping(
     row: Record<string, string>,
     mapping: ImportMapping
   ): ImportRow | null {
     const title = mapping.title ? row[mapping.title]?.trim() : null
     const author = mapping.author ? row[mapping.author]?.trim() : null

     if (!title || !author) {
       return null
     }

     return {
       title,
       author,
       isbn: mapping.isbn ? row[mapping.isbn]?.trim() : undefined,
       seriesName: mapping.seriesName ? row[mapping.seriesName]?.trim() : undefined,
       seriesNumber: mapping.seriesNumber
         ? parseFloat(row[mapping.seriesNumber]) || undefined
         : undefined,
       publisher: mapping.publisher ? row[mapping.publisher]?.trim() : undefined,
       publicationYear: mapping.publicationYear
         ? parseInt(row[mapping.publicationYear]) || undefined
         : undefined,
     }
   }

   export async function createPreview(file: File): Promise<ImportPreview> {
     const { headers, rows } = await parseCSV(file)
     const format = detectFormat(headers)
     const suggestedMapping = suggestMapping(headers)

     return {
       format,
       totalRows: rows.length,
       columns: headers,
       suggestedMapping,
       sampleRows: rows.slice(0, 5),
     }
   }
   ```

4. **Create `lib/import/goodreads.ts`:**
   ```typescript
   import { ImportMapping } from './types'

   export const GOODREADS_MAPPING: ImportMapping = {
     title: 'Title',
     author: 'Author',
     isbn: 'ISBN13',
     seriesName: null, // Goodreads doesn't export series directly
     seriesNumber: null,
     publisher: 'Publisher',
     publicationYear: 'Original Publication Year',
   }

   // Goodreads puts series info in the title like "Title (Series, #1)"
   export function extractSeriesFromTitle(title: string): {
     cleanTitle: string
     seriesName?: string
     seriesNumber?: number
   } {
     // Common patterns: "Title (Series, #1)" or "Title (Series #1)"
     const match = title.match(/^(.+?)\s*\(([^,]+?)(?:,?\s*#?(\d+(?:\.\d+)?))?\)$/)

     if (match) {
       return {
         cleanTitle: match[1].trim(),
         seriesName: match[2].trim(),
         seriesNumber: match[3] ? parseFloat(match[3]) : undefined,
       }
     }

     return { cleanTitle: title }
   }
   ```

5. **Create test `__tests__/lib/import/parser.test.ts`:**
   ```typescript
   import { describe, it, expect } from 'vitest'
   import { detectFormat, suggestMapping, applyMapping } from '@/lib/import/parser'
   import { extractSeriesFromTitle } from '@/lib/import/goodreads'

   describe('Import parser', () => {
     describe('detectFormat', () => {
       it('detects Goodreads format', () => {
         const headers = ['Book Id', 'Title', 'Author', 'Bookshelves']
         expect(detectFormat(headers)).toBe('goodreads')
       })

       it('detects StoryGraph format', () => {
         const headers = ['Title', 'Author', 'Read Status', 'Star Rating']
         expect(detectFormat(headers)).toBe('storygraph')
       })

       it('detects generic CSV', () => {
         const headers = ['Title', 'Author', 'ISBN']
         expect(detectFormat(headers)).toBe('csv')
       })
     })

     describe('suggestMapping', () => {
       it('maps common column names', () => {
         const headers = ['Book Title', 'Author Name', 'ISBN-13', 'Year Published']
         const mapping = suggestMapping(headers)

         expect(mapping.title).toBe('Book Title')
         expect(mapping.author).toBe('Author Name')
         expect(mapping.isbn).toBe('ISBN-13')
         expect(mapping.publicationYear).toBe('Year Published')
       })
     })

     describe('applyMapping', () => {
       it('extracts data using mapping', () => {
         const row = {
           Title: 'Mistborn',
           Author: 'Brandon Sanderson',
           ISBN: '9780765311788',
         }
         const mapping = {
           title: 'Title',
           author: 'Author',
           isbn: 'ISBN',
           seriesName: null,
           seriesNumber: null,
           publisher: null,
           publicationYear: null,
         }

         const result = applyMapping(row, mapping)

         expect(result).toEqual({
           title: 'Mistborn',
           author: 'Brandon Sanderson',
           isbn: '9780765311788',
         })
       })

       it('returns null for missing required fields', () => {
         const row = { Title: 'Mistborn' }
         const mapping = {
           title: 'Title',
           author: 'Author',
           isbn: null,
           seriesName: null,
           seriesNumber: null,
           publisher: null,
           publicationYear: null,
         }

         expect(applyMapping(row, mapping)).toBeNull()
       })
     })

     describe('extractSeriesFromTitle', () => {
       it('extracts series from Goodreads format', () => {
         const result = extractSeriesFromTitle('The Way of Kings (The Stormlight Archive, #1)')

         expect(result.cleanTitle).toBe('The Way of Kings')
         expect(result.seriesName).toBe('The Stormlight Archive')
         expect(result.seriesNumber).toBe(1)
       })

       it('handles titles without series', () => {
         const result = extractSeriesFromTitle('Standalone Book')

         expect(result.cleanTitle).toBe('Standalone Book')
         expect(result.seriesName).toBeUndefined()
       })
     })
   })
   ```

**SUCCESS CRITERIA:**
- CSV files are parsed correctly
- Goodreads format is detected automatically
- Column mapping suggestions work
- Missing required fields are handled
- All tests pass

**DO NOT:**
- Create API routes yet (next prompt)
- Build import UI
```

---

## Prompt 24: Import API Routes

```text
Create the API routes for the import flow.

**TASK: Build import preview and execute endpoints.**

1. **Create `app/api/import/preview/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { createPreview } from '@/lib/import/parser'
   import { GOODREADS_MAPPING } from '@/lib/import/goodreads'
   import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

   export const POST = withAuth(async (request: NextRequest, session) => {
     try {
       const formData = await request.formData()
       const file = formData.get('file') as File | null

       if (!file) {
         return errorResponse('NO_FILE', 'No file provided', 400)
       }

       if (!file.name.endsWith('.csv')) {
         return errorResponse('INVALID_FORMAT', 'Only CSV files are supported', 400)
       }

       const preview = await createPreview(file)

       // Apply format-specific mappings
       if (preview.format === 'goodreads') {
         preview.suggestedMapping = GOODREADS_MAPPING
       }

       return successResponse({ preview })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

2. **Create `lib/import/executor.ts`:**
   ```typescript
   import { prisma } from '@/lib/db'
   import { ImportMapping, ImportResult } from './types'
   import { applyMapping } from './parser'
   import { normalizeToIsbn13 } from '@/lib/books/isbn'
   import { extractSeriesFromTitle } from './goodreads'

   export async function executeImport(
     userId: string,
     rows: Record<string, string>[],
     mapping: ImportMapping,
     format: 'csv' | 'goodreads' | 'storygraph'
   ): Promise<ImportResult> {
     const result: ImportResult = {
       imported: 0,
       duplicates: 0,
       errors: [],
     }

     // Get existing ISBNs for duplicate detection
     const existingBooks = await prisma.book.findMany({
       where: { userId },
       select: { isbn13: true },
     })
     const existingIsbns = new Set(existingBooks.map((b) => b.isbn13).filter(Boolean))

     for (let i = 0; i < rows.length; i++) {
       try {
         let importRow = applyMapping(rows[i], mapping)

         if (!importRow) {
           result.errors.push({
             row: i + 1,
             error: 'Missing required fields (title or author)',
           })
           continue
         }

         // Handle Goodreads series extraction
         if (format === 'goodreads' && importRow.title) {
           const { cleanTitle, seriesName, seriesNumber } = extractSeriesFromTitle(importRow.title)
           importRow = {
             ...importRow,
             title: cleanTitle,
             seriesName: seriesName || importRow.seriesName,
             seriesNumber: seriesNumber || importRow.seriesNumber,
           }
         }

         // Normalize ISBN
         const isbn13 = importRow.isbn ? normalizeToIsbn13(importRow.isbn) : null

         // Check for duplicates
         if (isbn13 && existingIsbns.has(isbn13)) {
           result.duplicates++
           continue
         }

         // Find or create author
         const author = await prisma.author.upsert({
           where: {
             userId_name: { userId, name: importRow.author },
           },
           update: {},
           create: {
             userId,
             name: importRow.author,
           },
         })

         // Create book
         await prisma.book.create({
           data: {
             userId,
             authorId: author.id,
             title: importRow.title,
             isbn13,
             publisher: importRow.publisher,
             publicationYear: importRow.publicationYear,
             seriesName: importRow.seriesName,
             seriesNumber: importRow.seriesNumber,
             source: 'IMPORT',
           },
         })

         // Add to existing set to prevent duplicates within import
         if (isbn13) {
           existingIsbns.add(isbn13)
         }

         result.imported++
       } catch (error) {
         result.errors.push({
           row: i + 1,
           error: error instanceof Error ? error.message : 'Unknown error',
         })
       }
     }

     return result
   }
   ```

3. **Create `app/api/import/execute/route.ts`:**
   ```typescript
   import { NextRequest } from 'next/server'
   import { withAuth } from '@/lib/api/withAuth'
   import { parseCSV } from '@/lib/import/parser'
   import { executeImport } from '@/lib/import/executor'
   import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'

   export const POST = withAuth(async (request: NextRequest, session) => {
     try {
       // Rate limit: 5 imports per hour
       const rateLimit = checkRateLimit(`import:${session.userId}`, 5, 60 * 60 * 1000)

       if (!rateLimit.allowed) {
         return errorResponse(
           'RATE_LIMITED',
           'Too many imports. Please wait before importing again.',
           429
         )
       }

       const formData = await request.formData()
       const file = formData.get('file') as File | null
       const mappingStr = formData.get('mapping') as string | null
       const format = (formData.get('format') as string) || 'csv'

       if (!file || !mappingStr) {
         return errorResponse('MISSING_DATA', 'File and mapping required', 400)
       }

       const mapping = JSON.parse(mappingStr)
       const { rows } = await parseCSV(file)

       const result = await executeImport(
         session.userId,
         rows,
         mapping,
         format as 'csv' | 'goodreads' | 'storygraph'
       )

       return successResponse({ result })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

4. **Create integration test `__tests__/api/import.test.ts`:**
   ```typescript
   import { describe, it, expect, beforeAll, afterAll } from 'vitest'
   import { prisma } from '@/lib/db'
   import { hashPassword } from '@/lib/auth/password'

   describe('Import API', () => {
     const testEmail = `import-test-${Date.now()}@example.com`
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

       const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           email: testEmail,
           password: 'TestPassword123!',
         }),
       })
       sessionCookie = loginResponse.headers.get('set-cookie')!.split(';')[0]
     })

     afterAll(async () => {
       await prisma.user.delete({ where: { id: userId } })
     })

     it('previews CSV file', async () => {
       const csvContent = 'Title,Author,ISBN\nMistborn,Brandon Sanderson,9780765311788'
       const file = new Blob([csvContent], { type: 'text/csv' })

       const formData = new FormData()
       formData.append('file', file, 'books.csv')

       const response = await fetch('http://localhost:3000/api/import/preview', {
         method: 'POST',
         headers: { Cookie: sessionCookie },
         body: formData,
       })

       expect(response.status).toBe(200)
       const data = await response.json()

       expect(data.preview.totalRows).toBe(1)
       expect(data.preview.columns).toContain('Title')
       expect(data.preview.suggestedMapping.title).toBe('Title')
     })

     it('executes import', async () => {
       const csvContent =
         'Title,Author,ISBN\nThe Way of Kings,Brandon Sanderson,9780765326355'
       const file = new Blob([csvContent], { type: 'text/csv' })

       const mapping = {
         title: 'Title',
         author: 'Author',
         isbn: 'ISBN',
         seriesName: null,
         seriesNumber: null,
         publisher: null,
         publicationYear: null,
       }

       const formData = new FormData()
       formData.append('file', file, 'books.csv')
       formData.append('mapping', JSON.stringify(mapping))
       formData.append('format', 'csv')

       const response = await fetch('http://localhost:3000/api/import/execute', {
         method: 'POST',
         headers: { Cookie: sessionCookie },
         body: formData,
       })

       expect(response.status).toBe(200)
       const data = await response.json()

       expect(data.result.imported).toBe(1)
       expect(data.result.duplicates).toBe(0)
     })
   })
   ```

**SUCCESS CRITERIA:**
- Preview endpoint parses and returns file info
- Execute endpoint imports books correctly
- Duplicates are detected and skipped
- Errors are tracked per row
- Rate limiting prevents abuse
- All tests pass

**DO NOT:**
- Build import UI yet (next prompt)
- Implement background enrichment
```

---

## Prompt 25: Import UI

```text
Create the import user interface with file upload, mapping, and results.

**TASK: Build the complete import flow UI.**

1. **Create `app/library/import/page.tsx`:**
   ```typescript
   'use client'

   import { useState, useRef } from 'react'
   import { useRouter } from 'next/navigation'
   import { Button } from '@/components/ui/button'

   type ImportStep = 'upload' | 'mapping' | 'importing' | 'complete'

   interface Preview {
     format: string
     totalRows: number
     columns: string[]
     suggestedMapping: Record<string, string | null>
     sampleRows: Record<string, string>[]
   }

   interface ImportResult {
     imported: number
     duplicates: number
     errors: Array<{ row: number; error: string }>
   }

   export default function ImportPage() {
     const router = useRouter()
     const fileInputRef = useRef<HTMLInputElement>(null)

     const [step, setStep] = useState<ImportStep>('upload')
     const [file, setFile] = useState<File | null>(null)
     const [preview, setPreview] = useState<Preview | null>(null)
     const [mapping, setMapping] = useState<Record<string, string | null>>({})
     const [result, setResult] = useState<ImportResult | null>(null)
     const [error, setError] = useState<string | null>(null)
     const [loading, setLoading] = useState(false)

     const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
       const selectedFile = e.target.files?.[0]
       if (!selectedFile) return

       setFile(selectedFile)
       setError(null)
       setLoading(true)

       try {
         const formData = new FormData()
         formData.append('file', selectedFile)

         const response = await fetch('/api/import/preview', {
           method: 'POST',
           body: formData,
         })

         if (!response.ok) {
           const data = await response.json()
           throw new Error(data.message || 'Failed to parse file')
         }

         const data = await response.json()
         setPreview(data.preview)
         setMapping(data.preview.suggestedMapping)
         setStep('mapping')
       } catch (err) {
         setError(err instanceof Error ? err.message : 'Failed to parse file')
       } finally {
         setLoading(false)
       }
     }

     const handleImport = async () => {
       if (!file || !preview) return

       setLoading(true)
       setStep('importing')

       try {
         const formData = new FormData()
         formData.append('file', file)
         formData.append('mapping', JSON.stringify(mapping))
         formData.append('format', preview.format)

         const response = await fetch('/api/import/execute', {
           method: 'POST',
           body: formData,
         })

         if (!response.ok) {
           const data = await response.json()
           throw new Error(data.message || 'Import failed')
         }

         const data = await response.json()
         setResult(data.result)
         setStep('complete')
       } catch (err) {
         setError(err instanceof Error ? err.message : 'Import failed')
         setStep('mapping')
       } finally {
         setLoading(false)
       }
     }

     // Step 1: Upload
     if (step === 'upload') {
       return (
         <div className="max-w-2xl mx-auto px-4 py-6">
           <h1 className="text-2xl font-bold mb-6">Import Books</h1>

           <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
             <input
               ref={fileInputRef}
               type="file"
               accept=".csv"
               onChange={handleFileSelect}
               className="hidden"
             />

             <div className="text-4xl mb-4">📁</div>

             <p className="text-gray-600 dark:text-gray-400 mb-4">
               Upload a CSV file from Goodreads, StoryGraph, or your own spreadsheet
             </p>

             <Button onClick={() => fileInputRef.current?.click()} loading={loading}>
               Select CSV file
             </Button>

             {error && <p className="text-red-600 mt-4">{error}</p>}
           </div>

           <div className="mt-6 text-sm text-gray-500 space-y-2">
             <p>
               <strong>Supported formats:</strong>
             </p>
             <ul className="list-disc ml-6">
               <li>Goodreads export (My Books → Export)</li>
               <li>StoryGraph export</li>
               <li>Custom CSV with Title and Author columns</li>
             </ul>
           </div>
         </div>
       )
     }

     // Step 2: Mapping
     if (step === 'mapping' && preview) {
       return (
         <div className="max-w-2xl mx-auto px-4 py-6">
           <h1 className="text-2xl font-bold mb-6">Import Books</h1>

           <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
             <div className="flex justify-between items-center mb-4">
               <div>
                 <p className="font-medium">{file?.name}</p>
                 <p className="text-sm text-gray-500">
                   {preview.totalRows} rows • {preview.format} format detected
                 </p>
               </div>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => {
                   setStep('upload')
                   setFile(null)
                   setPreview(null)
                 }}
               >
                 Change file
               </Button>
             </div>

             <h3 className="font-medium mb-3">Column Mapping</h3>

             <div className="space-y-3">
               {['title', 'author', 'isbn', 'seriesName', 'publisher', 'publicationYear'].map(
                 (field) => (
                   <div key={field} className="flex items-center gap-4">
                     <label className="w-32 text-sm text-gray-600 capitalize">
                       {field.replace(/([A-Z])/g, ' $1')}
                       {(field === 'title' || field === 'author') && ' *'}
                     </label>
                     <select
                       value={mapping[field] || ''}
                       onChange={(e) =>
                         setMapping((m) => ({
                           ...m,
                           [field]: e.target.value || null,
                         }))
                       }
                       className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800"
                     >
                       <option value="">-- Not mapped --</option>
                       {preview.columns.map((col) => (
                         <option key={col} value={col}>
                           {col}
                         </option>
                       ))}
                     </select>
                   </div>
                 )
               )}
             </div>
           </div>

           {/* Preview */}
           <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
             <h3 className="font-medium mb-3">Preview</h3>
             <div className="overflow-x-auto">
               <table className="w-full text-sm">
                 <thead>
                   <tr className="border-b dark:border-gray-700">
                     <th className="text-left py-2">Title</th>
                     <th className="text-left py-2">Author</th>
                   </tr>
                 </thead>
                 <tbody>
                   {preview.sampleRows.slice(0, 3).map((row, i) => (
                     <tr key={i} className="border-b dark:border-gray-700">
                       <td className="py-2">{mapping.title ? row[mapping.title] : '-'}</td>
                       <td className="py-2">{mapping.author ? row[mapping.author] : '-'}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>

           {error && (
             <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg mb-6">
               {error}
             </div>
           )}

           <div className="flex gap-4">
             <Button
               onClick={handleImport}
               disabled={!mapping.title || !mapping.author}
               className="flex-1"
             >
               Import {preview.totalRows} books
             </Button>
             <Button variant="secondary" onClick={() => router.push('/library')}>
               Cancel
             </Button>
           </div>
         </div>
       )
     }

     // Step 3: Importing
     if (step === 'importing') {
       return (
         <div className="max-w-2xl mx-auto px-4 py-6">
           <h1 className="text-2xl font-bold mb-6">Import Books</h1>

           <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
             <div className="animate-spin text-4xl mb-4">📚</div>
             <p className="text-lg font-medium">Importing your books...</p>
             <p className="text-gray-500 mt-2">This may take a moment</p>
           </div>
         </div>
       )
     }

     // Step 4: Complete
     if (step === 'complete' && result) {
       return (
         <div className="max-w-2xl mx-auto px-4 py-6">
           <h1 className="text-2xl font-bold mb-6">Import Complete</h1>

           <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
             <div className="grid grid-cols-3 gap-4 mb-6">
               <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                 <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                 <p className="text-sm text-green-700 dark:text-green-400">Imported</p>
               </div>
               <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                 <p className="text-2xl font-bold text-yellow-600">{result.duplicates}</p>
                 <p className="text-sm text-yellow-700 dark:text-yellow-400">Duplicates</p>
               </div>
               <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                 <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                 <p className="text-sm text-red-700 dark:text-red-400">Errors</p>
               </div>
             </div>

             {result.errors.length > 0 && (
               <details className="text-sm">
                 <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                   View errors
                 </summary>
                 <ul className="mt-2 space-y-1 text-red-600">
                   {result.errors.slice(0, 10).map((err, i) => (
                     <li key={i}>
                       Row {err.row}: {err.error}
                     </li>
                   ))}
                   {result.errors.length > 10 && (
                     <li>...and {result.errors.length - 10} more</li>
                   )}
                 </ul>
               </details>
             )}
           </div>

           <Button onClick={() => router.push('/library')} className="w-full">
             Go to library
           </Button>
         </div>
       )
     }

     return null
   }
   ```

**SUCCESS CRITERIA:**
- File upload works
- Column mapping is intuitive with preview
- Import progress shows during execution
- Results summary shows imported/duplicates/errors
- Navigation to library works after completion

**DO NOT:**
- Implement background enrichment yet (next prompt)
- Add PWA offline features
```

---

## Prompt 26: Background Metadata Enrichment

```text
Add background enrichment for imported books missing metadata.

**TASK: Create a service to enrich imported books with missing metadata.**

1. **Create `lib/enrichment/service.ts`:**
   ```typescript
   import { prisma } from '@/lib/db'
   import { lookupByIsbn } from '@/lib/metadata'

   interface EnrichmentResult {
     processed: number
     enriched: number
     errors: number
   }

   export async function enrichUserBooks(userId: string): Promise<EnrichmentResult> {
     const result: EnrichmentResult = {
       processed: 0,
       enriched: 0,
       errors: 0,
     }

     // Find books that need enrichment (have ISBN but missing cover or publisher)
     const booksToEnrich = await prisma.book.findMany({
       where: {
         userId,
         isbn13: { not: null },
         OR: [{ coverUrl: null }, { publisher: null }],
       },
       take: 20, // Process in batches
     })

     for (const book of booksToEnrich) {
       result.processed++

       try {
         if (!book.isbn13) continue

         const metadata = await lookupByIsbn(book.isbn13)

         if (!metadata) continue

         // Only update fields that are missing
         const updates: Record<string, any> = {}

         if (!book.coverUrl && metadata.coverUrl) {
           updates.coverUrl = metadata.coverUrl
         }
         if (!book.publisher && metadata.publisher) {
           updates.publisher = metadata.publisher
         }
         if (!book.publicationYear && metadata.publishedYear) {
           updates.publicationYear = metadata.publishedYear
         }
         if (book.genres.length === 0 && metadata.subjects?.length) {
           updates.genres = metadata.subjects.slice(0, 10)
         }

         if (Object.keys(updates).length > 0) {
           await prisma.book.update({
             where: { id: book.id },
             data: updates,
           })
           result.enriched++
         }

         // Small delay to avoid rate limiting
         await new Promise((resolve) => setTimeout(resolve, 500))
       } catch (error) {
         console.error(`Enrichment error for book ${book.id}:`, error)
         result.errors++
       }
     }

     return result
   }
   ```

2. **Create `app/api/enrichment/trigger/route.ts`:**
   ```typescript
   import { withAuth } from '@/lib/api/withAuth'
   import { enrichUserBooks } from '@/lib/enrichment/service'
   import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'

   export const POST = withAuth(async (request, session) => {
     try {
       // Rate limit: 1 enrichment per 5 minutes
       const rateLimit = checkRateLimit(`enrich:${session.userId}`, 1, 5 * 60 * 1000)

       if (!rateLimit.allowed) {
         return errorResponse('RATE_LIMITED', 'Enrichment already in progress', 429)
       }

       const result = await enrichUserBooks(session.userId)

       return successResponse({ result })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

3. **Create `app/api/enrichment/status/route.ts`:**
   ```typescript
   import { withAuth } from '@/lib/api/withAuth'
   import { prisma } from '@/lib/db'
   import { successResponse, handleApiError } from '@/lib/api/response'

   export const GET = withAuth(async (request, session) => {
     try {
       // Count books that need enrichment
       const needsEnrichment = await prisma.book.count({
         where: {
           userId: session.userId,
           isbn13: { not: null },
           OR: [{ coverUrl: null }, { publisher: null }],
         },
       })

       return successResponse({
         needsEnrichment,
         canEnrich: needsEnrichment > 0,
       })
     } catch (error) {
       return handleApiError(error)
     }
   })
   ```

4. **Create enrichment UI component to add to settings or library:**
   ```typescript
   // components/enrichment/enrichment-section.tsx
   'use client'

   import { useState, useEffect } from 'react'
   import { Button } from '@/components/ui/button'

   export function EnrichmentSection() {
     const [status, setStatus] = useState<{ needsEnrichment: number } | null>(null)
     const [running, setRunning] = useState(false)
     const [result, setResult] = useState<{ enriched: number } | null>(null)

     useEffect(() => {
       fetch('/api/enrichment/status')
         .then((r) => r.json())
         .then(setStatus)
         .catch(() => {})
     }, [])

     const handleEnrich = async () => {
       setRunning(true)
       try {
         const response = await fetch('/api/enrichment/trigger', { method: 'POST' })
         const data = await response.json()
         setResult(data.result)

         // Refresh status
         const statusResponse = await fetch('/api/enrichment/status')
         setStatus(await statusResponse.json())
       } finally {
         setRunning(false)
       }
     }

     if (!status || status.needsEnrichment === 0) return null

     return (
       <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
         <p className="text-sm text-blue-800 dark:text-blue-200">
           {status.needsEnrichment} books may have missing metadata
         </p>
         <Button size="sm" onClick={handleEnrich} loading={running} className="mt-2">
           Enrich metadata
         </Button>
         {result && (
           <p className="text-sm text-blue-600 mt-2">Updated {result.enriched} books</p>
         )}
       </div>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Enrichment finds books with missing metadata
- Metadata is fetched and updated
- Rate limiting prevents abuse
- Status endpoint shows pending enrichment count

**DO NOT:**
- Implement automatic background jobs (manual trigger only for v1)
- Start PWA features yet (next phase)
```

---

## Prompt 27: Service Worker Setup

```text
Configure the Progressive Web App with service worker for offline support.

**TASK: Set up PWA manifest and service worker configuration.**

1. **Install next-pwa:**
   ```bash
   npm install next-pwa
   ```

2. **Create `public/manifest.json`:**
   ```json
   {
     "name": "Tome Tracker",
     "short_name": "Library",
     "description": "Scan and manage your personal book library",
     "start_url": "/library",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#3b82f6",
     "orientation": "portrait",
     "icons": [
       {
         "src": "/icons/icon-192.png",
         "sizes": "192x192",
         "type": "image/png",
         "purpose": "any maskable"
       },
       {
         "src": "/icons/icon-512.png",
         "sizes": "512x512",
         "type": "image/png",
         "purpose": "any maskable"
       }
     ]
   }
   ```

3. **Update `next.config.js`:**
   ```javascript
   const withPWA = require('next-pwa')({
     dest: 'public',
     register: true,
     skipWaiting: true,
     disable: process.env.NODE_ENV === 'development',
     runtimeCaching: [
       {
         urlPattern: /^https:\/\/covers\.openlibrary\.org\/.*/i,
         handler: 'CacheFirst',
         options: {
           cacheName: 'cover-images',
           expiration: {
             maxEntries: 500,
             maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
           },
         },
       },
       {
         urlPattern: /^https:\/\/books\.google\.com\/books\/content.*/i,
         handler: 'CacheFirst',
         options: {
           cacheName: 'google-covers',
           expiration: {
             maxEntries: 500,
             maxAgeSeconds: 60 * 60 * 24 * 30,
           },
         },
       },
       {
         urlPattern: /\/api\/library\/sync/,
         handler: 'NetworkFirst',
         options: {
           cacheName: 'library-sync',
           networkTimeoutSeconds: 10,
           expiration: {
             maxAgeSeconds: 60 * 60 * 24, // 24 hours
           },
         },
       },
     ],
   })

   /** @type {import('next').NextConfig} */
   const nextConfig = {
     reactStrictMode: true,
   }

   module.exports = withPWA(nextConfig)
   ```

4. **Create placeholder icons:**
   Create `/public/icons/` directory with:
   - `icon-192.png` (192x192 pixels)
   - `icon-512.png` (512x512 pixels)

5. **Update `app/layout.tsx` metadata:**
   ```typescript
   export const metadata = {
     title: 'Tome Tracker',
     description: 'Scan and manage your personal book library',
     manifest: '/manifest.json',
     appleWebApp: {
       capable: true,
       statusBarStyle: 'default',
       title: 'Tome Tracker',
     },
   }

   export const viewport = {
     width: 'device-width',
     initialScale: 1,
     maximumScale: 1,
     userScalable: false,
     themeColor: '#3b82f6',
     viewportFit: 'cover',
   }
   ```

6. **Add Apple-specific meta tags to layout head:**
   ```typescript
   // In app/layout.tsx, add to <head>
   <link rel="apple-touch-icon" href="/icons/icon-192.png" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="default" />
   ```

**SUCCESS CRITERIA:**
- PWA manifest is valid
- Service worker registers in production
- Cover images are cached
- Library sync is cached with network-first strategy
- App can be installed on mobile devices

**DO NOT:**
- Implement IndexedDB caching yet (next prompt)
- Build offline detection UI
```

---

## Prompt 28: IndexedDB Local Cache

```text
Implement IndexedDB caching for offline library access.

**TASK: Create IndexedDB storage for offline library data.**

1. **Install idb:**
   ```bash
   npm install idb
   ```

2. **Create `lib/offline/db.ts`:**
   ```typescript
   import { openDB, DBSchema, IDBPDatabase } from 'idb'

   interface LibraryDB extends DBSchema {
     authors: {
       key: string
       value: {
         id: string
         name: string
         bio: string | null
         photoUrl: string | null
       }
       indexes: { 'by-name': string }
     }
     books: {
       key: string
       value: {
         id: string
         authorId: string
         title: string
         isbn13: string | null
         coverUrl: string | null
         seriesName: string | null
         seriesNumber: number | null
       }
       indexes: { 'by-author': string; 'by-isbn': string }
     }
     metadata: {
       key: string
       value: {
         key: string
         value: string
         updatedAt: string
       }
     }
   }

   let dbPromise: Promise<IDBPDatabase<LibraryDB>> | null = null

   function getDB() {
     if (!dbPromise) {
       dbPromise = openDB<LibraryDB>('tome-tracker', 1, {
         upgrade(db) {
           // Authors store
           const authorStore = db.createObjectStore('authors', { keyPath: 'id' })
           authorStore.createIndex('by-name', 'name')

           // Books store
           const bookStore = db.createObjectStore('books', { keyPath: 'id' })
           bookStore.createIndex('by-author', 'authorId')
           bookStore.createIndex('by-isbn', 'isbn13')

           // Metadata store (for sync timestamps, etc.)
           db.createObjectStore('metadata', { keyPath: 'key' })
         },
       })
     }
     return dbPromise
   }

   export async function cacheLibraryData(
     authors: LibraryDB['authors']['value'][],
     books: LibraryDB['books']['value'][]
   ) {
     const db = await getDB()
     const tx = db.transaction(['authors', 'books', 'metadata'], 'readwrite')

     // Clear existing data
     await tx.objectStore('authors').clear()
     await tx.objectStore('books').clear()

     // Add new data
     for (const author of authors) {
       await tx.objectStore('authors').put(author)
     }

     for (const book of books) {
       await tx.objectStore('books').put(book)
     }

     // Update sync timestamp
     await tx.objectStore('metadata').put({
       key: 'lastSync',
       value: new Date().toISOString(),
       updatedAt: new Date().toISOString(),
     })

     await tx.done
   }

   export async function getCachedLibrary() {
     const db = await getDB()

     const [authors, books, syncMeta] = await Promise.all([
       db.getAll('authors'),
       db.getAll('books'),
       db.get('metadata', 'lastSync'),
     ])

     return {
       authors,
       books,
       lastSync: syncMeta?.value || null,
     }
   }

   export async function checkOwnershipOffline(isbn13: string): Promise<boolean> {
     const db = await getDB()
     const book = await db.getFromIndex('books', 'by-isbn', isbn13)
     return book !== null
   }

   export async function searchBooksOffline(query: string) {
     const db = await getDB()
     const books = await db.getAll('books')
     const authors = await db.getAll('authors')

     const authorMap = new Map(authors.map((a) => [a.id, a]))
     const lowerQuery = query.toLowerCase()

     return books.filter((book) => {
       const author = authorMap.get(book.authorId)
       return (
         book.title.toLowerCase().includes(lowerQuery) ||
         author?.name.toLowerCase().includes(lowerQuery)
       )
     })
   }

   export async function getCacheStats() {
     const db = await getDB()

     const [authorCount, bookCount, syncMeta] = await Promise.all([
       db.count('authors'),
       db.count('books'),
       db.get('metadata', 'lastSync'),
     ])

     return {
       authorCount,
       bookCount,
       lastSync: syncMeta?.value || null,
     }
   }

   export async function clearCache() {
     const db = await getDB()
     const tx = db.transaction(['authors', 'books', 'metadata'], 'readwrite')

     await tx.objectStore('authors').clear()
     await tx.objectStore('books').clear()
     await tx.objectStore('metadata').clear()

     await tx.done
   }
   ```

3. **Create `lib/hooks/useOfflineLibrary.ts`:**
   ```typescript
   'use client'

   import { useState, useEffect, useCallback } from 'react'
   import {
     getCachedLibrary,
     cacheLibraryData,
     searchBooksOffline,
     getCacheStats,
     clearCache,
   } from '@/lib/offline/db'

   export function useOfflineLibrary() {
     const [isOnline, setIsOnline] = useState(true)
     const [cacheStats, setCacheStats] = useState<{
       bookCount: number
       authorCount: number
       lastSync: string | null
     } | null>(null)

     // Track online/offline status
     useEffect(() => {
       setIsOnline(navigator.onLine)

       const handleOnline = () => setIsOnline(true)
       const handleOffline = () => setIsOnline(false)

       window.addEventListener('online', handleOnline)
       window.addEventListener('offline', handleOffline)

       return () => {
         window.removeEventListener('online', handleOnline)
         window.removeEventListener('offline', handleOffline)
       }
     }, [])

     // Load cache stats
     useEffect(() => {
       getCacheStats().then(setCacheStats).catch(() => {})
     }, [])

     const syncAndCache = useCallback(async () => {
       if (!navigator.onLine) return false

       try {
         const response = await fetch('/api/library/sync')
         if (!response.ok) return false

         const data = await response.json()

         // Transform data for caching
         const authors = data.authors.map((a: any) => ({
           id: a.id,
           name: a.name,
           bio: a.bio,
           photoUrl: a.photoUrl,
         }))

         const books = data.authors.flatMap((a: any) =>
           a.books.map((b: any) => ({
             id: b.id,
             authorId: a.id,
             title: b.title,
             isbn13: b.isbn13,
             coverUrl: b.coverUrl,
             seriesName: b.seriesName,
             seriesNumber: b.seriesNumber,
           }))
         )

         await cacheLibraryData(authors, books)
         setCacheStats(await getCacheStats())

         return true
       } catch {
         return false
       }
     }, [])

     const searchOffline = useCallback(async (query: string) => {
       return searchBooksOffline(query)
     }, [])

     const getCached = useCallback(async () => {
       return getCachedLibrary()
     }, [])

     const clearLocalCache = useCallback(async () => {
       await clearCache()
       setCacheStats(await getCacheStats())
     }, [])

     return {
       isOnline,
       cacheStats,
       syncAndCache,
       searchOffline,
       getCached,
       clearLocalCache,
     }
   }
   ```

**SUCCESS CRITERIA:**
- IndexedDB stores library data
- Offline search works on cached data
- Cache stats are available
- Clear cache function works
- Online/offline status is tracked

**DO NOT:**
- Build offline UI indicators yet (next prompt)
- Implement background sync
```

---

## Prompt 29: Offline Mode UI

```text
Create the offline mode user interface and indicators.

**TASK: Build offline indicators and behavior throughout the app.**

1. **Create `components/offline/offline-banner.tsx`:**
   ```typescript
   'use client'

   import { useState, useEffect } from 'react'

   export function OfflineBanner() {
     const [isOnline, setIsOnline] = useState(true)

     useEffect(() => {
       setIsOnline(navigator.onLine)

       const handleOnline = () => setIsOnline(true)
       const handleOffline = () => setIsOnline(false)

       window.addEventListener('online', handleOnline)
       window.addEventListener('offline', handleOffline)

       return () => {
         window.removeEventListener('online', handleOnline)
         window.removeEventListener('offline', handleOffline)
       }
     }, [])

     if (isOnline) return null

     return (
       <div className="bg-yellow-500 text-yellow-900 px-4 py-2 text-center text-sm">
         <span className="font-medium">You&apos;re offline.</span>
         <span> Some features are unavailable.</span>
       </div>
     )
   }
   ```

2. **Create `components/offline/offline-guard.tsx`:**
   ```typescript
   'use client'

   import { useState, useEffect } from 'react'
   import { Button } from '@/components/ui/button'

   interface OfflineGuardProps {
     children: React.ReactNode
     fallback?: React.ReactNode
     action: string // e.g., "add books", "search online"
   }

   export function OfflineGuard({ children, fallback, action }: OfflineGuardProps) {
     const [isOnline, setIsOnline] = useState(true)

     useEffect(() => {
       setIsOnline(navigator.onLine)

       const handleOnline = () => setIsOnline(true)
       const handleOffline = () => setIsOnline(false)

       window.addEventListener('online', handleOnline)
       window.addEventListener('offline', handleOffline)

       return () => {
         window.removeEventListener('online', handleOnline)
         window.removeEventListener('offline', handleOffline)
       }
     }, [])

     if (isOnline) {
       return <>{children}</>
     }

     if (fallback) {
       return <>{fallback}</>
     }

     return (
       <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
         <div className="text-4xl mb-4">📡</div>
         <h3 className="font-medium text-lg mb-2">You&apos;re offline</h3>
         <p className="text-gray-600 dark:text-gray-400 mb-4">
           You need an internet connection to {action}.
         </p>
         <Button variant="secondary" onClick={() => window.location.reload()}>
           Retry
         </Button>
       </div>
     )
   }
   ```

3. **Update `app/layout.tsx` to include banner:**
   ```typescript
   import { OfflineBanner } from '@/components/offline/offline-banner'

   // In the body:
   export default async function RootLayout({ children }) {
     // ... existing code ...
     
     return (
       <html lang="en">
         <body className={inter.className}>
           <OfflineBanner />
           <Header user={user} />
           <main className="min-h-screen pb-20 sm:pb-8">{children}</main>
           {user && <MobileNav />}
         </body>
       </html>
     )
   }
   ```

4. **Update scan page to handle offline:**
   ```typescript
   // In app/scan/page.tsx, wrap content with OfflineGuard
   import { OfflineGuard } from '@/components/offline/offline-guard'

   export default function ScanPage() {
     return (
       <OfflineGuard action="scan and add books">
         {/* existing scan content */}
       </OfflineGuard>
     )
   }
   ```

5. **Update library page to show cached data when offline:**
   Update the `useLibrary` hook to fall back to cached data:
   ```typescript
   // In lib/hooks/useLibrary.ts - add offline fallback
   
   import { useOfflineLibrary } from './useOfflineLibrary'

   export function useLibrary() {
     const { isOnline, getCached, syncAndCache } = useOfflineLibrary()
     const [loading, setLoading] = useState(true)
     const [error, setError] = useState<string | null>(null)
     const [authors, setAuthors] = useState<any[]>([])
     const [stats, setStats] = useState<any>(null)
     const [lastSynced, setLastSynced] = useState<string | null>(null)
     const [isFromCache, setIsFromCache] = useState(false)

     const sync = useCallback(async () => {
       setLoading(true)
       setError(null)

       if (isOnline) {
         try {
           const response = await fetch('/api/library/sync')

           if (response.ok) {
             const data = await response.json()
             setAuthors(data.authors)
             setStats(data.stats)
             setLastSynced(data.syncedAt)
             setIsFromCache(false)

             // Cache for offline use
             await syncAndCache()

             setLoading(false)
             return
           }
         } catch {
           // Fall through to cache
         }
       }

       // Try cache
       try {
         const cached = await getCached()

         if (cached.books.length > 0) {
           // Reconstruct authors with books from cache
           const authorMap = new Map<string, any>()

           for (const author of cached.authors) {
             authorMap.set(author.id, { ...author, books: [] })
           }

           for (const book of cached.books) {
             const author = authorMap.get(book.authorId)
             if (author) {
               author.books.push(book)
             }
           }

           setAuthors(Array.from(authorMap.values()).filter((a) => a.books.length > 0))
           setStats({ bookCount: cached.books.length, authorCount: authorMap.size })
           setLastSynced(cached.lastSync)
           setIsFromCache(true)
         } else {
           setError(isOnline ? 'Failed to load library' : 'No cached data available')
         }
       } catch {
         setError('Failed to load library')
       }

       setLoading(false)
     }, [isOnline, getCached, syncAndCache])

     useEffect(() => {
       sync()
     }, [sync])

     return { loading, error, authors, stats, lastSynced, isFromCache, sync }
   }
   ```

6. **Show cache indicator in library page:**
   ```typescript
   // In app/library/page.tsx, add indicator when viewing cached data
   {isFromCache && (
     <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg text-sm mb-4">
       📴 Viewing cached data from {lastSynced ? new Date(lastSynced).toLocaleString() : 'earlier'}
     </div>
   )}
   ```

**SUCCESS CRITERIA:**
- Offline banner shows when disconnected
- Scan page shows offline message
- Library falls back to cached data
- Cache indicator shows when viewing cached data
- Manual retry button is available

**DO NOT:**
- Implement background sync
- Add offline add functionality (explicitly not supported per spec)
```

---

## Prompt 30: Settings Page with Cache Controls

```text
Create the settings page with theme, cache, and account controls.

**TASK: Build the complete settings page.**

1. **Create `lib/hooks/useTheme.ts`:**
   ```typescript
   'use client'

   import { useState, useEffect } from 'react'

   type Theme = 'light' | 'dark' | 'system'

   export function useTheme() {
     const [theme, setThemeState] = useState<Theme>('system')

     useEffect(() => {
       const stored = localStorage.getItem('theme') as Theme | null
       if (stored) {
         setThemeState(stored)
         applyTheme(stored)
       }
     }, [])

     const setTheme = (newTheme: Theme) => {
       setThemeState(newTheme)
       localStorage.setItem('theme', newTheme)
       applyTheme(newTheme)
     }

     return { theme, setTheme }
   }

   function applyTheme(theme: Theme) {
     const root = document.documentElement

     if (theme === 'system') {
       const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
       root.classList.toggle('dark', prefersDark)
     } else {
       root.classList.toggle('dark', theme === 'dark')
     }
   }
   ```

2. **Create `app/settings/page.tsx`:**
   ```typescript
   'use client'

   import { useState } from 'react'
   import { useRouter } from 'next/navigation'
   import { useTheme } from '@/lib/hooks/useTheme'
   import { useOfflineLibrary } from '@/lib/hooks/useOfflineLibrary'
   import { Button } from '@/components/ui/button'

   export default function SettingsPage() {
     const router = useRouter()
     const { theme, setTheme } = useTheme()
     const { cacheStats, clearLocalCache, syncAndCache } = useOfflineLibrary()

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

     const handleLogout = async () => {
       await fetch('/api/auth/logout', { method: 'POST' })
       router.push('/login')
       router.refresh()
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
               <label className="flex items-center gap-3 cursor-pointer">
                 <input
                   type="radio"
                   name="theme"
                   checked={theme === 'light'}
                   onChange={() => setTheme('light')}
                   className="w-4 h-4"
                 />
                 <span>Light</span>
               </label>
               <label className="flex items-center gap-3 cursor-pointer">
                 <input
                   type="radio"
                   name="theme"
                   checked={theme === 'dark'}
                   onChange={() => setTheme('dark')}
                   className="w-4 h-4"
                 />
                 <span>Dark</span>
               </label>
               <label className="flex items-center gap-3 cursor-pointer">
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
                 <p>
                   Cached: {cacheStats.bookCount} books, {cacheStats.authorCount} authors
                 </p>
                 {cacheStats.lastSync && (
                   <p>Last synced: {new Date(cacheStats.lastSync).toLocaleString()}</p>
                 )}
               </div>
             )}

             <div className="flex gap-3">
               <Button variant="secondary" onClick={handleSync} loading={syncing}>
                 Sync now
               </Button>
               <Button variant="ghost" onClick={handleClearCache} loading={clearing}>
                 Clear cache
               </Button>
             </div>
           </section>

           {/* Account */}
           <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
             <h2 className="font-medium text-lg mb-4">Account</h2>

             <div className="space-y-4">
               <Button variant="secondary" onClick={handleLogout}>
                 Sign out
               </Button>

               <div className="pt-4 border-t dark:border-gray-700">
                 <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                   Permanently delete your account and all your library data.
                 </p>
                 <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
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
                 This will permanently delete your account and all your library data. This action
                 cannot be undone.
               </p>
               <div className="flex gap-3 justify-end">
                 <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                   Cancel
                 </Button>
                 <Button variant="danger" onClick={handleDeleteAccount} loading={deleting}>
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

## End of Phase 7 & 8

Phase 7 (Import System) and Phase 8 (PWA & Offline) are complete. You now have:

- ✅ CSV import parser with format detection
- ✅ Goodreads and StoryGraph support
- ✅ Import preview and execute API routes
- ✅ Complete import UI with mapping
- ✅ Background metadata enrichment
- ✅ PWA manifest and service worker
- ✅ IndexedDB caching for offline access
- ✅ Offline detection and UI indicators
- ✅ Settings page with theme and cache controls

Continue with **Phase 9: Admin & Polish** (Prompts 31-33).

