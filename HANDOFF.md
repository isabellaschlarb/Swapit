# Swapit handoff: AI features

Hi Isa! This is everything you need to pick up Swapit and build the AI features.
Jasper built the base app. Your job is the smart stuff (style matching, auto-tagging, price suggestions).

---

## 1. What's built

**Working:**
- **Sign in with a school email.** We email you a link, no passwords. Only `@calpoly.edu` (and other schools we add) can get in.
- **Onboarding.** New users pick a display name and a few style tags (vintage, streetwear, y2k…).
- **Feed.** Items from *your school only*, newest first.
- **Post an item.** Up to 4 photos, title, category, size, condition, estimated value, style tags. You also choose *swap only*, *sell only*, or *swap or sell* (with an asking price).
- **Item page.** Photos and details, plus **Request swap** and/or **Buy for $X** buttons.
- **Swap / buy requests.** Offer your own items (plus optional cash) or just cash, and pick a campus meetup spot and time.
- **Swaps page.** Incoming and Sent tabs. Accept, Decline, Cancel, and Mark complete.
- **Profile.** Your name, style tags, your items, and sign out.
- **Security.** The database itself makes sure people only see their own school and can only change their own stuff.

**Stubbed or not built yet:**
- No chat between swappers yet (the `messages` table exists, but there's no screen).
- No editing or deleting items, no profile editing, no profile photos.
- Payments are in person only (cash or Venmo). No Stripe.
- No AI yet. That's you!

**Things to know:**
- The swap/buy screens were built and checked automatically (the database rules pass all 49 tests), but nobody has clicked through them with two real accounts yet. Please try it with a teammate and tell Jasper if anything looks off.
- Supabase's free email only sends about **2 sign-in emails per hour**. If sign-in emails stop arriving, that's why. Wait, or ask Jasper about setting up Resend.
- **Sign-in links work in any browser or email app.** They open `/auth/confirm`, and you tap **Tap to sign in** (on purpose, so school email scanners can't use up the link). Emails come from `swapit.app.team@gmail.com`, up to 100 per hour.
- Nicer sign-in emails that work in any browser are ready in `supabase/templates/`, but Supabase's free plan only allows them once custom email (SMTP, e.g. Resend) is set up. The README explains how. Ask Jasper before running `npx supabase config push`.

---

## 2. How to run it on your computer

You need **Node.js** (LTS version, from https://nodejs.org) and **Git**.

1. **Get the code** (in a terminal):
   ```
   git clone https://github.com/isabellaschlarb/Swapit.git
   cd Swapit
   ```
2. **Install everything:**
   ```
   npm install
   ```
3. **Create a file called `.env.local`** in the Swapit folder, with these two lines:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```
   **Get the values from Jasper** and paste them after the `=` signs.
   This file is private: git ignores it on purpose. Never paste keys into GitHub, chats, or docs.
4. **Start the app:**
   ```
   npm run dev
   ```
5. Open **http://localhost:3000** in your browser. To see it like a phone, press F12 in Chrome and click the phone icon.

---

## 3. How the database works

We use **Supabase** (a hosted Postgres database). The *shape* of the database (tables, columns, rules) is defined by SQL files in **`supabase/migrations/`**, run in order:

| File | What it does |
|---|---|
| `0001_init.sql` | All the tables, security rules, and the photo storage bucket |
| `0002_hardening.sql` | Security and speed tune-up |
| `0003_swap_flow.sql` | Listing types, prices, and the swap/buy rules |

**The golden rules:**
1. **Never edit a migration file that has already been run.** All three above have already run on the live database. Editing them does nothing to the real database and confuses everyone.
2. **Any database change goes in a NEW file** with the next number, e.g. `supabase/migrations/0004_ai_style_scores.sql`.
3. To apply a new migration to the live database:
   ```
   npx supabase login            (once; opens your browser)
   npx supabase link --project-ref <ask Jasper>
   npx supabase db push --remote --dry-run    (preview)
   npx supabase db push --remote              (apply)
   ```
   If you're not comfortable doing this yet, just commit the file and ask Jasper to run it.
4. After changing anything about swaps, check the rules still work:
   ```
   npx supabase db query --remote --yes -f supabase/tests/swap_rules_test.sql -o table
   ```
   It undoes everything it does, so it's safe. Every line should say PASS.

---

## 4. Where the AI features plug in

### The data AI will use

| Table.column | What's in it |
|---|---|
| `profiles.style_tags` | A user's style, a list like `{vintage, y2k}` (picked at onboarding) |
| `items.style_tags` | An item's style tags (picked when posting) |
| `items.estimated_value_cents` | The owner's estimated value, **in cents** (`2000` = $20) |
| `items.price_cents` | Asking price in cents (only for sell / swap-or-sell items) |
| `items.listing_type` | `swap`, `sell`, or `swap_or_sell` |
| `items.title`, `description`, `category`, `size`, `condition` | Item details |
| `items.photo_urls` | Links to the item's photos (public images) |
| `items.status` | `available`, `pending` (on hold in a swap), `swapped`, or `sold` |

The list of allowed style tags is in **`lib/constants.ts`** (`STYLE_TAGS`).
Money helpers (cents ↔ dollars) are in **`lib/format.ts`**.

### The files to change

| Feature idea | File(s) |
|---|---|
| **Posting items**: auto-suggest style tags or a value from the photos/title | `components/PostItemForm.tsx` (the form; it uploads photos, then saves the item), `app/(app)/post/page.tsx` |
| **The feed**: rank items by how well they match my style | `app/(app)/feed/page.tsx` (loads items from the database) and `components/ItemCard.tsx` (one tile) |
| **Swap requests**: suggest which of my items to offer, or a fair cash difference | `app/(app)/item/[id]/request/RequestForm.tsx` (the form), `.../request/page.tsx` (loads my items), `.../request/actions.ts` (saves it) |
| **Swaps list** | `app/(app)/swaps/page.tsx` |
| **Style tag picker** | `components/StyleTagPicker.tsx` |

### Important for AI API keys
- AI keys (OpenAI, Anthropic, etc.) are **secret**. Put them in `.env.local` with a name that does **NOT** start with `NEXT_PUBLIC_` (e.g. `ANTHROPIC_API_KEY=...`). Anything starting with `NEXT_PUBLIC_` is visible to everyone's browser.
- Only use AI keys in **server code**: files with `"use server"` at the top, or page files without `"use client"`.
- When the app goes live on Vercel, add the same key in Vercel → Settings → Environment Variables.

### Tips for working with Codex
- Codex automatically reads **`AGENTS.md`**. It has a note that this project uses **Next.js 16** (newer than what most AI tools know). Tell Codex to read it and the docs it points to.
- Good first prompt: *"Read HANDOFF.md and AGENTS.md, then explain the plan before writing code."*
- Ask Codex to run `npm run build` and `npm run lint` before you commit.

---

## 5. Git rules

We keep `main` working at all times. You work on your own branch and merge through a pull request.

**Every time you start working:**
```
git checkout ai-features
git pull
```

**When you've made something that works:**
```
git add -A
git commit -m "Describe what you changed in plain English"
git push
```

**When a feature is done**, open a **pull request** to merge `ai-features` into `main`:
1. Go to https://github.com/isabellaschlarb/Swapit
2. Click **Pull requests**, then **New pull request**
3. Set **base: main** and **compare: ai-features**, then click **Create pull request**
4. Ask Jasper to look at it before merging.

**Never:**
- commit `.env.local` or any key (git ignores `.env.local` already, so don't force it)
- edit an already-run migration file (see section 3)
- force-push (`git push --force`)
