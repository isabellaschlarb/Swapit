-- =====================================================================
-- Swapit — likes (the heart) + an item color
--
-- 1. likes: one row per (me, item) I've hearted. Likes are private:
--    you only ever see your own. You can only like items you can see
--    (your school), and only as yourself.
-- 2. items.color: free text like "navy" or "cream", filled in by the
--    AI snap-to-list (or typed by the owner).
--
-- Numbered 0007 because 0004 (swap auto-decline), 0005 and 0006 are
-- taken by other open branches.
-- =====================================================================


-- 1. LIKES -------------------------------------------------------------

create table public.likes (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_id    uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index likes_item_idx on public.likes (item_id);

alter table public.likes enable row level security;

create policy "See my own likes"
  on public.likes for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The items subquery runs with MY permissions, so it only finds items
-- at my school (items RLS).
create policy "Like items I can see"
  on public.likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.items i where i.id = item_id)
  );

create policy "Unlike my own likes"
  on public.likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Likes are like/unlike only: no editing, and nothing for logged-out visitors.
revoke all on public.likes from anon;
revoke update on public.likes from authenticated;


-- 2. ITEM COLOR --------------------------------------------------------

alter table public.items
  add column color text check (char_length(color) <= 40);

-- Owners can edit it like the other details (status stays locked, see 0003).
grant update (color) on public.items to authenticated;
