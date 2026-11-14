-- =====================================================================
-- Swapit — security + speed tune-up (from Supabase's database advisor)
--
-- 1. Lock down helper functions so they can't be called directly over
--    the web API. (Triggers still run them automatically.)
-- 2. Rewrite security rules to use (select auth.uid()) instead of
--    auth.uid(). Same meaning, but Postgres works it out once per query
--    instead of once per row, so feeds stay fast as they grow.
-- =====================================================================


-- 1. FUNCTION PERMISSIONS ---------------------------------------------

-- Trigger-only functions: nobody should call these directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_item_school() from public, anon, authenticated;

-- Only signed-in users need "what's my school?" (used inside the rules).
revoke execute on function public.my_school_id() from public, anon;
grant execute on function public.my_school_id() to authenticated;

-- school_id_for_email stays public on purpose: the login page checks
-- an email's school before the person is signed in.


-- 2. FASTER SECURITY RULES ---------------------------------------------

-- profiles
alter policy "See profiles from my school" on public.profiles
  using (school_id = (select public.my_school_id()));

alter policy "Create my own profile" on public.profiles
  with check (
    id = (select auth.uid())
    and school_id = public.school_id_for_email((select auth.jwt()) ->> 'email')
  );

alter policy "Edit my own profile" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "Delete my own profile" on public.profiles
  using (id = (select auth.uid()));

-- items
alter policy "See items from my school" on public.items
  using (school_id = (select public.my_school_id()));

alter policy "Post my own items" on public.items
  with check (owner_id = (select auth.uid()));

alter policy "Edit my own items" on public.items
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

alter policy "Delete my own items" on public.items
  using (owner_id = (select auth.uid()));

-- meetup_spots
alter policy "See meetup spots at my school" on public.meetup_spots
  using (school_id = (select public.my_school_id()));

-- swap_requests
alter policy "See swaps I'm part of" on public.swap_requests
  using ((select auth.uid()) in (requester_id, owner_id));

alter policy "Request a swap" on public.swap_requests
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.items i
      where i.id = requested_item_id
        and i.owner_id = swap_requests.owner_id
        and i.school_id = (select public.my_school_id())
        and i.status = 'available'
    )
    and not exists (
      select 1 from unnest(offered_item_ids) as offered(item_id)
      where not exists (
        select 1 from public.items mine
        where mine.id = offered.item_id and mine.owner_id = (select auth.uid())
      )
    )
    and (
      meetup_spot_id is null
      or exists (
        select 1 from public.meetup_spots m
        where m.id = meetup_spot_id and m.school_id = (select public.my_school_id())
      )
    )
  );

alter policy "Update swaps I'm part of" on public.swap_requests
  using ((select auth.uid()) in (requester_id, owner_id))
  with check ((select auth.uid()) in (requester_id, owner_id));

-- messages
alter policy "See messages in my swaps" on public.messages
  using (
    exists (
      select 1 from public.swap_requests s
      where s.id = swap_request_id and (select auth.uid()) in (s.requester_id, s.owner_id)
    )
  );

alter policy "Send messages in my swaps" on public.messages
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.swap_requests s
      where s.id = swap_request_id and (select auth.uid()) in (s.requester_id, s.owner_id)
    )
  );

-- storage (photo uploads)
alter policy "Upload photos to my own folder" on storage.objects
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy "Update photos in my own folder" on storage.objects
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy "Delete photos in my own folder" on storage.objects
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
