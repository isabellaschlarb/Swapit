# Swapit
SwapIt is a campus-exclusive clothing swap app for college students. Verify with your student ID to join your school’s feed, then trade clothes with fellow students at a meeting spot on campus. Refresh your wardrobe for free, skip fast fashion and shipping time, and build community, one swap at a time.

---

## What's built so far

- **Sign in with your school email.** No passwords: we email you a link. Only emails from schools in our database get in (starting with Cal Poly, `calpoly.edu`).
- **Onboarding.** Pick a display name and a few style tags.
- **Feed.** Items posted by students at *your* school only.
- **Post.** Upload up to 4 photos and list an item (fully working).
- **Item page.** Photos and details. The "Request swap" button is a placeholder.
- **Swaps.** Lists your swap requests (placeholder, nothing creates them yet).
- **Profile.** Your info, style tags, your items, and sign out.

Tech: Next.js 16 + TypeScript + Tailwind CSS, with Supabase for login, database, and photo storage.

---

## Setup guide (no coding experience needed)

You'll do this once. It takes about 15 minutes.

### 1. Install the tools
- Install **Node.js** (the "LTS" version) from https://nodejs.org.
- Install **Git** from https://git-scm.com if you don't have it.
- Download this project: `git clone <this repo's URL>`, then open the folder in a terminal.

### 2. Create the Supabase project
Supabase is our backend: it stores users, items, and photos.

1. Go to https://supabase.com and sign in (GitHub works).
2. Click **New project**. Name it `swapit`, set a database password (save it somewhere), pick the **West US** region, and click **Create new project**. Wait ~2 minutes.

> Already have the team project? Ask an owner to invite you instead (Organization → Team → Invite), and skip to step 5.

### 3. Set up the database
1. In Supabase, open **SQL Editor** in the left sidebar, then click **New query**.
2. Open the file `supabase/migrations/0001_init.sql` from this project, copy **all** of it, paste it in, and click **Run**. You should see "Success. No rows returned".
3. Click **New query** again. Do the same with `supabase/seed.sql`. This adds Cal Poly and its meetup spots.

### 4. Set up sign-in emails
1. Open **Authentication → URL Configuration**.
   - **Site URL:** `http://localhost:3000`
   - Under **Redirect URLs**, click **Add URL** and add `http://localhost:3000/auth/callback`
2. Open **Authentication → Emails**. On the **Templates** tab, edit **both** the "Magic Link" and the "Confirm signup" templates. Replace the message body with:
   ```html
   <h2>Your Swapit sign-in link</h2>
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Swapit</a></p>
   ```
   Click **Save** on each one. *Why?* With this change the link works even if you open it in a different browser or app, like the Gmail app on your phone.

> ⚠️ **Email limit:** Supabase's built-in email sender only sends a few emails per hour. That's fine for testing, but before demo day set up free custom email: create a free account at https://resend.com, then in Supabase go to **Authentication → Emails → SMTP Settings** and enter Resend's SMTP details.

### 5. Connect the app to Supabase
1. In Supabase, open **Project Settings → API** (it may be called **API Keys**). You need the **Project URL** and the **anon public** key.
2. In this project folder, make a copy of `.env.example` and name it **`.env.local`**.
3. Open `.env.local` and paste in the two values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   `.env.local` is never uploaded to GitHub. Don't paste these keys into chats or docs.

### 6. Run it
In a terminal, inside the project folder:
```
npm install
npm run dev
```
Open http://localhost:3000. To see it like a phone, press F12 in Chrome and click the phone icon in the top-left of the panel that opens.

---

## Deploying to Vercel (getting a real link)

1. Push this project to GitHub.
2. Go to https://vercel.com, sign in with GitHub, click **Add New → Project**, and pick the Swapit repo.
3. Before clicking Deploy, open **Environment Variables** and add the same two lines from your `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Click **Deploy**. You'll get a URL like `https://swapit-xyz.vercel.app`.
5. Back in Supabase, open **Authentication → URL Configuration**:
   - Change **Site URL** to your Vercel URL.
   - Add `https://swapit-xyz.vercel.app/auth/callback` (your real URL) to **Redirect URLs**. Keep the localhost one so local development still works.

Every push to GitHub now redeploys automatically.

---

## Adding a new school

No code changes needed. In the Supabase **SQL Editor**, run (with your school's details):
```sql
insert into public.schools (name, email_domain) values ('UC Santa Barbara', 'ucsb.edu');

insert into public.meetup_spots (school_id, name, description)
select id, 'University Center', 'Front entrance' from public.schools where email_domain = 'ucsb.edu';
```
Students at that school can sign in right away and will only see their own campus.

---

## How the code is organized

```
app/                     Pages. Each folder = a URL.
  page.tsx               Landing page  (/)
  login/                 Sign-in page  (/login) + the code that sends the email
  auth/callback/         Where the email link lands; signs the user in
  onboarding/            Name + style tags (first sign-in only)
  (app)/                 Pages with the bottom tab bar ("(app)" isn't in the URL)
    feed/ post/ item/[id]/ swaps/ profile/
components/              Reusable pieces: TabBar, ItemCard, PostItemForm, …
lib/
  supabase/              Connections to Supabase (browser, server, proxy)
  constants.ts           Style tags, sizes, categories: edit lists here
  format.ts              Money helpers (we store money in cents)
  types.ts               Shapes of database rows
proxy.ts                 Runs before every page: sends signed-out people to /login
supabase/
  migrations/            Database tables + security rules
  seed.sql               Starter data (Cal Poly + meetup spots)
```

### Security in one paragraph
The database itself enforces the rules (Supabase calls this Row Level Security). Even if someone tampers with the app, they can only see profiles, items, and meetup spots from **their own school**. They can only edit **their own** profile and items, and only the two people in a swap can see it and its messages. Photos are stored in folders named after each user, and you can only upload to your own folder.

### Design tokens
Use these Tailwind classes instead of picking colors (defined in `app/globals.css`):

| Class | Color | Use for |
|---|---|---|
| `bg-primary`, `text-primary` | deep green `#2F6F4F` | main buttons, active tab |
| `bg-accent` | lilac `#C9B6F2` | tags, highlights, notices |
| `bg-cream` | warm cream `#FAF7F2` | page background |
| `bg-surface` | soft card `#FFFDF9` | cards and inputs |
| `text-ink` | near-black `#1F1F1F` | text (`text-ink/60` for lighter text) |

Keep it minimal: rounded corners, lots of space, one main button per screen, no red, no stark black/white.
