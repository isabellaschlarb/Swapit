# Phase 1: profile editing and search

Local branch `feature/profile-search-mvp`, based on fetched `origin/main` at
`f9c81e9`. The matching branch has NOT been assumed merged. Authentication and
matching worktrees, their local changes, and the matching backlog are untouched.
No pushes, merges, deployments, shared migrations, or deployment settings changes
were made during implementation/review. Follow Closet and style-tag expansion
are not implemented.

## Student flow

- Profile: open **Edit my profile** to save a 2–40 character display name, bio up
  to 300 characters, and optional JPEG/PNG/WebP picture up to 5 MB. Remove-photo
  is explicit. Verified email and school cannot be edited here. Existing names,
  bios and style tags remain compatible. Supported legacy Supabase avatar URLs
  remain readable; new uploads use private storage instead.
- Public closet: `/people/[id]` shows only a school-authorized public name, bio,
  current photo, style tags, and available listings. No email, authentication
  metadata or raw storage path is rendered. Public means visible to signed-in
  students at the same school, not the open Internet. Profile, people results and
  feed owner links open this closet. Missing/deleted/other-school profiles have
  the same unavailable state. Listings have next-page/first-page controls.
- Explore: search available listings by literal, case-insensitive text across
  title, description, category and existing tags, with exact category/style
  filters. Switch to People for public display-name search. There is no username
  field in this schema; no username or email search was invented. Both modes have
  24 results per page, loading, end/empty states and retryable errors. Changing
  filters resets pagination. Existing shared constants/cards/design tokens are
  reused. No AI is called.

## Access rules and save behavior

All database and storage access uses the normal cookie-authenticated Supabase
client, never a service key. Public closet and avatar endpoints also explicitly
scope the school. The save endpoint authorizes the current student server-side;
identity, school and email fields supplied by a browser are ignored. Same-origin
POST and a bounded multipart body protect the upload endpoint. File MIME, size
and format signature are checked before any upload; these are not a full image
decoder, malware scan or image re-encoding pipeline. SVG is not accepted.

The new private `profile-photos` bucket has a 5 MB limit and MIME allowlist.
Students can upload only into their own folder and only with a school profile.
Objects cannot be updated/overwritten. Owners can read their own staged files;
other students can read only a currently referenced same-school photo. Active
photos cannot be deleted through the storage policy. Unpublished/failed uploads
are not visible to other students.

Each new photo has a unique path. Only after upload succeeds does the app update
the current student's name/bio/photo reference. Compare-and-swap on the previous
photo path avoids overwriting a concurrent photo replacement. Rejected saves
preserve the previous photo and clean up only the known inactive new object.
If a response is lost, the code re-reads the profile before deciding whether the
save succeeded. If that cannot be verified, both photos are retained and the UI
asks the student to reload. Old-object cleanup failures do not undo a confirmed
save; orphan cleanup may need a later maintenance process. Names and bios follow
normal last-save-wins behavior; there is no full profile version history.

New photos are served by an authenticated `/api/avatars/[id]` route with private,
no-store headers and nosniff. Next image optimization is disabled for this route
so it cannot turn private photos into publicly cached images. A nonsecret photo
revision in the URL refreshes changed pictures; failures fall back to initials.
Legacy public image URLs retain their existing public-storage behavior; this
change does not rewrite or revoke old URLs.

## Database migration and search limits

`supabase/migrations/0006_profile_search.sql` adds `avatar_path`, owner-path and
length checks, private storage policies, school-scoped security-invoker search
functions, and pagination indexes. Historical migrations are unchanged. Existing
name/bio rows are not rewritten; their new length constraints are NOT VALID so
they constrain new writes without blocking migration on unknown legacy rows.
Audit existing data before validating those constraints later. Avatar ownership
is checked in the database; existing profile RLS and school-update restrictions
remain in force.

Migration numbering was checked against locally fetched main (0001–0003) and the
matching branch (0005). Number 0004 is reserved for the separately prepared
deletion guard. Number 0006 has no conflict in those refs and depends only on
0001–0003. Network/fetch permissions prevent an independent freshness guarantee;
recheck teammate migrations before integration. No database was contacted or
migration applied in this session.

Search functions accept parameters, not dynamic SQL, and run as the signed-in
student under existing RLS. They independently require the current school and
available status and return at most 25 rows (24 plus next-page lookahead).
Listing cursors use created_at/id descending; people use lower(display_name)/id
ascending, including ties. Cursors are bound to filters and closet but are not
authorization tokens; RLS remains authoritative even if a cursor is modified.
Updates/deletions between pages can naturally change results. Text search is
simple substring search, not fuzzy, stemmed or relevance-ranked. Queries up to
100 characters are literal, including `%` and `_`. Campus substring scans may
need full-text/trigram indexes at larger scale; this MVP adds no extension or AI.

## Files for review

- Profile flow: `app/(app)/profile/page.tsx`, `components/ProfileEditor.tsx`,
  `app/api/profile/route.ts`, `lib/profile-input.ts`, `lib/profile-server.ts`,
  `lib/request-body.ts`.
- Public closets: new `app/(app)/people/[id]/` page, unavailable/loading/error
  screens; new `app/api/avatars/[id]/route.ts`.
- Search: `app/(app)/explore/page.tsx`, `components/SearchForm.tsx`,
  `components/PeopleResults.tsx`, `lib/search.ts`, `lib/search-server.ts`.
- Integration: `components/Avatar.tsx`, `components/ItemCard.tsx`, feed owner
  avatar loading in `app/(app)/feed/page.tsx`, and `lib/types.ts`.
- Shared retry UI: `components/SectionError.tsx`; route-local error/loading files
  under Explore and Profile.
- New migration, `supabase/tests/profile_search_test.sql`,
  `tests/profile-search.test.mjs`, and this handoff.

Authentication, email-code sign-in, swap behavior, Following placeholder, shared
style-tag values, OpenAI integration and dependency manifests were not changed.
Explore will need a small integration edit when the matching branch is merged:
retain its independent matching panel alongside this search interface.

## Validation

24 application tests passed using VS Code's embedded Node v24.22.1 with mocked
database/storage responses. Coverage includes validation, owner-scoped writes,
forged identity fields, upload/save failures, ambiguous and concurrent saves,
old-photo retention, cleanup failures, removing legacy photos, private avatar
access, public-profile projection, same-school/other-school/deleted states,
literal/filter input validation, tied-cursor pagination, query failures, and
oversized streamed bodies. These do NOT prove live RLS/storage enforcement.

Review fixed two reproduced issues: inherited object keys (for example a MIME
type of `constructor`) could pass the app's MIME-map lookup, and feed database
errors were displayed as an empty campus. The MIME lookup now requires an own
allowlist key, and feed read errors have a generic retry state instead of empty
results or raw database details. Both regressions failed before the fixes and
pass afterward. Storage's separate MIME allowlist was an additional boundary;
it was not used as a reason to leave input validation weak.

Reviewed scope is 29 files: profile/search code, supporting public avatar/closet
and feed integration, the new migration, tests and this handoff. No authentication,
matching, Following implementation, historical SQL, environment file, dependency
manifest or lockfile changes are included. The matching worktree's untracked
`docs/BACKLOG.md` remains outside this change. Known residual limits include
signature-only image validation, legacy public avatar URLs, possible inactive
objects after ambiguous failures, and substring-search scaling, described above.
This is suitable for a draft discussion; live database/storage and build checks
remain required before merge.

ESLint passed through the project's existing CLI using that runtime. Full
`tsc --noEmit` was attempted: it cannot pass because generated Next PageProps/
LayoutProps types and the preexisting OpenAI package are missing. New code type
errors found in the first run were fixed; the remaining diagnostics are those
tooling/dependency blockers. `next build` and `next typegen` were attempted
directly: embedded Electron cannot load the native SWC binary, and the WASM
fallback is unavailable. Standard npm lint/build commands cannot start because
npm/standalone Node are not on PATH. No dependencies were upgraded or lockfiles
changed. Ignored dependencies were copied locally from the existing worktree to
run available checks without modifying another checkout.

The new transactional SQL suite was attempted at localhost only, but psql,
Postgres/Supabase tooling and Docker are unavailable; no connection occurred. It
covers owner-only profile writes, immutable school, length/owner-path checks,
private storage reads including staged-upload privacy, owner-only uploads,
active-photo deletion and overwrite protection, school RLS, available-only
search, public projection, literal/category/tag queries, tied timestamp/name
pagination, deleted accounts and anonymous search denial. These assertions have
NOT run. No real image upload/download, database concurrency, browser/mobile or
two-account journey was tested. No AI requests are needed or were made.

Before integration, use Node 22+, the locked dependencies and disposable local
Supabase. Review/apply all local migrations (never shared services), then run:

```sh
npm ci
node --test tests/profile-search.test.mjs
npm run lint
npx next typegen
npx tsc --noEmit
npm run build
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/profile_search_test.sql
```

Manually verify real valid/invalid and oversized photos, a failed save with the
old photo still visible, refresh after ambiguous saves, same/other-school users,
private image access after sign-out, deleted profiles, all search modes/filters,
pagination, network failures, and mobile layout/keyboard behavior. Stop here for
Phase 1 review; Follow Closet requires a separate subsequent change.
