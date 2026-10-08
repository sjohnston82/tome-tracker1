# Repeatable collection import

The XLSX master defines physical ownership and reading status. DOCX checklists define literary works and series entries; their ownership labels never create physical books. The extractor uses Python's standard library and does not connect to a database.

## Extract and reconcile

```powershell
python scripts/collection_manifest.py --zip "Tome_Tracker_Collection_Files.zip" --output "collection-manifest.json"
python -m unittest discover -s scripts/tests
```

The manifest includes source-file hashes, source row locations, stable title/author keys, expected owned/status counts, original publication years where supplied, and a review queue. Source rows are retained rather than silently discarded. Duplicate physical identities or unknown reading statuses stop extraction. Omnibus contents link to one physical edition; differently titled split volumes remain different physical records. Excel series missing from Word are retained with unknown order/completeness.

The supplied collection reconciles to 245 physical books: 150 READ, 94 UNREAD, 1 READING, 0 UNKNOWN. It produces 71 series and 436 checklist entries. Four Word/Excel ownership discrepancies and six unconfirmed publication dates remain for manual review. Actual personal collection files and the generated manifest are kept outside this repository.

## Preview before applying

Use a disposable development PostgreSQL database. Do not point these commands at production. Apply migrations only to that disposable database and enable imports there:

```powershell
$env:DATABASE_URL = 'postgresql://test:test@localhost:5432/tome_test'
$env:COLLECTION_IMPORT_ENABLED = 'true'
npx prisma migrate deploy
npm run dev
```

Sign in to the development app and open **Series → Import collection**. Upload the manifest, inspect the preview and review items, then apply. The API requires authentication and scopes all records to that user. Import POST is disabled by default in all environments, including production and Vercel previews. Production must remain disabled until the owner explicitly approves a production import.

`POST /api/collection-import` accepts `{ "mode": "preview" | "apply", "manifest": ... }`. Preview performs no writes. Blocking edition/status ambiguity returns HTTP 409 and the review report. Apply uses one serializable transaction, unique per-user source keys and upserted memberships. A concurrency conflict returns HTTP 409; preview again before retrying.

Reruns never overwrite existing title, author, year, reading status, series position, or entry type, and never remove records. Import keys preserve links after manual title/author edits. Existing untracked reading-status conflicts block initial import. Later reading-status edits are retained and reported as differences from the original source counts. The persisted report includes actual physical/status counts and whether they reconcile. Extra existing physical books are counted separately and are preserved.

## Manual review and metadata

Open a series entry's **Edit** form to correct titles, publication years, positions and entry types. **Link edition** connects an existing physical book to a work without adding a book. An omnibus can link to several works, and a work can appear in several series. Unknown positions remain unknown until verified. Metadata lookup only proposes Open Library work-level values; it never writes automatically or claims to establish a complete series list. Review a candidate, put its values in the form, and save deliberately. Source data and review messages remain available in the import manifest/report.

An entry is owned if the current user's physical editions are linked to it, directly or as omnibus contents. Multiple linked split volumes must all be READ for the work to count as read. Physical library totals never include unowned works.

## Validation

- `npm ci`: reproducible dependency installation; the lockfile includes the missing peer dependencies.
- `npm run test:unit`: unit, component, route authorization, schema and metadata-contract tests.
- `python -m unittest discover -s scripts/tests`: extraction and source-policy tests.
- `RUN_DATABASE_TESTS=true npx vitest run __tests__/database`: guarded, localhost-only disposable PostgreSQL tests for migrations, reruns, corrections, ownership, user isolation and 245-edition reconciliation.
- The older `npm run test:integration` HTTP tests additionally require a running application and configured test database; they are separate from the unit suite.

GitHub Actions runs unit/TypeScript/Python/build checks, a PostgreSQL service for database tests, and an application server for HTTP tests. The HTTP suite covers collection import, series access isolation, edition links, reading-status sync, and existing account, import, registration and login endpoints. Password-reset email delivery, live external metadata providers, camera scanning and browser visual checks have not been exercised in this session.

The actual private manifest passed the application's Zod validation and pure import planner: 245 new physical editions, 434 unique works, 71 series, 436 entries and ten nonblocking source-review items. A known publication year can fill an unknown year across overlapping source memberships; two different known years require review. This was a dry run, without a database connection. Database reconciliation and rerun tests use synthetic 245-edition fixtures, not the personal collection.

Local Windows Prisma/Vitest execution encountered sandbox `EPERM` path-resolution failures, so Linux CI is the source of executed Node test results for this development session. No production migration or import has been performed.
