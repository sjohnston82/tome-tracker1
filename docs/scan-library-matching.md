# Scan review and existing-copy linking

After barcode/printed-ISBN lookup or a manual title selection, Scan checks the signed-in user’s physical Book records. Unowned series works are not ownership matches. The review is read-only until the user confirms an action.

- An existing ISBN-13 or equivalent ISBN-10 shows the saved copy, even when the external catalog returns a different title. No additional copy can be added from this exact-ISBN state.
- Title/author matches and conservative spelling variants are suggestions. Each candidate shows saved reading status, recorded year and ISBN. Similar titles cannot collapse different physical parts, numbered books, or omnibus versus single editions. Partial/missing author credits are labelled for review.
- Link to this copy opens a confirmation naming the target and scanned ISBN. Confirm link fills only a missing ISBN-13. Existing ISBN-10, book ID, import key, title, author, covers/locks, publication metadata, statuses, work/content/series relationships and reading sessions/logs stay in place.
- A different recorded ISBN is preserved. Adding another edition requires checking that it is a separate physical copy or edition, then clicking Add another edition. Existing-ISBN duplicate protection still applies.
- A failed library check blocks addition until Retry library check succeeds. Link conflicts offer Check matches again; stale reviews cannot overwrite newer values. Multiple matches require a manual choice and are never merged automatically.

`POST /api/scan/matches` accepts ISBN and/or title/author credits and searches all owned physical records, rather than the previous duplicate check’s latest-500 subset. It returns the ten closest candidates plus total/exact counts and uses private, no-store responses. Matching normalizes leading articles, punctuation, colour/color, explicit Roman part numbering and common author initials. These are suggestions, not proof of edition identity.

`PATCH /api/books/:id/isbn` accepts only a valid ISBN and the reviewed record’s updatedAt timestamp. The session determines ownership. A conditional update checks owner, missing ISBN, existing ISBN-10 and timestamp. The database’s per-user ISBN-13 unique constraint resolves concurrent claims. A retry of an already successful link is idempotent, while another copy’s ISBN or a conflicting recorded ISBN-10 returns 409 with owner-scoped details. The endpoint cannot write unrelated metadata. There is no schema migration or production-database step.

Validation includes pure matching tests, component confirmation/retry/separate-edition decisions, authorization/input route tests, real PostgreSQL preservation/race/stale-review tests and an authenticated HTTP link/rescan flow. The local unit/component suite passed 278 tests and TypeScript passed; database/HTTP tests run on CI’s disposable PostgreSQL instance. No local library records were modified while implementing or testing this feature.

To check on a phone: refresh Scan; scan a book whose imported record lacks an ISBN; choose the correct existing copy and Confirm link. Verify the book count and saved status stay unchanged, then scan it again and expect You own this edition with View existing book. For a genuinely different edition, acknowledge the separate-copy checkbox before adding.
