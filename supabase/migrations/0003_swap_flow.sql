-- =====================================================================
-- Swapit — swap + buy request flow
--
-- 1. Schools get a timezone (so meetup times show in campus time).
-- 2. Items get a listing type (swap / sell / swap or sell) and a price.
-- 3. Swap requests get a "kind": 'swap' (items + optional cash) or
--    'buy' (cash only).
-- 4. The rules live in the database, so they hold even if the app has
--    a bug or someone calls the API directly:
--      - you can't request your own item, or an item that's not available
--      - you can only offer your own available items
--      - only the owner can accept or decline
--      - accepting puts every item in the swap "on hold" (pending)
--      - cancelling an accepted swap frees the items again
--      - completing marks items as swapped (or sold, for a buy)
-- =====================================================================


-- 1. SCHOOLS: timezone -------------------------------------------------

alter table public.schools
  add column timezone text not null default 'America/Los_Angeles';


-- 2. ITEMS: listing type + asking price ------------------------------

alter table public.items
  add column listing_type text not null default 'swap'
    check (listing_type in ('swap', 'sell', 'swap_or_sell')),
  add column price_cents integer check (price_cents >= 0);

-- Anything for sale needs a price.
alter table public.items
  add constraint items_price_required_to_sell
  check (listing_type = 'swap' or coalesce(price_cents, 0) > 0);

-- New items always start as available.
alter policy "Post my own items" on public.items
  with check (owner_id = (select auth.uid()) and status = 'available');

-- Can't delete an item while it's on hold in an accepted swap.
alter policy "Delete my own items" on public.items
  using (owner_id = (select auth.uid()) and status <> 'pending');

-- Owners can edit item details, but NOT status: status only changes
-- through the swap flow below.
revoke update on public.items from anon, authenticated;
grant update (title, description, category, size, condition, estimated_value_cents,
              style_tags, photo_urls, listing_type, price_cents)
  on public.items to authenticated;


-- 3. SWAP REQUESTS: kind ---------------------------------------------

alter table public.swap_requests
  add column kind text not null default 'swap' check (kind in ('swap', 'buy'));

-- A swap offers at least one item. A buy offers no items, just cash
-- paid by the requester.
alter table public.swap_requests
  add constraint swap_requests_kind_shape check (
    (kind = 'swap' and cardinality(offered_item_ids) > 0)
    or (kind = 'buy' and cardinality(offered_item_ids) = 0
        and cash_amount_cents > 0 and cash_paid_by = 'requester')
  );

-- One open request per person per item.
create unique index swap_requests_one_open_per_item
  on public.swap_requests (requested_item_id, requester_id)
  where status in ('pending', 'accepted');

-- After a request is sent, only its status can change.
revoke update on public.swap_requests from anon, authenticated;
grant update (status) on public.swap_requests to authenticated;

-- The detailed checks moved into the trigger below (it gives clearer
-- error messages). The policy just makes sure you request as yourself.
alter policy "Request a swap" on public.swap_requests
  with check (requester_id = (select auth.uid()));


-- 4a. CHECK NEW REQUESTS -----------------------------------------------

create or replace function public.check_new_swap_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted         public.items;
  my_school      uuid;
  valid_offered  integer;
begin
  select * into wanted from public.items where id = new.requested_item_id;
  if not found then
    raise exception 'That item no longer exists.';
  end if;

  select school_id into my_school from public.profiles where id = new.requester_id;

  if wanted.school_id is distinct from my_school then
    raise exception 'That item isn''t at your school.';
  end if;
  if wanted.owner_id = new.requester_id then
    raise exception 'You can''t request your own item.';
  end if;
  if wanted.status <> 'available' then
    raise exception 'That item isn''t available anymore.';
  end if;

  -- Filled in here, never trusted from the app.
  new.owner_id := wanted.owner_id;
  new.status := 'pending';
  new.created_at := now();

  if new.kind = 'buy' then
    if wanted.listing_type = 'swap' then
      raise exception 'This item is swap only.';
    end if;
    if new.cash_amount_cents <= 0 then
      raise exception 'Enter how much you''ll pay.';
    end if;
    new.offered_item_ids := '{}';
    new.cash_paid_by := 'requester';
  else
    if wanted.listing_type = 'sell' then
      raise exception 'This item is for sale only.';
    end if;

    -- Remove duplicates, then make sure every offered item is mine + available.
    new.offered_item_ids := array(select distinct unnest(new.offered_item_ids));
    if cardinality(new.offered_item_ids) = 0 then
      raise exception 'Pick at least one of your items to offer.';
    end if;

    select count(*) into valid_offered
    from public.items
    where id = any (new.offered_item_ids)
      and owner_id = new.requester_id
      and status = 'available';
    if valid_offered <> cardinality(new.offered_item_ids) then
      raise exception 'You can only offer your own available items.';
    end if;

    if new.cash_amount_cents = 0 then
      new.cash_paid_by := null;
    elsif new.cash_paid_by is null then
      raise exception 'Say who pays the cash difference.';
    end if;
  end if;

  if new.meetup_spot_id is null or not exists (
    select 1 from public.meetup_spots
    where id = new.meetup_spot_id and school_id = my_school
  ) then
    raise exception 'Pick a meetup spot on your campus.';
  end if;
  if new.meetup_time is null or new.meetup_time < now() then
    raise exception 'Pick a meetup time in the future.';
  end if;

  return new;
end;
$$;

create trigger swap_requests_check_new
  before insert on public.swap_requests
  for each row execute function public.check_new_swap_request();


-- 4b. CHECK STATUS CHANGES + UPDATE ITEMS ------------------------------
--
--   pending  → accepted   owner only; all items must still be available;
--                         every item becomes 'pending' (on hold)
--   pending  → declined   owner only
--   pending  → cancelled  either person
--   accepted → cancelled  either person; items become 'available' again
--   accepted → completed  either person; items become 'swapped'
--                         (the requested item becomes 'sold' for a buy)
--   anything else         not allowed

create or replace function public.handle_swap_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := auth.uid();
  all_items uuid[] := array_append(old.offered_item_ids, old.requested_item_id);
  still_available integer;
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'declined') then
    if me is distinct from old.owner_id then
      raise exception 'Only the item''s owner can accept or decline.';
    end if;

    if new.status = 'accepted' then
      -- Lock the items so two swaps can't grab the same item at once.
      perform 1 from public.items where id = any (all_items) for update;

      select count(*) into still_available
      from public.items
      where id = any (all_items) and status = 'available';
      if still_available <> cardinality(all_items) then
        raise exception 'One of the items in this swap isn''t available anymore.';
      end if;

      update public.items set status = 'pending' where id = any (all_items);
    end if;

  elsif new.status = 'cancelled' and old.status in ('pending', 'accepted') then
    if old.status = 'accepted' then
      update public.items set status = 'available'
      where id = any (all_items) and status = 'pending';
    end if;

  elsif old.status = 'accepted' and new.status = 'completed' then
    update public.items
    set status = case
      when id = old.requested_item_id and old.kind = 'buy' then 'sold'
      else 'swapped'
    end
    where id = any (all_items);

  else
    raise exception 'This swap can''t go from % to %.', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger swap_requests_status_change
  before update of status on public.swap_requests
  for each row execute function public.handle_swap_status_change();

-- Trigger-only functions: not callable over the API.
revoke execute on function public.check_new_swap_request() from public, anon, authenticated;
revoke execute on function public.handle_swap_status_change() from public, anon, authenticated;
