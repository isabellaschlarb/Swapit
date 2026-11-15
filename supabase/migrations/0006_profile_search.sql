-- Separate from matching (0005) and the prepared deletion guard (0004).
-- Existing rows are not rewritten. These constraints apply to new writes;
-- review existing data before later validating the NOT VALID constraints.
alter table public.profiles add column avatar_path text;
alter table public.profiles add constraint profile_display_name_length
  check (display_name is null or char_length(btrim(display_name)) between 2 and 40) not valid;
alter table public.profiles add constraint profile_bio_length
  check (bio is null or char_length(bio) <= 300) not valid;
alter table public.profiles add constraint profile_avatar_owner_path
  check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));
grant update (avatar_path) on public.profiles to authenticated;

-- Pictures are campus-readable only through authenticated storage requests.
-- Immutable unique uploads avoid overwriting a currently displayed photo.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']);
create policy "Read campus profile photos" on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and (select public.my_school_id()) is not null and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or exists (
    select 1 from public.profiles p
    where p.avatar_path = name and p.school_id = (select public.my_school_id())
  )
));
create policy "Upload my profile photos" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.school_id = (select public.my_school_id())));
-- No UPDATE policy: profile photos are replaced with new object names.
create policy "Delete my unused profile photos" on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.profiles p where p.avatar_path = name));

-- Parameterized literal substring search; no AI, dynamic SQL, wildcard input,
-- definer privileges, or access to auth.users. Existing school RLS still applies.
-- Return one extra row to determine whether a next page exists.
create function public.search_campus_items(
  query_text text default '', category_filter text default null, tag_filter text default null,
  after_created_at timestamptz default null, after_id uuid default null, owner_filter uuid default null
) returns setof public.items
language plpgsql stable security invoker set search_path = '' as $$
begin
  if query_text is null or char_length(query_text) > 100
    or ((after_created_at is null) <> (after_id is null)) then
    raise exception 'Invalid search parameters' using errcode = '22023';
  end if;
  return query select i.* from public.items i
  where i.school_id = (select public.my_school_id()) and i.status = 'available'
    and (owner_filter is null or i.owner_id = owner_filter)
    and (category_filter is null or i.category = category_filter)
    and (tag_filter is null or tag_filter = any(i.style_tags))
    and (btrim(query_text) = '' or strpos(lower(concat_ws(' ', i.title, i.description, i.category, array_to_string(i.style_tags, ' '))), lower(btrim(query_text))) > 0)
    and (after_created_at is null or (i.created_at, i.id) < (after_created_at, after_id))
  order by i.created_at desc, i.id desc limit 25;
end;
$$;
create function public.search_campus_people(
  query_text text default '', after_name text default null, after_id uuid default null
) returns table(id uuid, display_name text, bio text, avatar_url text, avatar_path text, style_tags text[])
language plpgsql stable security invoker set search_path = '' as $$
begin
  if query_text is null or char_length(query_text) > 100
    or ((after_name is null) <> (after_id is null)) then
    raise exception 'Invalid search parameters' using errcode = '22023';
  end if;
  return query select p.id, p.display_name, p.bio, p.avatar_url, p.avatar_path, p.style_tags
  from public.profiles p
  where p.school_id = (select public.my_school_id()) and p.display_name is not null
    and btrim(p.display_name) <> ''
    and strpos(lower(p.display_name), lower(btrim(query_text))) > 0
    and (after_name is null or (lower(p.display_name), p.id) > (lower(after_name), after_id))
  order by lower(p.display_name), p.id limit 25;
end;
$$;
revoke all on function public.search_campus_items(text,text,text,timestamptz,uuid,uuid) from public, anon;
revoke all on function public.search_campus_people(text,text,uuid) from public, anon;
grant execute on function public.search_campus_items(text,text,text,timestamptz,uuid,uuid) to authenticated;
grant execute on function public.search_campus_people(text,text,uuid) to authenticated;
create index profiles_school_name_id_idx on public.profiles(school_id, lower(display_name), id);
create index profiles_avatar_path_idx on public.profiles(avatar_path) where avatar_path is not null;
create index items_school_available_cursor_idx on public.items(school_id, created_at desc, id desc)
  where status = 'available';
