-- =====================================================================
-- Swapit — social features from the brand board
--
-- 1. Profiles: preferred meetup spot + avatar rules
-- 2. Follows (follow / unfollow people at my school)
-- 3. Chat: unread tracking, server timestamps, live updates (Realtime)
-- 4. Avatars storage bucket
-- 5. Read-only helper functions the app calls:
--      trending_items()  most-liked items at my school lately
--      style_twins()     students with the most similar style
--      profile_stats()   swap count, followers, following
--
-- Like every migration, the rules live in the database: RLS decides
-- who can see/change what, even if the app has a bug.
-- =====================================================================


-- 1. PROFILES ------------------------------------------------------------

alter table public.profiles
  add column preferred_meetup_spot_id uuid references public.meetup_spots (id) on delete set null;

grant update (preferred_meetup_spot_id) on public.profiles to authenticated;

-- The spot must be at your own school, and your avatar must be a photo
-- you uploaded to YOUR folder in the avatars bucket (no random links).
create or replace function public.check_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.preferred_meetup_spot_id is not null and not exists (
    select 1 from public.meetup_spots
    where id = new.preferred_meetup_spot_id and school_id = new.school_id
  ) then
    raise exception 'Pick a meetup spot on your campus.';
  end if;

  if new.avatar_url is not null
     and new.avatar_url not like '%/storage/v1/object/public/avatars/' || new.id::text || '/%' then
    raise exception 'Upload your profile photo through the app.';
  end if;

  return new;
end;
$$;

create trigger profiles_check_fields
  before insert or update of preferred_meetup_spot_id, avatar_url on public.profiles
  for each row execute function public.check_profile_fields();


-- 2. FOLLOWS -------------------------------------------------------------

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

alter table public.follows enable row level security;

-- Follower counts are public within a school. The profiles subqueries
-- run with MY permissions, so they only find people at my school.
create policy "See follows at my school"
  on public.follows for select
  to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = follower_id)
    and exists (select 1 from public.profiles p where p.id = followee_id)
  );

create policy "Follow people at my school"
  on public.follows for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = followee_id)
  );

create policy "Unfollow"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

revoke all on public.follows from anon;
revoke update on public.follows from authenticated;


-- 3. CHAT ----------------------------------------------------------------

-- When did I last open each conversation? Anything newer is unread.
create table public.message_reads (
  swap_request_id uuid not null references public.swap_requests (id) on delete cascade,
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (swap_request_id, user_id)
);

alter table public.message_reads enable row level security;

-- Only my own read markers, only for swaps I'm in (swap_requests RLS
-- only shows me my own swaps).
create policy "My read markers"
  on public.message_reads for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.swap_requests s where s.id = swap_request_id)
  );

revoke all on public.message_reads from anon;

-- Messages: the server sets the time (no back-dating), and the text
-- can't be edited or deleted (no update/delete policies exist).
create or replace function public.stamp_new_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

create trigger messages_stamp
  before insert on public.messages
  for each row execute function public.stamp_new_message();

create index messages_swap_latest_idx on public.messages (swap_request_id, created_at desc);

-- Live updates. Realtime checks the messages RLS policies, so people
-- only receive messages from their own swaps.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;


-- 4. AVATARS BUCKET ------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Upload my avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Update my avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Delete my avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- 5. HELPER FUNCTIONS ----------------------------------------------------
-- "security definer" lets them count things a user can't read row by row
-- (e.g. other people's likes), but they only ever return totals for MY
-- school, never who liked what.

-- Most-liked available items at my school in the last `days` days.
create or replace function public.trending_items(days integer default 7, max_items integer default 60)
returns table (item_id uuid, like_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.item_id, count(*) as like_count
  from public.likes l
  join public.items i on i.id = l.item_id
  where i.school_id = public.my_school_id()
    and i.status = 'available'
    and l.created_at > now() - make_interval(days => days)
  group by l.item_id
  order by like_count desc, max(l.created_at) desc
  limit least(max_items, 200);
$$;

-- Students at my school whose style is most like mine. Each person's
-- style = their profile tags + tags of items they liked. Match % =
-- shared tags / all tags between us (Jaccard), rounded.
create or replace function public.style_twins(max_people integer default 10)
returns table (profile_id uuid, match_pct integer)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select p.id
    from public.profiles p
    where p.school_id = public.my_school_id()
      and p.id <> auth.uid()
      and p.display_name is not null
  ),
  person_tags as (
    select p.id, unnest(p.style_tags) as tag
    from public.profiles p
    where p.school_id = public.my_school_id()
    union
    select l.user_id, unnest(i.style_tags)
    from public.likes l
    join public.items i on i.id = l.item_id
    join public.profiles p on p.id = l.user_id
    where p.school_id = public.my_school_id()
  ),
  mine as (
    select tag from person_tags where id = auth.uid()
  ),
  scores as (
    select pe.id,
      (select count(*) from (select tag from person_tags t where t.id = pe.id intersect select tag from mine) s) as shared,
      (select count(*) from (select tag from person_tags t where t.id = pe.id union select tag from mine) a) as total
    from people pe
  )
  select id, round(100.0 * shared / total)::integer
  from scores
  where shared > 0
  order by 2 desc, shared desc
  limit least(max_people, 50);
$$;

-- Public numbers for a profile at my school.
create or replace function public.profile_stats(person uuid)
returns table (swap_count bigint, followers bigint, following bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.swap_requests s
      where s.status = 'completed' and person in (s.requester_id, s.owner_id)),
    (select count(*) from public.follows f where f.followee_id = person),
    (select count(*) from public.follows f where f.follower_id = person)
  where exists (
    select 1 from public.profiles p
    where p.id = person and p.school_id = public.my_school_id()
  );
$$;

-- Trigger-only functions: not callable over the API.
revoke execute on function public.check_profile_fields() from public, anon, authenticated;
revoke execute on function public.stamp_new_message() from public, anon, authenticated;

-- Helpers: signed-in users only.
revoke execute on function public.trending_items(integer, integer) from public, anon;
revoke execute on function public.style_twins(integer) from public, anon;
revoke execute on function public.profile_stats(uuid) from public, anon;
grant execute on function public.trending_items(integer, integer) to authenticated;
grant execute on function public.style_twins(integer) to authenticated;
grant execute on function public.profile_stats(uuid) to authenticated;
