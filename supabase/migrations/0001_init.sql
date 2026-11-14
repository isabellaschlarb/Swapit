-- =====================================================================
-- Swapit — initial database setup
--
-- How to run: Supabase dashboard → SQL Editor → New query →
-- paste this whole file → Run. Then do the same with supabase/seed.sql.
--
-- What's in here:
--   1. Tables (schools, profiles, items, meetup_spots, swap_requests, messages)
--   2. Helper functions + triggers (auto-create profile, auto-fill school)
--   3. Row Level Security (who can see / change what)
--   4. Storage bucket for item photos
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- A school that Swapit is live at. Adding a new campus = adding a row here.
create table public.schools (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  -- e.g. 'calpoly.edu' (always lowercase)
  email_domain text not null unique check (email_domain = lower(email_domain)),
  created_at   timestamptz not null default now()
);

-- One profile per signed-in user. Created automatically on first sign-in
-- (see handle_new_user below). display_name is empty until onboarding.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  school_id    uuid not null references public.schools (id),
  display_name text,
  avatar_url   text,
  bio          text,
  style_tags   text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- A piece of clothing someone posted.
create table public.items (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Filled in automatically from the owner's profile (see trigger below).
  school_id             uuid not null references public.schools (id),
  title                 text not null check (char_length(title) between 1 and 100),
  description           text,
  category              text,
  size                  text,
  condition             text,
  estimated_value_cents integer not null default 0 check (estimated_value_cents >= 0),
  style_tags            text[] not null default '{}',
  photo_urls            text[] not null default '{}',
  status                text not null default 'available'
                        check (status in ('available', 'pending', 'swapped', 'sold')),
  created_at            timestamptz not null default now()
);

-- Safe, public places on campus to meet and swap.
create table public.meetup_spots (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  name        text not null,
  description text,
  unique (school_id, name)
);

-- "I want your item; here's what I'll give you (items and/or cash)."
create table public.swap_requests (
  id                uuid primary key default gen_random_uuid(),
  requested_item_id uuid not null references public.items (id) on delete cascade,
  requester_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  offered_item_ids  uuid[] not null default '{}',
  -- Cash difference, in cents (e.g. 3000 = $30.00). 0 means no cash.
  cash_amount_cents integer not null default 0 check (cash_amount_cents >= 0),
  -- Who pays the cash difference. Must be set whenever there's cash.
  cash_paid_by      text check (cash_paid_by in ('requester', 'owner')),
  status            text not null default 'pending'
                    check (status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  meetup_spot_id    uuid references public.meetup_spots (id) on delete set null,
  meetup_time       timestamptz,
  created_at        timestamptz not null default now(),
  check (requester_id <> owner_id),
  check (cash_amount_cents = 0 or cash_paid_by is not null)
);

-- Chat messages inside a swap.
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  swap_request_id uuid not null references public.swap_requests (id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now()
);

-- Indexes make the common lookups fast.
create index items_school_feed_idx  on public.items (school_id, created_at desc);
create index items_owner_idx        on public.items (owner_id);
create index swaps_requester_idx    on public.swap_requests (requester_id);
create index swaps_owner_idx        on public.swap_requests (owner_id);
create index messages_swap_idx      on public.messages (swap_request_id, created_at);


-- ---------------------------------------------------------------------
-- 2. HELPER FUNCTIONS + TRIGGERS
-- ---------------------------------------------------------------------

-- Which school does this email belong to? Returns null if none.
-- Matches the exact domain (jane@calpoly.edu) and also subdomains
-- (jane@cs.calpoly.edu), picking the most specific match.
-- The login page calls this before sending a magic link.
create or replace function public.school_id_for_email(email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.schools s
  where lower(split_part(email, '@', 2)) = s.email_domain
     or lower(split_part(email, '@', 2)) like '%.' || s.email_domain
  order by char_length(s.email_domain) desc
  limit 1;
$$;

-- The signed-in user's school. Used by the security rules below.
-- ("security definer" lets it read profiles without tripping over
-- the profiles security rule itself.)
create or replace function public.my_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

-- When someone signs in for the first time, Supabase creates a row in
-- auth.users. This trigger then creates their profile with the right school.
-- If their email isn't from a Swapit school, the sign-up is refused.
-- (The login page already checks this; this is the safety net.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_school uuid;
begin
  matched_school := public.school_id_for_email(new.email);

  if matched_school is null then
    raise exception 'Swapit is not at this school yet (%).', split_part(new.email, '@', 2);
  end if;

  insert into public.profiles (id, school_id)
  values (new.id, matched_school);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Items always belong to the owner's school. We fill this in on the
-- server so nobody can post into another school's feed.
create or replace function public.set_item_school()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.school_id := (select school_id from public.profiles where id = new.owner_id);
  return new;
end;
$$;

create trigger items_set_school
  before insert or update of owner_id, school_id on public.items
  for each row execute function public.set_item_school();


-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- Turned on for every table. With RLS on, nothing is visible unless a
-- policy below allows it.
-- ---------------------------------------------------------------------

alter table public.schools       enable row level security;
alter table public.profiles      enable row level security;
alter table public.items         enable row level security;
alter table public.meetup_spots  enable row level security;
alter table public.swap_requests enable row level security;
alter table public.messages      enable row level security;

-- Logged-out visitors may call the "which school is this email?" check.
grant execute on function public.school_id_for_email(text) to anon, authenticated;

-- schools -------------------------------------------------------------
-- The list of supported schools isn't secret (the login page needs it).
create policy "Anyone can see schools"
  on public.schools for select
  to anon, authenticated
  using (true);

-- profiles ------------------------------------------------------------
create policy "See profiles from my school"
  on public.profiles for select
  to authenticated
  using (school_id = public.my_school_id());

-- Normally the trigger creates the profile, but allow it as a fallback,
-- only for yourself and only with your email's school.
create policy "Create my own profile"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and school_id = public.school_id_for_email(auth.jwt() ->> 'email')
  );

create policy "Edit my own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Delete my own profile"
  on public.profiles for delete
  to authenticated
  using (id = auth.uid());

-- Users can edit their name/bio/avatar/tags, but never their school.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, bio, style_tags) on public.profiles to authenticated;

-- items ---------------------------------------------------------------
create policy "See items from my school"
  on public.items for select
  to authenticated
  using (school_id = public.my_school_id());

create policy "Post my own items"
  on public.items for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Edit my own items"
  on public.items for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Delete my own items"
  on public.items for delete
  to authenticated
  using (owner_id = auth.uid());

-- meetup_spots --------------------------------------------------------
-- Read-only for users. Spots are added by the team via SQL / dashboard.
create policy "See meetup spots at my school"
  on public.meetup_spots for select
  to authenticated
  using (school_id = public.my_school_id());

-- swap_requests -------------------------------------------------------
create policy "See swaps I'm part of"
  on public.swap_requests for select
  to authenticated
  using (auth.uid() in (requester_id, owner_id));

-- You can only request as yourself, for an available item at your school
-- that really belongs to owner_id, offering only items you own.
create policy "Request a swap"
  on public.swap_requests for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.items i
      where i.id = requested_item_id
        and i.owner_id = swap_requests.owner_id
        and i.school_id = public.my_school_id()
        and i.status = 'available'
    )
    and not exists (
      select 1 from unnest(offered_item_ids) as offered(item_id)
      where not exists (
        select 1 from public.items mine
        where mine.id = offered.item_id and mine.owner_id = auth.uid()
      )
    )
    and (
      meetup_spot_id is null
      or exists (
        select 1 from public.meetup_spots m
        where m.id = meetup_spot_id and m.school_id = public.my_school_id()
      )
    )
  );

-- Both people in the swap can update it (accept, decline, set meetup...).
-- Who-can-do-which-status-change is handled in the app for now.
create policy "Update swaps I'm part of"
  on public.swap_requests for update
  to authenticated
  using (auth.uid() in (requester_id, owner_id))
  with check (auth.uid() in (requester_id, owner_id));

-- Nobody can change who's in a swap or which item it's for after creation.
revoke update on public.swap_requests from anon, authenticated;
grant update (offered_item_ids, cash_amount_cents, cash_paid_by, status, meetup_spot_id, meetup_time)
  on public.swap_requests to authenticated;

-- (No delete policy: swaps get status 'cancelled' instead of being deleted.)

-- messages ------------------------------------------------------------
create policy "See messages in my swaps"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.swap_requests s
      where s.id = swap_request_id and auth.uid() in (s.requester_id, s.owner_id)
    )
  );

create policy "Send messages in my swaps"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.swap_requests s
      where s.id = swap_request_id and auth.uid() in (s.requester_id, s.owner_id)
    )
  );


-- ---------------------------------------------------------------------
-- 4. STORAGE: item photos
-- Public bucket = anyone with the link can view a photo (needed so the
-- feed can show images). Uploads go into a folder named after the
-- user's id, e.g. item-photos/<user-id>/abc.jpg, and you can only
-- upload/change/delete files in your own folder.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-photos',
  'item-photos',
  true,
  5242880, -- 5 MB per photo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Upload photos to my own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Update photos in my own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Delete photos in my own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
