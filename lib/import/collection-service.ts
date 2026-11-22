import { MANAGEMENT_DATASET, readManagementState, seriesNameKey } from '@/lib/series/management-state'
import { OWNERSHIP_DATASET, readOwnershipExclusions } from '@/lib/series/ownership-decisions'
import { jsonObject, PREVIEW_DATASET, mergeReviewDecisions } from '@/lib/review/decisions'
import { retryTransaction } from '@/lib/transaction-retry'
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

// Retain the preview as a staging record, without changing books or works.
// This makes ambiguous source matches available in the central review queue.
export async function stageCollectionPreview(userId: string, input: unknown) {
  const manifest = collectionManifestSchema.parse(input)
  return retryTransaction(() => prisma.$transaction(async tx => {
    const plan = await preview(tx, userId, manifest)
    const previous = await tx.collectionImport.findMany({ where: { userId, dataset: { in: ['tome-collection', PREVIEW_DATASET] } } })
    const decisions = mergeReviewDecisions(...previous.map(row => row.report))
    const report = { applied: false, ready: plan.ready, summary: plan.summary, issues: plan.issues, _metadataReview: decisions }
    await tx.collectionImport.upsert({ where: { userId_dataset: { userId, dataset: PREVIEW_DATASET } }, update: { manifest: manifest as Prisma.InputJsonValue, report: report as Prisma.InputJsonValue }, create: { userId, dataset: PREVIEW_DATASET, manifest: manifest as Prisma.InputJsonValue, report: report as Prisma.InputJsonValue } })
    return report
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }))
}

export async function applyCollectionImport(userId: string, input: unknown) {
  const manifest = collectionManifestSchema.parse(input)
  // A single serializable transaction protects reruns and simultaneous imports.
  // Never update existing metadata or delete existing records.
  return retryTransaction(() => prisma.$transaction(async tx => {
    const plan = await preview(tx, userId, manifest)
    if (!plan.ready) return { applied: false, ready: false, summary: plan.summary, issues: plan.issues }
    const ownershipRow = await tx.collectionImport.findUnique({ where: { userId_dataset: { userId, dataset: OWNERSHIP_DATASET } }, select: { report: true } })
    const managementRow = await tx.collectionImport.findUnique({ where: { userId_dataset: { userId, dataset: MANAGEMENT_DATASET } }, select: { report: true } })
    const management = readManagementState(managementRow?.report)
    const rejectedOwnership = ownershipRow ? readOwnershipExclusions(ownershipRow.report) : []
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
      const redirect = management.redirects.find(item => seriesNameKey(item.name) === seriesNameKey(source.name))
      const redirectedSeries = redirect ? await tx.series.findFirst({ where: { id: redirect.targetId, userId } }) : null
      if (redirect && !redirectedSeries) throw new Error('A merged series target is missing; repair the catalog before reimporting.')
      const series = redirectedSeries ?? await tx.series.upsert({ where: { userId_name: { userId, name: source.name } }, update: {}, create: { userId, name: source.name, externalSource: 'collection-checklist', externalId: source.sourceKey } })
      for (const entry of source.entries) {
        const originalWorkId = workIds.get(entry.sourceKey)!
        const mergedGroup = management.groups.find(group => group.seriesId === series.id && group.mode === 'combined' && group.workIds.includes(originalWorkId))
        const workId = mergedGroup?.primaryWorkId ?? originalWorkId
        const existing = await tx.seriesEntry.findUnique({ where: { seriesId_workId: { seriesId: series.id, workId } } })
        if (!existing) await tx.seriesEntry.create({ data: { seriesId: series.id, workId, position: entry.position, entryType: entry.entryType, isConfirmed: false } })
        else if (String(existing.position) !== String(entry.position) || existing.entryType !== entry.entryType) plan.issues.push({ code: 'ORDER_CONFLICT', sourceKey: entry.sourceKey, message: `${source.name}: existing order/type preserved.` })
        for (const bookKey of entry.ownedSourceKeys) {
          if (rejectedOwnership.some(pair => (mergedGroup?.workIds ?? [originalWorkId]).includes(pair.workId) && pair.bookId === bookIds.get(bookKey))) {
            plan.issues.push({ code: 'OWNERSHIP_REJECTED', sourceKey: entry.sourceKey, message: 'Your rejected ownership link was preserved; the physical copy remains in your library.' })
            continue
          }
          await tx.bookContent.upsert({ where: { bookId_workId: { bookId: bookIds.get(bookKey)!, workId: originalWorkId } }, update: {}, create: { bookId: bookIds.get(bookKey)!, workId: originalWorkId } })
        }
      }
    }
    const imported = await tx.book.findMany({ where: { userId, importKey: { in: manifest.books.map(b => b.sourceKey) } }, select: { id: true, readingStatus: true } })
    if (imported.length !== manifest.expected.owned) throw new Error('Imported physical count did not reconcile')
    const actualStatuses = { UNKNOWN: 0, UNREAD: 0, READING: 0, READ: 0 }
    for (const book of imported) actualStatuses[book.readingStatus]++
    const reconciled = Object.keys(actualStatuses).every(k => actualStatuses[k as keyof typeof actualStatuses] === manifest.expected.statuses[k as keyof typeof actualStatuses])
    const previous = await tx.collectionImport.findMany({ where: { userId, dataset: { in: ['tome-collection', PREVIEW_DATASET] } } })
    const decisions = mergeReviewDecisions(...previous.map(row => row.report))
    const report = { _metadataReview: decisions, applied: true, ready: true, summary: plan.summary, actualOwned: imported.length, actualStatuses, reconciled, issues: plan.issues }
    await tx.collectionImport.upsert({ where: { userId_dataset: { userId, dataset: manifest.dataset } }, update: { manifest: manifest as Prisma.InputJsonValue, report: report as Prisma.InputJsonValue }, create: { userId, dataset: manifest.dataset, manifest: manifest as Prisma.InputJsonValue, report: report as Prisma.InputJsonValue } })
    const staged = previous.find(row => row.dataset === PREVIEW_DATASET)
    const stagedManifest = staged && collectionManifestSchema.safeParse(staged.manifest)
    if (staged && stagedManifest?.success && JSON.stringify(stagedManifest.data.sourceHashes) === JSON.stringify(manifest.sourceHashes)) await tx.collectionImport.update({ where: { id: staged.id }, data: { report: { ...jsonObject(staged.report), applied: true, _metadataReview: decisions } as Prisma.InputJsonValue } })
    return report
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000, maxWait: 10000 }))
}
