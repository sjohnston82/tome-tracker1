import { MANAGEMENT_DATASET, readManagementState, seriesNameKey } from '@/lib/series/management-state';
import { createHash } from 'node:crypto';
import { collectionManifestSchema } from '@/lib/import/collection-validation';
import { planCollectionImport, type ImportIssue } from '@/lib/import/collection-plan';
import { jsonObject, PREVIEW_DATASET, readReviewDecisions } from './decisions';
import type { ReviewItem, ReviewQueue } from './types';
export type ReviewBook = { id: string; title: string; author: { name: string }; publicationYear: number | null; readingStatus: string; coverUrl: string | null; coverLocked: boolean; isbn13: string | null; isbn10: string | null; importKey: string | null; updatedAt: string; workId: string | null; contents: { workId: string }[]; readingSessions: { id: string }[] };
export type ReviewWork = { id: string; title: string; authorName: string; publicationYear: number | null; importKey: string | null; updatedAt: string };
export type ReviewEntry = { id: string; workId: string; position: string | null; entryType: string; isConfirmed: boolean; series: { id: string; name: string } };
export type ReviewImport = { id: string; dataset: string; manifest: unknown; report: unknown; updatedAt: string };
export type ReviewSnapshot = { books: ReviewBook[]; works: ReviewWork[]; entries: ReviewEntry[]; imports: ReviewImport[] };
export type Target = { kind: 'book' | 'work' | 'entry' | 'import'; id: string; field?: 'publicationYear' | 'readingStatus'; value?: number | string | null; position?: string | null; entryType?: string; importId?: string; sourceKey?: string; pinKind?: 'book' | 'work' };
export type BuiltItem = ReviewItem & { target: Target };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const show = (value: unknown) => value === null || value === undefined ? 'Unknown' : String(value);
const status = (value: string) => ({ READ: 'Read', UNREAD: 'Unread', READING: 'Currently reading', UNKNOWN: 'Unknown' }[value] ?? value);
export function buildReviewQueue(snapshot: ReviewSnapshot): Omit<ReviewQueue, 'items'> & { items: BuiltItem[] } {
  const items: BuiltItem[] = [];
  const books = new Map(snapshot.books.map(book => [book.id, book]));
  const works = new Map(snapshot.works.map(work => [work.id, work]));
  const management = readManagementState(snapshot.imports.find(row => row.dataset === MANAGEMENT_DATASET)?.report);
  const sourceEntry = (workId: string, name: string) => { const target = management.redirects.find(item => seriesNameKey(item.name) === seriesNameKey(name))?.targetId; const group = management.groups.find(item => item.seriesId === target && item.mode === 'combined' && item.workIds.includes(workId)); return snapshot.entries.find(entry => entry.workId === (group?.primaryWorkId ?? workId) && (target ? entry.series.id === target : entry.series.name === name)); };
  const workOwned = new Set(snapshot.books.flatMap(book => [book.workId, ...book.contents.map(content => content.workId)].filter((id): id is string => !!id)));
  for (const group of management.groups) if (group.mode === 'combined' && group.workIds.some(id => workOwned.has(id))) for (const id of group.workIds) workOwned.add(id);
  const preview = snapshot.imports.find(row => row.dataset === PREVIEW_DATASET && jsonObject(row.report).applied !== true);
  const record = preview ?? snapshot.imports.find(row => row.dataset === 'tome-collection');
  const decisions = readReviewDecisions(record?.report);
  const add = (key: string, value: Omit<ReviewItem, 'id' | 'version' | 'fingerprint' | 'resolved'>, target: Target, stamp: unknown, meaning: unknown) => {
    const id = digest(key), fingerprint = digest(meaning), resolved = !!target.importId && decisions[id]?.state === 'reviewed' && decisions[id]?.fingerprint === fingerprint;
    items.push({ ...value, id, fingerprint, version: digest([fingerprint, stamp]), resolved, actions: resolved ? ['reopen'] : value.actions, target });
  };
  const base = { category: 'missing' as const, proposed: null, source: null, resolved: false, blocking: false, candidates: [] };
  for (const book of snapshot.books) {
    const common = { ...base, title: book.title, author: book.author.name, ownership: 'Owned physical copy', href: `/library/book/${book.id}`, linkLabel: 'Open book' };
    if (!book.isbn13 && !book.isbn10) add(`book:${book.id}:isbn`, { ...common, code: 'MISSING_ISBN', message: 'No ISBN is recorded. Scan this physical copy to link the correct edition.', current: 'No ISBN recorded', href: '/scan', linkLabel: 'Scan or link ISBN', actions: [] }, { kind: 'book', id: book.id }, book.updatedAt, ['isbn', null]);
    if (!book.coverUrl && !book.coverLocked) add(`book:${book.id}:cover`, { ...common, code: 'MISSING_COVER', message: 'No cover is saved. Choose artwork from the book’s cover picker.', current: 'No cover saved', actions: [] }, { kind: 'book', id: book.id }, book.updatedAt, ['cover', null]);
    if (book.publicationYear === null) add(`book:${book.id}:year`, { ...common, code: 'MISSING_YEAR', message: 'The recorded publication year is unknown. Enter a year only after checking it.', current: 'Unknown', actions: ['year'] }, { kind: 'book', id: book.id, field: 'publicationYear' }, book.updatedAt, ['year', null]);
  }
  for (const work of snapshot.works) if (work.publicationYear === null) add(`work:${work.id}:year`, { ...base, title: work.title, author: work.authorName, ownership: workOwned.has(work.id) ? 'Work in an owned copy' : 'Series work — not an owned physical book', href: '/series', linkLabel: 'Open series', code: 'MISSING_WORK_YEAR', message: 'Work publication year is unknown. Forthcoming information must be verified manually.', current: 'Unknown', actions: ['year'] }, { kind: 'work', id: work.id, field: 'publicationYear' }, work.updatedAt, ['work-year', null]);
  for (const entry of snapshot.entries) {
    const work = works.get(entry.workId); if (!work || entry.isConfirmed) continue;
    add(`entry:${entry.id}:confirm`, { ...base, category: 'series', title: work.title, author: work.authorName, ownership: workOwned.has(work.id) ? 'Work in an owned copy' : 'Series work — not an owned physical book', code: 'UNCONFIRMED_ORDER', current: `${entry.series.name}: position ${show(entry.position)} · ${entry.entryType}`, message: entry.position === null ? 'No order is recorded. Open the series to set and verify its position.' : 'Check this series position and entry type before confirming them.', href: '/series', linkLabel: 'Open series', actions: entry.position === null ? [] : ['confirm'] }, { kind: 'entry', id: entry.id }, [entry, work.updatedAt], ['entry', entry.position, entry.entryType]);
  }
  if (record) {
    const parsed = collectionManifestSchema.safeParse(record.manifest);
    if (!parsed.success) {
      add('import:invalid', { ...base, category: 'conflict', code: 'INVALID_SAVED_IMPORT', title: 'Saved import needs attention', author: '', current: 'The saved manifest could not be validated', message: 'Upload a valid collection manifest in Series. Your existing library has not been changed.', ownership: 'Import report', href: '/series', linkLabel: 'Open collection import', actions: [] }, { kind: 'import', id: record.id }, record.updatedAt, ['invalid', record.updatedAt]);
    } else {
      const manifest = parsed.data;
      const plan = planCollectionImport(manifest, snapshot.books, snapshot.works);
      type Issue = ImportIssue & { title?: string; seriesName?: string };
      const sourceEntries = manifest.series.flatMap(series => series.entries.map(entry => ({ ...entry, seriesName: series.name })));
      const issues: Issue[] = [...plan.issues];
      for (const source of sourceEntries) {
        const work = snapshot.works.find(work => work.importKey === source.sourceKey);
        const entry = work && sourceEntry(work.id, source.seriesName);
        if (entry && ((entry.position === null ? source.position !== null : source.position === null || Number(entry.position) !== source.position) || entry.entryType !== source.entryType)) issues.push({ code: 'ORDER_CONFLICT', sourceKey: source.sourceKey, seriesName: source.seriesName, message: 'The library and checklist record different series ordering or entry types.' });
      }
      const seen = new Set<string>();
      for (const issue of issues) {
        const key = `import:${issue.code}:${issue.sourceKey}:${issue.seriesName ?? ''}`;
        if (seen.has(key)) continue; seen.add(key);
        const sourceBook = manifest.books.find(book => book.sourceKey === issue.sourceKey);
        const sourceWork = sourceEntries.find(work => work.sourceKey === issue.sourceKey && (!issue.seriesName || work.seriesName === issue.seriesName));
        const bookAction = plan.bookActions.find(action => action.source.sourceKey === issue.sourceKey);
        const workAction = plan.workActions.find(action => action.source.sourceKey === issue.sourceKey);
        const book = bookAction?.existingId ? books.get(bookAction.existingId) : undefined;
        const work = workAction?.existingId ? works.get(workAction.existingId) : undefined;
        const entry = work && issue.seriesName ? sourceEntry(work.id, issue.seriesName) : undefined;
        const source = sourceBook ?? sourceWork;
        const candidates = (issue.candidateIds ?? (issue.code === 'READING_CONFLICT' && issue.blocking && book && !book.importKey ? [book.id] : [])).flatMap(id => {
          const book = books.get(id), work = works.get(id);
          return book ? [{ id, title: book.title, author: book.author.name }] : work ? [{ id, title: work.title, author: work.authorName }] : [];
        });
        const target: Target = { kind: book ? 'book' : work ? 'work' : 'import', id: book?.id ?? work?.id ?? record.id, importId: record.id, sourceKey: issue.sourceKey };
        let current = book ? `Library status: ${status(book.readingStatus)} · recorded year: ${show(book.publicationYear)}` : work ? `Library work year: ${show(work.publicationYear)}` : 'No unique library record selected';
        let proposed: string | null = null;
        const actions: ReviewItem['actions'] = issue.blocking ? [] : ['keep'];
        if (issue.code === 'PUBLICATION_CONFLICT' && source && (book || work)) {
          target.field = 'publicationYear'; target.value = source.publicationYear;
          current = show((book ?? work)!.publicationYear); proposed = show(source.publicationYear); actions.push('year');
          if (source.publicationYear !== null) actions.push('source');
        } else if (issue.code === 'READING_CONFLICT' && book && sourceBook) {
          target.field = 'readingStatus'; target.value = sourceBook.readingStatus;
          current = status(book.readingStatus); proposed = status(sourceBook.readingStatus);
          if (!book.readingSessions.length) actions.push('source');
        } else if (issue.code === 'ORDER_CONFLICT' && entry && sourceWork) {
          target.kind = 'entry'; target.id = entry.id; target.position = sourceWork.position === null ? null : String(sourceWork.position); target.entryType = sourceWork.entryType;
          current = `Position ${show(entry.position)} · ${entry.entryType}`; proposed = `Position ${show(sourceWork.position)} · ${sourceWork.entryType}`;
          if (sourceWork.position !== null) actions.push('source');
        }
        if ((['AMBIGUOUS_EDITION', 'AMBIGUOUS_WORK'].includes(issue.code) || (issue.code === 'READING_CONFLICT' && issue.blocking)) && candidates.length) {
          target.pinKind = issue.code === 'AMBIGUOUS_WORK' ? 'work' : 'book'; actions.push('pin');
        }
        add(key, { ...base, category: ['AMBIGUOUS_EDITION', 'AMBIGUOUS_WORK', 'IDENTITY_CONFLICT'].includes(issue.code) ? 'edition' : 'conflict', code: issue.code, title: book?.title ?? work?.title ?? source?.title ?? issue.title ?? 'Import question', author: book?.author.name ?? work?.authorName ?? source?.authorName ?? '', current, proposed, source: source ? `${source.source.file}${source.source.sheet ? ` · ${source.source.sheet}` : ''} · row ${source.source.row}${issue.seriesName ? ` · ${issue.seriesName}` : ''}` : issue.seriesName ?? null, message: issue.message + (issue.code === 'READING_CONFLICT' && book?.readingSessions.length ? ' An active reading session exists; open the book to review progress before changing its status.' : ''), ownership: book ? 'Owned physical copy' : 'Checklist or work metadata — ownership is not changed here', href: book ? `/library/book/${book.id}` : '/series', linkLabel: book ? 'Open book' : 'Open series/import', blocking: !!issue.blocking, actions, candidates }, target, [record.updatedAt, book?.updatedAt, work?.updatedAt, entry, candidates.map(candidate => books.get(candidate.id)?.updatedAt ?? works.get(candidate.id)?.updatedAt)], [issue.code, issue.sourceKey, issue.seriesName, current, proposed, issue.message, source?.publicationYear, sourceWork?.sourceOwnership, book?.title, book?.author.name, work?.title, work?.authorName]);
      }
    }
  }
  items.sort((a, b) => Number(b.blocking) - Number(a.blocking) || ['conflict', 'edition', 'series', 'missing'].indexOf(a.category) - ['conflict', 'edition', 'series', 'missing'].indexOf(b.category) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const categories = { conflict: 0, edition: 0, series: 0, missing: 0 };
  for (const item of items) if (!item.resolved) categories[item.category]++;
  return { items, pendingImport: !!preview, summary: { open: items.filter(item => !item.resolved).length, reviewed: items.filter(item => item.resolved).length, categories } };
}
export function publicReviewQueue(queue: ReturnType<typeof buildReviewQueue>): ReviewQueue { return { ...queue, items: queue.items.map(({ target: _target, ...item }) => item) }; }
