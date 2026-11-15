# Mutual matching MVP

Local feature branch: `feature/mutual-matching-mvp`, based on fetched
`origin/main` at `f9c81e9`. No authentication fixes were copied into this branch.
No shared services were changed; the migration has not been applied.

## Student flow

1. Open Explore. Choose a wanted category, optional size, and up to 300 characters
   of extra details. Saving explicitly shares these preferences with the school.
   Style tags and bios are never treated as wanted-item preferences.
2. Press Find suggestions. Students need an available swap listing and saved
   preferences on both sides. The screen shows up to three distinct students,
   with photos, listing links, and explanations of reciprocal category/size fit.
3. Optional descriptions are assessed with AI after deterministic filtering.
   Every result is a suggestion, never confirmed interest or agreement.
   If AI fails, category/size suggestions still work and clearly say that extra
   descriptions were not checked. A legitimate negative AI assessment can yield
   no suggestions; browse the existing feed instead.
4. Check availability & review swap reloads both listings and checks school,
   ownership, status, and listing type before opening the existing request form.
   The student still chooses offered items, meetup details, and submits manually.
   The unchanged `0003` request trigger checks availability/ownership again on
   submission and acceptance. Recommendations never create or accept a swap.
5. Stop sharing preferences deletes the student's preference row, opting them out.

## Files and boundaries

- `app/(app)/explore/page.tsx`: adds matching above the existing search placeholder.
- `components/MutualMatches.tsx`: mobile preference form, suggestions, retry/error
  states, links, and manual handoff. Uses existing design tokens and next/image.
- `app/api/mutual-matches/route.ts`: same-origin POST actions for save, remove,
  find, and review. Verifies the session and school profile; uses only the normal
  cookie-authenticated Supabase client. Replies are private/no-store.
- `lib/mutual-matching.ts`: deterministic reciprocal filters, provider DTO,
  strict output validation, bounded selection, and provider-failure fallback.
- `lib/mutual-matching-server.ts`: RLS-protected candidate loading, OpenAI
  interpretation, and bounded server-memory cache of pair positions.
- `supabase/migrations/0005_mutual_matching.sql`: campus-readable, owner-editable
  opt-in preferences and an atomic per-user search quota. Direct quota-table
  access is revoked. Existing RLS, migrations, auth and swap code are unchanged.
- `tests/mutual-matching.test.mjs` and `supabase/tests/mutual_matching_test.sql`:
  isolated application tests and transactional local database regression coverage.

Profile/search/follow/style-tag follow-ups are separate scope and excluded from
this pull request. Their local backlog document is intentionally not staged.

## Configuration (not applied)

Use the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
optional server-only `OPENAI_API_KEY` in `.env.local`. No new dependency or key is
introduced. The current lockfile requires Node 22+ for its OpenAI SDK.

The new migration must be reviewed and applied to a disposable local Supabase
before trying the feature. It was NOT applied here or to any shared database.
Number 0004 is reserved for the previously prepared deletion guard outside this
branch; 0005 depends only on 0001–0003. Confirm numbering against the team's latest
migrations before integration. Missing matching tables/quota RPC fail closed with
a useful setup/retry message; no provider request is sent.

## Expected API usage and limits

Each Find click consumes one durable quota slot: at most one per 30 seconds and
30 per UTC day per student, across server processes. Preference save/remove and
review do not call AI. A search examines the newest 20 own and 100 other campus
swap-eligible listings, builds at most 24 reciprocal pairs (at most three per
other owner), and displays at most three owners. This intentionally bounded MVP
does not search the entire campus inventory or optimize value differences.

If any candidate has optional description preferences, an uncached search makes
at most one `gpt-4.1-mini` Responses call: 15-second timeout, zero retries,
1,000 output tokens, strict JSON schema, `store: false`. If no extra descriptions
exist, no AI is used. At most 30 provider calls/day/student through this endpoint;
the existing style-tag endpoint is separate and unchanged.

Input includes only request-local pair indices, bounded listing title/description,
category, size, condition, and wanted details. No user IDs, emails, photo URLs,
profiles, or private messages are sent. Email-looking text is redacted. Listing
and preference text is explicitly untrusted. Output must cover exactly the
authorized candidate indices once, with boolean assessments; unexpected IDs,
extra fields, malformed/partial JSON, and duplicates trigger fallback. Explanation
text comes from actual categories/sizes, never model-generated claims.

The per-user, per-school cache uses a fingerprint of current candidates and
preferences, stores only positions, lasts five minutes (one minute for fallback),
and holds at most 100 entries per process. Cold starts may cost another call.
Data is reauthorized before cache lookup and reloaded after ranking; changes
while AI runs cause a retry instead of stale results. Existing displayed cards
can age; review and final submission recheck availability.

## Validation in this session

17 application tests passed using VS Code's embedded Node v24.22.1. Coverage:
reciprocal/missing preferences, school and ownership boundaries, unavailable and
sell-only listings, sizes/categories, bounded/private provider input, invalid
output, provider failure, no-AI filtering, cache freshness, changed data during
ranking, request quota failures, preference create/edit/opt-out, and manual review.
Provider and database responses are mocked; these do not prove live RLS behavior.

ESLint passed using the same runtime and the project's existing CLI. The standard
`npm run lint` and `npm run build` commands could not start because npm/standalone
Node are not installed on PATH. Dependencies were copied locally from the team
checkout without altering it or the lockfile; that installation lacks `openai`.
Registry access failed DNS resolution, so no package was downloaded.

`tsc --noEmit` was attempted; it is blocked by the missing `openai` package (also
affecting the preexisting style-tags route) and missing generated Next route
types. `next typegen` and `next build` were attempted directly; the signed Electron
runtime cannot load Next's native SWC binary, and the WASM fallback is unavailable.
No compiler configuration or dependency was changed to hide these blockers.

The new SQL suite and existing swap-rules suite were attempted at localhost only;
`psql`, PostgreSQL/Supabase tooling and Docker are unavailable. No database
connection occurred. Live provider calls, SQL/RLS execution, concurrency against
Postgres, browser/mobile layout, photos, and a real two-account journey remain
untested. No keys or user credentials were accessed.

On a machine with Node 22+, npm, and disposable local Supabase:

```sh
npm ci
node --test tests/mutual-matching.test.mjs
npm run lint
npx next typegen
npx tsc --noEmit
npm run build
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/mutual_matching_test.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/swap_rules_test.sql
```

Apply migrations locally first. For the older swap suite, inspect every reported
scenario for PASS (it reports failures as text). Manually test two students at one
school, a third at another school, opt-out, no available listings, provider failure,
and an item becoming unavailable between suggestion and manual submission.
