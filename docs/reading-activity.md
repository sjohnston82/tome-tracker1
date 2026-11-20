# Reading Activity and quarterly recaps

Open Activity in the desktop/mobile navigation or View reading activity in the library. The page offers yearly totals, monthly page bars that open completion details, and quarterly recaps with book links and completion dates. Current quarters are marked “so far”; future quarters are marked upcoming. Previous years default to their last active quarter. Empty and offline states explain how to begin tracking or reconnect. The feature uses existing reading sessions/logs and requires no migration.

## Calculation rules

The browser sends its IANA time zone to `GET /api/reading/activity?year=2026&timeZone=America/New_York`. UTC is the API fallback. Month, year, quarter and active-day boundaries use that zone, including DST and New Year boundaries. Invalid filters return 400. Years available in the picker come from recorded activity plus the current/selected year.

For each session, sort all logs chronologically by stopping time, then creation time and ID. Start the high-water mark at the baseline page. Each entry contributes only `max(0, page - previousHighWater)` to its calendar month. Earlier-year logs remain in the calculation before filtering the selected year. Lower pages and repeated pages add zero, and gaps between entries are not distributed or estimated. A new reading session can count reread pages. Future events are excluded until their recorded time arrives.

Books finished counts distinct physical library records whose sessions have a recorded finishedAt in the period. Completed reads counts sessions, allowing explicit rereads. The page discloses this distinction and shows repeated completed sessions separately. Unique-book totals across quarters/months need not sum to the yearly distinct count. Read-labelled books with no dated completion are counted separately across the whole collection, with no invented completion dates. Existing in-progress baselines contribute no pages until later progress is logged. Completion counts do not assume the final page equals the edition’s page count.

A day with new pages means at least one positive page increment in the chosen time zone. The recap’s average is logged pages divided by those days; it is not time spent reading or reading speed. The busiest month uses positive page increments and discloses ties. These descriptions reflect observed records, including sparse histories, without estimating habits from unlogged days. Corrections, changed dates/baselines and deleted or reopened completions are recalculated on each request.

## Privacy and verification

Queries filter by the authenticated user through the book relationship and read a consistent repeatable-read snapshot. Only IDs, titles, author names, page numbers and event times needed for aggregation are selected; reading notes are not returned. Responses are private/no-store and bypass generic API/service-worker caching. Activity needs a connection; the owned-library offline features remain available. Refresh reading activity reloads totals after changes in another tab. Requests are aborted on navigation, year/account changes and going offline.

Automated tests cover starting-page exclusion, repeated/lower pages, backdated/tied entries, prior-year high-water marks, time zones and DST, rereads, sparse/empty/future data, corrections and removed completions. Component tests exercise year/quarter/month controls, dated book links, empty/offline/error/retry states and clearing private data on sign-out. Disposable PostgreSQL tests check account isolation and recalculate after real reading-log mutations. HTTP tests check authentication, private response headers, malformed filters and New Year boundaries. All database tests create and clean up synthetic accounts only.
