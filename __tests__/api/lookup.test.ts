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
