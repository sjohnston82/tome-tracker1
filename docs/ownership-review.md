# Ownership review

Open Series → Manage checklist → Review ownership beneath a work. A shortcut at the top of Series opens the first unconfirmed automatic match. The checklist filter also includes Ownership matches to review. Series with no owned copies remain available through Show series with no owned books.

Each review shows the physical title, author, ISBN, reading status, and whether ownership comes from a saved edition relationship, a saved contents relationship (including omnibus copies), or an unconfirmed title/author match. Contents of a merged series retain their original work IDs internally, so a review follows the actual relationship instead of assuming every copy belongs to the displayed primary record.

- **Confirm this copy** saves a contents link without changing the physical record, reading status, cover or reading history.
- **Not this copy** rejects an automatic match. Rejected matches remain visible in the review and stay rejected after refresh or the original collection import is rerun.
- **Remove ownership link** removes this work's edition and contents relationships across its merged aliases, blocks automatic rematching, and leaves the physical copy, reading history and links to other works intact.
- **Allow matching again** removes a rejection. It may restore a safe automatic match; it does not save a confirmed link.
- **Choose another library copy** supports explicit corrections, including multi-author omnibus copies. The confirmation shows the exact physical copy and target work, plus other works already associated with the copy. Existing associations to other works are preserved.

Every change is staged in a confirmation panel before posting. Offline writes are disabled. Failed or stale saves require a fresh review, and mutations are never automatically retried by the browser. An uncertain response is checked by refreshing the review rather than guessing whether it was saved. Opening another account invalidates both cached review contents and pending responses.

## Data integrity

Authenticated `GET/POST /api/works/:id/ownership` performs owner-scoped reads and returns private/no-store responses. POST accepts only an action, an owned physical-copy ID and a SHA-256 version from the current review. Unknown fields, unsupported actions and invalid IDs are rejected. The server compares the version against a fresh snapshot inside a serializable transaction; conflicting transactions retry the snapshot comparison, and an outdated decision returns 409. Missing or foreign works/copies return 404.

A review snapshots owned works, physical copies, authors, relationship IDs, relevant alias grouping and persisted rejections. A confirmed change never deletes or creates a physical book, rewrites book metadata, changes reading labels or modifies reading logs. Ambiguous work identities and existing unrelated links do not become automatic matches. Explicit selections can add an omnibus relationship after confirmation.

Rejections use the versioned `tome:ownership-review` CollectionImport namespace, independent of source manifests and metadata-review decisions. Invalid decision data fails closed instead of silently restoring inferred ownership. Backup validation checks the decision format; restore remaps physical-copy and work IDs, discarding stale decisions for records no longer present. Old backups without ownership decisions continue to work. No schema migration is required.

## Verification

Unit/UI checks cover provenance across aliases, rejection suppression, concrete confirmation/cancel behavior, offline controls, stale-review refresh, double-submit suppression, pending responses after an account change, API authorization/validation, and backup format/ID remapping.

Disposable PostgreSQL tests exercise real confirmation/rejection, idempotent links, competing transactions, stale snapshots, direct plus omnibus/alias removal, preservation of other contents and reading history, cross-account isolation, ambiguous identities, deleted physical copies, reimport persistence, and backup round trips. Signed HTTP tests exercise the complete authenticated review flow and error statuses. Tests use generated accounts in isolated databases; personal and production libraries are not mutated.
