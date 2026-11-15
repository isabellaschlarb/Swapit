-- 0004 is reserved for the separately prepared accepted-swap deletion fix.
-- Explicit, opt-in wanted items; never derive mutual interest from style tags.
create table public.swap_preferences (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  school_id uuid not null default public.my_school_id() references public.schools(id),
  category text not null check (category in ('Tops','Bottoms','Dresses','Outerwear','Shoes','Accessories','Other')),
  size text check (size in ('XS','S','M','L','XL','XXL','One size')),
  details text not null default '' check (char_length(details) <= 300)
);
alter table public.swap_preferences enable row level security;
revoke all on public.swap_preferences from public, anon, authenticated;
grant select, insert, delete on public.swap_preferences to authenticated;
grant update (category, size, details) on public.swap_preferences to authenticated;
create policy "Read campus swap preferences" on public.swap_preferences for select to authenticated
  using (school_id = (select public.my_school_id()));
create policy "Create my swap preferences" on public.swap_preferences for insert to authenticated
  with check (user_id = (select auth.uid()) and school_id = (select public.my_school_id()));
create policy "Update my swap preferences" on public.swap_preferences for update to authenticated
  using (user_id = (select auth.uid()) and school_id = (select public.my_school_id()))
  with check (user_id = (select auth.uid()) and school_id = (select public.my_school_id()));
create policy "Remove my swap preferences" on public.swap_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

-- Durable, atomic limits across server instances: one search per 30 seconds,
-- at most 30/day per signed-in student. No caller-supplied user IDs or clocks.
create table public.mutual_match_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_request timestamptz not null,
  request_day date not null,
  requests integer not null
);
alter table public.mutual_match_limits enable row level security;
revoke all on public.mutual_match_limits from public, anon, authenticated;
create function public.claim_mutual_match_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
  if auth.uid() is null or public.my_school_id() is null then return false; end if;
  insert into public.mutual_match_limits as limits (user_id, last_request, request_day, requests)
  values (auth.uid(), now(), (now() at time zone 'UTC')::date, 1)
  on conflict (user_id) do update set
    last_request = now(), request_day = excluded.request_day,
    requests = case when limits.request_day = excluded.request_day then limits.requests + 1 else 1 end
  where limits.last_request <= now() - interval '30 seconds'
    and (limits.request_day <> excluded.request_day or limits.requests < 30)
  returning user_id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.claim_mutual_match_request() from public, anon;
grant execute on function public.claim_mutual_match_request() to authenticated;
