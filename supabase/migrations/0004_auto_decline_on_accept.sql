-- =====================================================================
-- Swapit — tidy up other requests when a swap is accepted
--
-- When an owner accepts a request, every item in that swap goes on hold.
-- Any OTHER open (pending) request that involves one of those items can
-- never go through, so the database now closes it automatically and
-- leaves a friendly note for the person who sent it:
--
--   - requests FOR one of those items      → 'declined'
--   - requests that OFFER one of those items → 'cancelled'
--     (the requester's own item is now in another swap)
--
-- The note lives in a new column, swap_requests.closed_note. Only the
-- database writes it: users can't set it when sending a request, and
-- they can still only update the status column (see 0003).
-- =====================================================================


-- 1. THE NOTE -----------------------------------------------------------

alter table public.swap_requests add column closed_note text;

-- Never trust a note sent from the app on a new request.
create or replace function public.clear_swap_request_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.closed_note := null;
  return new;
end;
$$;

create trigger swap_requests_clear_note
  before insert on public.swap_requests
  for each row execute function public.clear_swap_request_note();


-- 2. STATUS CHANGES (same as 0003, plus the auto-close step) ------------
--
--   pending  → accepted   owner only; all items must still be available;
--                         every item becomes 'pending' (on hold);
--                         NEW: other open requests for those items close
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

  -- The auto-close step below updates other requests from INSIDE this
  -- trigger (trigger depth > 1). Those changes come from the database,
  -- not a user, so skip the "who are you" checks, but still only allow
  -- closing a pending request. Users can't reach this branch: their own
  -- updates always run at depth 1.
  if pg_trigger_depth() > 1 then
    if old.status = 'pending' and new.status in ('declined', 'cancelled') then
      return new;
    end if;
    raise exception 'This swap can''t go from % to %.', old.status, new.status;
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

      -- Close other open requests FOR any of these items.
      update public.swap_requests
      set status = 'declined',
          closed_note = 'Thanks for your offer! This item just went to another swap, so this request was closed. Plenty more on the feed!'
      where id <> old.id
        and status = 'pending'
        and requested_item_id = any (all_items);

      -- Close other open requests that OFFER any of these items.
      update public.swap_requests
      set status = 'cancelled',
          closed_note = 'One of the items in this offer is now part of another swap, so this request was closed. Feel free to send a new one!'
      where id <> old.id
        and status = 'pending'
        and offered_item_ids && all_items;
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

-- Trigger-only functions: not callable over the API.
revoke execute on function public.clear_swap_request_note() from public, anon, authenticated;
revoke execute on function public.handle_swap_status_change() from public, anon, authenticated;
