# Series shelves

Series opens as bookshelves grouped by author surname with the same A–Z rail as Library. Each recorded series gets a complete, numerically ordered row: prequels and fractional positions come before later volumes; unknown positions remain last. The most frequent main-entry author determines the group, falling back to all entries when there are no main entries. Collaborations use the earliest surname, and empty or unknown-author series appear under #.

Owned entries use color covers and link to the physical edition. Missing entries have grayscale, reduced-opacity artwork and an explicit Missing label; hovering never restores their color. Direct editions and omnibus content both count as owned. A shared omnibus can therefore appear for more than one work without creating additional physical books. A series can be recorded incompletely: the shelf shows all recorded entries and does not assert external catalog completeness.

Search matches series, authors or titles and retains the full matching series. Manage checklist expands the existing editor immediately below that series shelf, with nothing selected on initial load. Checklist filters do not remove entries from the shelf. The carousel retains Library’s touch scrolling, keyboard arrows/Home/End, hover zoom, mouse-edge scrolling and previous/next controls.

## Reference artwork

Saved edition covers are used first, preferring a manually locked cover. Explicitly removed, locked covers remain blank. With automatic covers enabled, artwork for other works is fetched lazily near the viewport through authenticated `GET /api/works/:id/cover`. Reference covers are title/author suggestions, not verified physical editions. They do not write to Work, Book, ownership, reading status or manual metadata.

The endpoint checks ownership before lookup or cache access. Its bounded process-local cache is keyed by user, work and metadata revision, with a 24-hour positive TTL and 15-minute no-result TTL. Concurrent requests share a lookup. Provider failures are not cached; successful responses are private/no-store. The browser shares account-scoped lookups across overlapping series and runs at most two at once. It does not request reference covers when automatic cover fetching is disabled. Provider failures or absent artwork leave a title-bearing placeholder.

## Verification

Local: all 310 unit tests and TypeScript passed. New tests cover numeric ordering, author grouping, omnibus artwork/ownership, locked blank covers, full-series search and filter behavior, grayscale on hover, lazy loading, concurrency limits, cache/account isolation, authorization, TTLs and provider failures.

The HTTP series flow additionally checks that saved locked artwork is exposed to its owner, another user sees no series or cover lookup, and the physical book count stays unchanged. Run in the disposable CI database through `.github/workflows/validate.yml`; never point these tests at a personal or production library.

Manual acceptance: refresh Series; use the surname rail; scroll a long series by mouse, arrow controls and touch; compare colored entries to actual owned copies; open/close Manage checklist and filter its entries; verify a manually chosen cover still matches Library. Missing works without available public artwork show placeholders. No migration is needed.
