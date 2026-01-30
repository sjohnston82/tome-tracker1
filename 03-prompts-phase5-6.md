# Tome Tracker PWA - Implementation Prompts
# Phase 5: Basic UI Shell & Phase 6: Scanner (Prompts 15-22)

---

## Prompt 15: Layout and Navigation Components

```text
Begin building the UI with the app shell, layout, and navigation.

**TASK: Create the main layout, navigation, and basic page structure.**

1. **Install utility dependencies:**
   ```bash
   npm install clsx tailwind-merge
   ```

2. **Create `lib/utils.ts`:**
   ```typescript
   import { type ClassValue, clsx } from 'clsx'
   import { twMerge } from 'tailwind-merge'

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs))
   }
   ```

3. **Create `components/ui/button.tsx`:**
   ```typescript
   import { forwardRef, ButtonHTMLAttributes } from 'react'
   import { cn } from '@/lib/utils'

   interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
     variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
     size?: 'sm' | 'md' | 'lg'
     loading?: boolean
   }

   export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
     ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
       const variants = {
         primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
         secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100',
         ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800',
         danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
       }
       const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2', lg: 'px-6 py-3 text-lg' }

       return (
         <button
           ref={ref}
           className={cn(
             'rounded-lg font-medium transition-colors inline-flex items-center justify-center',
             'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
             'disabled:cursor-not-allowed',
             variants[variant], sizes[size], className
           )}
           disabled={disabled || loading}
           {...props}
         >
           {loading ? (
             <span className="flex items-center gap-2">
               <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
               </svg>
               Loading...
             </span>
           ) : children}
         </button>
       )
     }
   )
   Button.displayName = 'Button'
   ```

4. **Create `components/ui/input.tsx`:**
   ```typescript
   import { forwardRef, InputHTMLAttributes } from 'react'
   import { cn } from '@/lib/utils'

   interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
     label?: string
     error?: string
   }

   export const Input = forwardRef<HTMLInputElement, InputProps>(
     ({ className, label, error, id, ...props }, ref) => {
       const inputId = id || props.name
       return (
         <div className="space-y-1">
           {label && (
             <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
               {label}
             </label>
           )}
           <input
             ref={ref}
             id={inputId}
             className={cn(
               'block w-full rounded-lg border px-4 py-2',
               'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
               'text-gray-900 dark:text-white placeholder-gray-400',
               'focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
               error && 'border-red-500',
               className
             )}
             {...props}
           />
           {error && <p className="text-sm text-red-600">{error}</p>}
         </div>
       )
     }
   )
   Input.displayName = 'Input'
   ```

5. **Create `components/layout/header.tsx`:**
   ```typescript
   'use client'
   import Link from 'next/link'
   import { usePathname } from 'next/navigation'
   import { cn } from '@/lib/utils'

   interface HeaderProps {
     user: { email: string; role: string } | null
   }

   export function Header({ user }: HeaderProps) {
     const pathname = usePathname()
     const navItems = user ? [
       { href: '/library', label: 'Library' },
       { href: '/scan', label: 'Scan' },
       { href: '/settings', label: 'Settings' },
     ] : []

     return (
       <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex items-center justify-between h-16">
             <Link href={user ? '/library' : '/'} className="font-bold text-xl flex items-center gap-2">
               <span>📚</span>
               <span className="hidden sm:inline">Tome Tracker</span>
             </Link>
             <nav className="hidden sm:flex items-center gap-1">
               {navItems.map((item) => (
                 <Link
                   key={item.href}
                   href={item.href}
                   className={cn(
                     'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                     pathname.startsWith(item.href)
                       ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                       : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                   )}
                 >
                   {item.label}
                 </Link>
               ))}
             </nav>
             {!user && (
               <div className="flex items-center gap-4">
                 <Link href="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
                 <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Sign Up</Link>
               </div>
             )}
           </div>
         </div>
       </header>
     )
   }
   ```

6. **Create `components/layout/mobile-nav.tsx`:**
   ```typescript
   'use client'
   import Link from 'next/link'
   import { usePathname } from 'next/navigation'
   import { cn } from '@/lib/utils'

   const navItems = [
     { href: '/library', label: 'Library', icon: '📚' },
     { href: '/scan', label: 'Scan', icon: '📷' },
     { href: '/settings', label: 'Settings', icon: '⚙️' },
   ]

   export function MobileNav() {
     const pathname = usePathname()
     return (
       <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 sm:hidden z-50">
         <div className="flex justify-around">
           {navItems.map((item) => (
             <Link
               key={item.href}
               href={item.href}
               className={cn(
                 'flex flex-col items-center py-3 px-4 text-xs transition-colors',
                 pathname.startsWith(item.href)
                   ? 'text-blue-600 dark:text-blue-400'
                   : 'text-gray-600 dark:text-gray-400'
               )}
             >
               <span className="text-xl mb-1">{item.icon}</span>
               <span>{item.label}</span>
             </Link>
           ))}
         </div>
       </nav>
     )
   }
   ```

7. **Update `app/layout.tsx`:**
   ```typescript
   import { Inter } from 'next/font/google'
   import { Header } from '@/components/layout/header'
   import { MobileNav } from '@/components/layout/mobile-nav'
   import { getSession } from '@/lib/auth/session'
   import './globals.css'

   const inter = Inter({ subsets: ['latin'] })

   export default async function RootLayout({ children }: { children: React.ReactNode }) {
     const session = await getSession()
     const user = session ? { email: session.email, role: session.role } : null

     return (
       <html lang="en">
         <body className={inter.className}>
           <Header user={user} />
           <main className="min-h-screen pb-20 sm:pb-8">{children}</main>
           {user && <MobileNav />}
         </body>
       </html>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Layout renders with header and navigation
- Mobile bottom navigation shows on small screens
- Navigation highlights current route
- No TypeScript errors
```

---

## Prompt 16: Authentication Pages

```text
Create the login, registration, and password reset pages.

**TASK: Build the authentication UI pages with forms and validation.**

1. **Create `lib/hooks/useAuth.ts`:**
   ```typescript
   'use client'
   import { useState } from 'react'
   import { useRouter } from 'next/navigation'

   export function useAuth() {
     const router = useRouter()
     const [loading, setLoading] = useState(false)
     const [error, setError] = useState<string | null>(null)

     const register = async (email: string, password: string) => {
       setLoading(true)
       setError(null)
       try {
         const res = await fetch('/api/auth/register', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, password }),
         })
         const data = await res.json()
         if (!res.ok) { setError(data.message); return false }
         router.push('/library')
         router.refresh()
         return true
       } catch { setError('Network error'); return false }
       finally { setLoading(false) }
     }

     const login = async (email: string, password: string) => {
       setLoading(true)
       setError(null)
       try {
         const res = await fetch('/api/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, password }),
         })
         const data = await res.json()
         if (!res.ok) { setError(data.message); return false }
         const redirect = new URLSearchParams(window.location.search).get('redirect')
         router.push(redirect || '/library')
         router.refresh()
         return true
       } catch { setError('Network error'); return false }
       finally { setLoading(false) }
     }

     const logout = async () => {
       await fetch('/api/auth/logout', { method: 'POST' })
       router.push('/login')
       router.refresh()
     }

     return { loading, error, register, login, logout, clearError: () => setError(null) }
   }
   ```

2. **Create `app/(auth)/layout.tsx`:**
   ```typescript
   export default function AuthLayout({ children }: { children: React.ReactNode }) {
     return (
       <div className="min-h-screen flex items-center justify-center px-4 py-12">
         <div className="w-full max-w-md">{children}</div>
       </div>
     )
   }
   ```

3. **Create `app/(auth)/login/page.tsx`:**
   ```typescript
   'use client'
   import { useState } from 'react'
   import Link from 'next/link'
   import { useAuth } from '@/lib/hooks/useAuth'
   import { Button } from '@/components/ui/button'
   import { Input } from '@/components/ui/input'

   export default function LoginPage() {
     const { login, loading, error } = useAuth()
     const [email, setEmail] = useState('')
     const [password, setPassword] = useState('')

     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault()
       await login(email, password)
     }

     return (
       <div className="space-y-8">
         <div className="text-center">
           <h1 className="text-3xl font-bold">Welcome back</h1>
           <p className="text-gray-600 mt-2">Sign in to your library</p>
         </div>
         <form onSubmit={handleSubmit} className="space-y-6">
           {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>}
           <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
           <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
           <div className="text-right">
             <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
           </div>
           <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
         </form>
         <p className="text-center text-sm text-gray-600">
           Don't have an account? <Link href="/register" className="text-blue-600 hover:underline">Sign up</Link>
         </p>
       </div>
     )
   }
   ```

4. **Create `app/(auth)/register/page.tsx`:**
   ```typescript
   'use client'
   import { useState } from 'react'
   import Link from 'next/link'
   import { useAuth } from '@/lib/hooks/useAuth'
   import { Button } from '@/components/ui/button'
   import { Input } from '@/components/ui/input'

   export default function RegisterPage() {
     const { register, loading, error } = useAuth()
     const [email, setEmail] = useState('')
     const [password, setPassword] = useState('')
     const [confirmPassword, setConfirmPassword] = useState('')
     const [validationError, setValidationError] = useState('')

     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault()
       setValidationError('')
       if (password !== confirmPassword) { setValidationError('Passwords do not match'); return }
       if (password.length < 12) { setValidationError('Password must be at least 12 characters'); return }
       if (!/[0-9]/.test(password)) { setValidationError('Password must contain a number'); return }
       if (!/[^a-zA-Z0-9]/.test(password)) { setValidationError('Password must contain a symbol'); return }
       await register(email, password)
     }

     return (
       <div className="space-y-8">
         <div className="text-center">
           <h1 className="text-3xl font-bold">Create your account</h1>
           <p className="text-gray-600 mt-2">Start building your personal library</p>
         </div>
         <form onSubmit={handleSubmit} className="space-y-6">
           {(validationError || error) && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{validationError || error}</div>}
           <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
           <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
           <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
           <p className="text-xs text-gray-500">Password: 12+ chars, 1 number, 1 symbol</p>
           <Button type="submit" className="w-full" loading={loading}>Create account</Button>
         </form>
         <p className="text-center text-sm text-gray-600">
           Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
         </p>
       </div>
     )
   }
   ```

5. **Create `app/(auth)/forgot-password/page.tsx` and `app/(auth)/reset-password/page.tsx`** with similar patterns for password reset flow.

**SUCCESS CRITERIA:**
- Login/register pages work with validation
- Forms show loading and error states
- Password reset flow works end-to-end
```

---

## Prompt 17: Library List Page

```text
Create the main library page with author-centric view.

**TASK: Build the library listing page with author grouping.**

1. **Create `lib/hooks/useLibrary.ts`:**
   ```typescript
   'use client'
   import { useState, useEffect, useCallback } from 'react'

   export function useLibrary() {
     const [loading, setLoading] = useState(true)
     const [error, setError] = useState<string | null>(null)
     const [authors, setAuthors] = useState<any[]>([])
     const [stats, setStats] = useState<{ bookCount: number; authorCount: number } | null>(null)
     const [lastSynced, setLastSynced] = useState<string | null>(null)

     const sync = useCallback(async () => {
       setLoading(true)
       try {
         const res = await fetch('/api/library/sync')
         if (!res.ok) throw new Error('Failed to sync')
         const data = await res.json()
         setAuthors(data.authors)
         setStats(data.stats)
         setLastSynced(data.syncedAt)
         setError(null)
       } catch (e) {
         setError(e instanceof Error ? e.message : 'Unknown error')
       } finally {
         setLoading(false)
       }
     }, [])

     useEffect(() => { sync() }, [sync])

     return { loading, error, authors, stats, lastSynced, sync }
   }
   ```

2. **Create `components/library/author-card.tsx`:**
   ```typescript
   'use client'
   import { useState } from 'react'
   import Link from 'next/link'
   import { cn } from '@/lib/utils'

   export function AuthorCard({ author, groupBySeries }: { author: any; groupBySeries: boolean }) {
     const [expanded, setExpanded] = useState(false)

     return (
       <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
         <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
           <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">👤</div>
             <div className="text-left">
               <h3 className="font-medium">{author.name}</h3>
               <p className="text-sm text-gray-500">{author.books.length} books</p>
             </div>
           </div>
           <span className={cn('transition-transform text-gray-400', expanded && 'rotate-180')}>▼</span>
         </button>
         {expanded && (
           <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-2 mt-3">
             {author.books.map((book: any) => (
               <Link key={book.id} href={`/library/book/${book.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                 {book.coverUrl ? (
                   <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded" />
                 ) : (
                   <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center">📖</div>
                 )}
                 <div>
                   <p className="font-medium">{book.title}</p>
                   {book.seriesName && <p className="text-sm text-gray-500">{book.seriesName} #{book.seriesNumber}</p>}
                 </div>
               </Link>
             ))}
           </div>
         )}
       </div>
     )
   }
   ```

3. **Create `app/library/page.tsx`:**
   ```typescript
   'use client'
   import { useState } from 'react'
   import { useRouter } from 'next/navigation'
   import { useLibrary } from '@/lib/hooks/useLibrary'
   import { AuthorCard } from '@/components/library/author-card'
   import { Button } from '@/components/ui/button'
   import { Input } from '@/components/ui/input'

   export default function LibraryPage() {
     const router = useRouter()
     const { loading, error, authors, stats, sync } = useLibrary()
     const [search, setSearch] = useState('')
     const [groupBySeries, setGroupBySeries] = useState(false)

     const filteredAuthors = authors.filter(a =>
       a.name.toLowerCase().includes(search.toLowerCase()) ||
       a.books.some((b: any) => b.title.toLowerCase().includes(search.toLowerCase()))
     )

     if (loading && !authors.length) return <div className="text-center py-12">Loading...</div>
     if (error) return <div className="text-center py-12 text-red-600">{error}</div>

     return (
       <div className="max-w-4xl mx-auto px-4 py-6">
         <div className="flex justify-between items-center mb-6">
           <div>
             <h1 className="text-2xl font-bold">My Library</h1>
             {stats && <p className="text-gray-600">{stats.bookCount} books by {stats.authorCount} authors</p>}
           </div>
           <div className="flex gap-2">
             <Button onClick={() => router.push('/scan')} size="sm">📷 Scan</Button>
             <Button onClick={() => router.push('/library/add')} variant="secondary" size="sm">✏️ Add</Button>
           </div>
         </div>
         <Input type="search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
         <label className="flex items-center gap-2 mb-6 text-sm">
           <input type="checkbox" checked={groupBySeries} onChange={(e) => setGroupBySeries(e.target.checked)} />
           Group by series
         </label>
         {filteredAuthors.length === 0 ? (
           <div className="text-center py-12 text-gray-500">
             {search ? 'No matches' : 'Your library is empty'}
             {!search && <Button onClick={() => router.push('/scan')} className="mt-4">Scan your first book</Button>}
           </div>
         ) : (
           <div className="space-y-4">
             {filteredAuthors.map(author => <AuthorCard key={author.id} author={author} groupBySeries={groupBySeries} />)}
           </div>
         )}
       </div>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Library page displays authors with expandable book lists
- Search filters work
- Series grouping toggle works
- Empty state shows correctly
```

---

## Prompt 18: Book Detail Page

```text
Create the book detail page with editing capabilities.

**TASK: Build the book detail page with view and edit modes.**

1. **Create `lib/hooks/useBook.ts`:**
   ```typescript
   'use client'
   import { useState, useEffect, useCallback } from 'react'

   export function useBook(id: string) {
     const [book, setBook] = useState<any>(null)
     const [loading, setLoading] = useState(true)
     const [error, setError] = useState<string | null>(null)

     const fetchBook = useCallback(async () => {
       setLoading(true)
       try {
         const res = await fetch(`/api/books/${id}`)
         if (!res.ok) throw new Error(res.status === 404 ? 'Book not found' : 'Failed to load')
         const data = await res.json()
         setBook(data.book)
       } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
       finally { setLoading(false) }
     }, [id])

     useEffect(() => { fetchBook() }, [fetchBook])

     const updateBook = async (updates: any) => {
       const res = await fetch(`/api/books/${id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(updates),
       })
       if (!res.ok) return { success: false }
       const data = await res.json()
       setBook(data.book)
       return { success: true }
     }

     const deleteBook = async () => {
       const res = await fetch(`/api/books/${id}`, { method: 'DELETE' })
       return { success: res.ok }
     }

     return { book, loading, error, updateBook, deleteBook, refresh: fetchBook }
   }
   ```

2. **Create `app/library/book/[id]/page.tsx`:**
   ```typescript
   'use client'
   import { useState } from 'react'
   import { useRouter } from 'next/navigation'
   import { useBook } from '@/lib/hooks/useBook'
   import { Button } from '@/components/ui/button'
   import { Input } from '@/components/ui/input'

   export default function BookDetailPage({ params }: { params: { id: string } }) {
     const router = useRouter()
     const { book, loading, error, updateBook, deleteBook } = useBook(params.id)
     const [editing, setEditing] = useState(false)
     const [saving, setSaving] = useState(false)
     const [confirmDelete, setConfirmDelete] = useState(false)
     const [form, setForm] = useState({ title: '', authorName: '', seriesName: '', seriesNumber: '', publisher: '', publicationYear: '', tags: '' })

     const startEditing = () => {
       if (book) {
         setForm({
           title: book.title,
           authorName: book.author.name,
           seriesName: book.seriesName || '',
           seriesNumber: book.seriesNumber?.toString() || '',
           publisher: book.publisher || '',
           publicationYear: book.publicationYear?.toString() || '',
           tags: book.tags.join(', '),
         })
         setEditing(true)
       }
     }

     const handleSave = async () => {
       setSaving(true)
       const result = await updateBook({
         title: form.title,
         authorName: form.authorName,
         seriesName: form.seriesName || null,
         seriesNumber: form.seriesNumber ? parseFloat(form.seriesNumber) : null,
         publisher: form.publisher || null,
         publicationYear: form.publicationYear ? parseInt(form.publicationYear) : null,
         tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
       })
       setSaving(false)
       if (result.success) setEditing(false)
     }

     const handleDelete = async () => {
       const result = await deleteBook()
       if (result.success) router.push('/library')
     }

     if (loading) return <div className="text-center py-12">Loading...</div>
     if (error || !book) return <div className="text-center py-12 text-red-600">{error || 'Not found'}</div>

     return (
       <div className="max-w-2xl mx-auto px-4 py-6">
         <button onClick={() => router.push('/library')} className="text-blue-600 hover:underline mb-4">← Back</button>
         <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
           <div className="flex gap-6 mb-6">
             {book.coverUrl ? <img src={book.coverUrl} alt={book.title} className="w-32 h-48 object-cover rounded" /> : <div className="w-32 h-48 bg-gray-200 rounded flex items-center justify-center text-4xl">📖</div>}
             <div>
               {editing ? (
                 <div className="space-y-3">
                   <Input label="Title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
                   <Input label="Author" value={form.authorName} onChange={(e) => setForm(f => ({ ...f, authorName: e.target.value }))} />
                 </div>
               ) : (
                 <>
                   <h1 className="text-2xl font-bold">{book.title}</h1>
                   <p className="text-lg text-gray-600">by {book.author.name}</p>
                   {book.seriesName && <p className="text-sm text-gray-500 mt-2">📚 {book.seriesName} #{book.seriesNumber}</p>}
                 </>
               )}
             </div>
           </div>
           {editing ? (
             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <Input label="Series" value={form.seriesName} onChange={(e) => setForm(f => ({ ...f, seriesName: e.target.value }))} />
                 <Input label="Series #" type="number" value={form.seriesNumber} onChange={(e) => setForm(f => ({ ...f, seriesNumber: e.target.value }))} />
                 <Input label="Publisher" value={form.publisher} onChange={(e) => setForm(f => ({ ...f, publisher: e.target.value }))} />
                 <Input label="Year" type="number" value={form.publicationYear} onChange={(e) => setForm(f => ({ ...f, publicationYear: e.target.value }))} />
               </div>
               <Input label="Tags" value={form.tags} onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))} />
             </div>
           ) : (
             <dl className="grid grid-cols-2 gap-4 text-sm">
               {book.isbn13 && <><dt className="text-gray-500">ISBN-13</dt><dd className="font-mono">{book.isbn13}</dd></>}
               {book.publisher && <><dt className="text-gray-500">Publisher</dt><dd>{book.publisher}</dd></>}
               {book.publicationYear && <><dt className="text-gray-500">Year</dt><dd>{book.publicationYear}</dd></>}
               <dt className="text-gray-500">Source</dt><dd className="capitalize">{book.source.toLowerCase()}</dd>
             </dl>
           )}
           <div className="mt-6 pt-4 border-t flex gap-3">
             {editing ? (
               <>
                 <Button onClick={handleSave} loading={saving}>Save</Button>
                 <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
               </>
             ) : (
               <>
                 <Button onClick={startEditing}>Edit</Button>
                 <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
               </>
             )}
           </div>
         </div>
         {confirmDelete && (
           <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
             <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md">
               <h2 className="text-xl font-bold mb-4">Delete book?</h2>
               <p className="text-gray-600 mb-6">This cannot be undone.</p>
               <div className="flex gap-3 justify-end">
                 <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                 <Button variant="danger" onClick={handleDelete}>Delete</Button>
               </div>
             </div>
           </div>
         )}
       </div>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Book detail displays all information
- Edit mode works for all fields
- Delete with confirmation works
- Navigation works correctly
```

---

## Prompt 19: Barcode Scanner Component

```text
Create the barcode scanning component using ZXing-js.

**TASK: Build the camera-based barcode scanner.**

1. **Install:** `npm install @zxing/library`

2. **Create `components/scanner/barcode-scanner.tsx`:**
   ```typescript
   'use client'
   import { useEffect, useRef, useState, useCallback } from 'react'
   import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'

   export function BarcodeScanner({ onScan, active }: { onScan: (code: string) => void; active: boolean }) {
     const videoRef = useRef<HTMLVideoElement>(null)
     const readerRef = useRef<BrowserMultiFormatReader | null>(null)
     const [hasPermission, setHasPermission] = useState<boolean | null>(null)
     const lastCodeRef = useRef<string>('')
     const lastTimeRef = useRef<number>(0)

     const handleScan = useCallback((code: string) => {
       const now = Date.now()
       if (code === lastCodeRef.current && now - lastTimeRef.current < 3000) return
       lastCodeRef.current = code
       lastTimeRef.current = now
       onScan(code)
     }, [onScan])

     useEffect(() => {
       if (!active) { readerRef.current?.reset(); return }
       
       const reader = new BrowserMultiFormatReader()
       readerRef.current = reader
       
       reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, error) => {
         if (result) handleScan(result.getText())
         if (error && !(error instanceof NotFoundException)) console.error(error)
       }).then(() => setHasPermission(true)).catch(() => setHasPermission(false))

       return () => reader.reset()
     }, [active, handleScan])

     if (hasPermission === false) {
       return <div className="aspect-[3/4] bg-gray-900 rounded-lg flex items-center justify-center text-white text-center p-6">
         <div><p className="text-4xl mb-4">📷</p><p>Camera access required</p></div>
       </div>
     }

     return (
       <div className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden">
         <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className="w-64 h-32 border-2 border-white/50 rounded-lg" />
         </div>
         <div className="absolute bottom-4 left-0 right-0 text-center">
           <p className="text-white/80 text-sm bg-black/50 inline-block px-4 py-2 rounded-full">Position barcode in frame</p>
         </div>
       </div>
     )
   }
   ```

3. **Create `components/scanner/scan-result.tsx`:**
   ```typescript
   'use client'
   import { Button } from '@/components/ui/button'

   export function ScanResult({ loading, result, error, onAdd, onViewBook, onScanAgain, existingBookId }: any) {
     if (loading) return <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center"><div className="animate-spin text-4xl mb-4">🔍</div><p>Looking up...</p></div>
     if (error) return <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center"><p className="text-red-600 mb-4">{error}</p><Button onClick={onScanAgain}>Scan again</Button></div>
     if (!result) return null
     if (!result.isIsbn) return <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center"><p className="text-yellow-600 mb-4">Not a book barcode</p><Button onClick={onScanAgain}>Scan again</Button></div>
     if (result.owned) return <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center"><p className="text-green-600 text-lg mb-4">✓ You own this!</p><div className="flex gap-3 justify-center"><Button onClick={() => onViewBook(existingBookId)}>View</Button><Button variant="secondary" onClick={onScanAgain}>Scan another</Button></div></div>
     if (!result.metadata) return <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center"><p className="text-yellow-600 mb-4">Not found in database</p><Button onClick={onScanAgain}>Scan again</Button></div>
     
     return (
       <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
         <div className="p-6 flex gap-4">
           {result.metadata.coverUrl ? <img src={result.metadata.coverUrl} className="w-24 h-36 object-cover rounded" /> : <div className="w-24 h-36 bg-gray-200 rounded flex items-center justify-center text-3xl">📖</div>}
           <div><h3 className="font-bold text-lg">{result.metadata.title}</h3><p className="text-gray-600">{result.metadata.authors.join(', ')}</p></div>
         </div>
         <div className="px-6 pb-6 flex gap-3"><Button onClick={onAdd} className="flex-1">Add to library</Button><Button variant="secondary" onClick={onScanAgain}>Cancel</Button></div>
       </div>
     )
   }
   ```

**SUCCESS CRITERIA:**
- Camera activates and scans barcodes
- Debounces duplicate scans
- Shows appropriate states for all outcomes
```

---

## Prompt 20-22: Scan Page, Manual Add, and Online Search

These prompts create:
- **Prompt 20:** `app/scan/page.tsx` - Full scan flow integrating scanner with lookup and add
- **Prompt 21:** `app/library/add/page.tsx` - Manual add form with fuzzy duplicate detection
- **Prompt 22:** `app/library/search/page.tsx` - Online search with add functionality

Each follows the same patterns established above with proper state management, API integration, and error handling.

**Key files:**
- `lib/books/fuzzy-match.ts` - Title similarity for duplicate detection
- `app/api/books/check-duplicate/route.ts` - Duplicate check endpoint

---

## End of Phase 5 & 6

Continue with **Phase 7: Import System** (Prompts 23-26).

