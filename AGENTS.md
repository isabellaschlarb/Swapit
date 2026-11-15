<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Swapit project rules

- Read `HANDOFF.md` first. Keep code simple and readable; teammates are not technical.
- Database changes go in a NEW numbered file in `supabase/migrations/` (e.g. `0004_...sql`). Never edit a migration that has already been run (0001–0004, 0007 and 0008 are live).
- Security rules live in the database (RLS + triggers). Don't weaken them to make app code work; never use the Supabase service_role / secret key in the app.
- Secrets (AI API keys etc.) go in `.env.local` only, with names that do NOT start with `NEXT_PUBLIC_`, and are used only in server code. Never commit `.env.local`.
- Money is stored in cents (`2000` = $20). Use helpers in `lib/format.ts`.
- Match the brand board (`design/design.webp`). Use the design tokens in `app/globals.css` (`bg-navy`, `bg-sky`, `bg-pale`, `bg-cloud`, `bg-surface`, `text-ink`, `shadow-soft`); no new colors, no red. Logo: `components/Logo.tsx`.
- Before committing: `npm run build` and `npm run lint` must pass. If swap rules changed, run `supabase/tests/swap_rules_test.sql` (see HANDOFF.md).
