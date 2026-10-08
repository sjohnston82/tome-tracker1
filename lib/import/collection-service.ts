import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { collectionManifestSchema, type CollectionManifest } from './collection-validation'
import { planCollectionImport } from './collection-plan'

async function preview(client: Prisma.TransactionClient, userId: string, manifest: CollectionManifest) {
  const [books, works] = await Promise.all([
    client.book.findMany({ where: { userId }, include: { author: { select: { name: true } } } }),
    client.work.findMany({ where: { userId } }),
  ])
  return planCollectionImport(manifest, books, works)
}

export async function previewCollectionImport(userId: string, input: unknown) {
  const manifest = collectionManifestSchema.parse(input)
  const plan = await preview(prisma, userId, manifest)
  return { ready: plan.ready, summary: plan.summary, issues: plan.issues }
}

export async function applyCollectionImport(userId: string, input: unknown) {
  const manifest = collectionManifestSchema.parse(input)
  // A single serializable transaction protects reruns and simultaneous imports.
  // Never update existing metadata or delete existing records.
  return prisma.$transaction(async tx => {
    const plan = await preview(tx, userId, manifest)
    if (!plan.ready) return { applied: false, ready: false, summary: plan.summary, issues: plan.issues }
    const bookIds = new Map<string, string>()
    const workIds = new Map<string, string>()
    for (const action of plan.bookActions) {
      let id = action.existingId
      if (id) {
        await tx.book.update({ where: { id, userId }, data: { importKey: action.source.sourceKey } })
      } else {
        const author = await tx.author.upsert({ where: { userId_name: { userId, name: action.source.authorName } }, update: {}, create: { userId, name: action.source.authorName } })
        const book = await tx.book.create({ data: { userId, authorId: author.id, title: action.source.title, seriesName: action.source.seriesName, publicationYear: action.source.publicationYear, readingStatus: action.source.readingStatus, importKey: action.source.sourceKey, source: 'IMPORT' } })
        id = book.id
      }
      bookIds.set(action.source.sourceKey, id)
    }
    for (const action of plan.workActions) {
      let id = action.existingId
      if (id) await tx.work.update({ where: { id, userId }, data: { importKey: action.source.sourceKey } })
      else {
        const work = await tx.work.create({ data: { userId, title: action.source.title, authorName: action.source.authorName, publicationYear: action.source.publicationYear, importKey: action.source.sourceKey } })
        id = work.id
      }
      workIds.set(action.source.sourceKey, id)
    }
    for (const source of manifest.series) {
      const series = await tx.series.upsert({ where: { userId_name: { userId, name: source.name } }, update: {}, create: { userId, name: source.name, externalSource: 'collection-checklist', externalId: source.sourceKey } })
      for (const entry of source.entries) {
        const workId = workIds.get(entry.sourceKey)!
        const existing = await tx.seriesEntry.findUnique({ where: { seriesId_workId: { seriesId: series.id, workId } } })
        if (!existing) await tx.seriesEntry.create({ data: { seriesId: series.id, workId, position: entry.position, entryType: entry.entryType, isConfirmed: false } })
        else if (String(existing.position) !== String(entry.position) || existing.entryType !== entry.entryType) plan.issues.push({ code: 'ORDER_CONFLICT', sourceKey: entry.sourceKey, message: `${source.name}: existing order/type preserved.` })
        for (const bookKey of entry.ownedSourceKeys) {
          await tx.bookContent.upsert({ where: { bookId_workId: { bookId: bookIds.get(bookKey)!, workId } }, update: {}, create: { bookId: bookIds.get(bookKey)!, workId } })
        }
      }
    }
    const imported = await tx.book.findMany({ where: { userId, importKey: { in: manifest.books.map(b => b.sourceKey) } }, select: { id: true, readingStatus: true } })
    if (imported.length !== manifest.expected.owned) throw new Error('Imported physical count did not reconcile')
    const actualStatuses = { UNKNOWN: 0, UNREAD: 0, READING: 0, READ: 0 }
    for (const book of imported) actualStatuses[book.readingStatus]++
    const reconciled = Object.keys(actualStatuses).every(k => actualStatuses[k as keyof typeof actualStatuses] === manifest.expected.statuses[k as keyof typeof actualStatuses])
    const report = { applied: true, ready: true, summary: plan.summary, actualOwned: imported.length, actualStatuses, reconciled, issues: plan.issues }
    await tx.collectionImport.upsert({ where: { userId_dataset: { userId, dataset: manifest.dataset } }, update: { manifest: manifest as Prisma.InputJsonValue, report: report as Prisma.InputJsonValue }, create: { userId, dataset: manifest.dataset, manifest: manifest as Prisma.InputJsonValue, report: report as Prisma.InputJsonValue } })
    return report
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000, maxWait: 10000 })
}
