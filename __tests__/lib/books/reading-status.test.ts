import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({
  book: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  work: { findFirst: vi.fn() },
  author: { upsert: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: db }))

import { updateBook } from '@/lib/books/service'
import { updateBookSchema } from '@/lib/books/validation'

const workId = '11111111-1111-4111-8111-111111111111'

describe('book reading status and work ownership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts known reading statuses and rejects unknown statuses', () => {
    expect(updateBookSchema.safeParse({ readingStatus: 'READ' }).success).toBe(true)
    expect(updateBookSchema.safeParse({ readingStatus: 'READING' }).success).toBe(true)
    expect(updateBookSchema.safeParse({ readingStatus: 'finished' }).success).toBe(false)
  })

  it('does not link a book to another user\'s work', async () => {
    db.book.findFirst.mockResolvedValue({ id: 'book-1', userId: 'owner', authorId: 'author-1', isbn13: null })
    db.work.findFirst.mockResolvedValue(null)
    const result = await updateBook('owner', 'book-1', { workId, authorName: 'Changed author' })
    expect(result.error).toBe('WORK_NOT_FOUND')
    expect(db.work.findFirst).toHaveBeenCalledWith({
      where: { id: workId, userId: 'owner' },
      select: { id: true },
    })
    expect(db.book.update).not.toHaveBeenCalled()
    expect(db.author.upsert).not.toHaveBeenCalled()
  })

  it('persists a valid reading status', async () => {
    db.book.findFirst.mockResolvedValue({ id: 'book-1', userId: 'owner', authorId: 'author-1', isbn13: null })
    db.book.update.mockResolvedValue({ id: 'book-1', readingStatus: 'READ' })
    const result = await updateBook('owner', 'book-1', { readingStatus: 'READ' })
    expect(result.success).toBe(true)
    expect(db.book.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ readingStatus: 'READ' }),
    }))
  })
})
