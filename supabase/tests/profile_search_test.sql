-- Disposable LOCAL Supabase only, after migrations 0001–0003 and 0006.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/profile_search_test.sql
-- All fixtures roll back. An assertion aborts the command.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end;
$$;
do $$
declare
  campus uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  photo_a text; photo_b text; photo_c text;
  changed integer; first_ids uuid[]; second_ids uuid[]; last_ids uuid[];
  tied_at timestamptz := now() - interval '1 day';
  pivot_name text; person_json jsonb;
begin
  insert into public.schools(id, name, email_domain) values
    (campus, 'Profile Search Test', 'profile-search-test.invalid'),
    (other, 'Other Search Test', 'profile-search-other.invalid');
  insert into auth.users(id, email) values
    (a, 'a@profile-search-test.invalid'), (b, 'b@profile-search-test.invalid'),
    (c, 'c@profile-search-other.invalid');
  update public.profiles set display_name = 'Owner' where id = a;
  update public.profiles set display_name = 'Friend' where id = b;
  update public.profiles set display_name = 'Search Name' where id = c;
  insert into auth.users(id, email)
    select gen_random_uuid(), 'person-' || n || '@profile-search-test.invalid' from generate_series(1, 26) n;
  update public.profiles set display_name = 'Search Name'
    where school_id = campus and id not in (a, b);
  insert into public.items(owner_id, school_id, title, description, category, style_tags, created_at)
    select b, campus, 'Test Jacket ' || n, 'Warm cotton', 'Outerwear', array['vintage'], tied_at
    from generate_series(1, 49) n;
  insert into public.items(owner_id, school_id, title, category, status) values
    (b, campus, 'Test Jacket pending', 'Outerwear', 'pending'),
    (b, campus, 'Test Jacket sold', 'Outerwear', 'sold'),
    (b, campus, 'Test Jacket swapped', 'Outerwear', 'swapped'),
    (c, other, 'Test Jacket private school', 'Outerwear', 'available');
  photo_a := a::text || '/' || gen_random_uuid()::text || '.png';
  photo_b := b::text || '/' || gen_random_uuid()::text || '.png';
  photo_c := c::text || '/' || gen_random_uuid()::text || '.png';
  insert into storage.objects(bucket_id, name) values ('profile-photos', photo_b), ('profile-photos', photo_c);
  insert into storage.objects(bucket_id, name) values ('profile-photos', b::text || '/' || gen_random_uuid()::text || '.png');
  update public.profiles set avatar_path = photo_b where id = b;
  update public.profiles set avatar_path = photo_c where id = c;
  perform pg_temp.assert_true((select not public and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg','image/png','image/webp'] from storage.buckets where id = 'profile-photos'), 'private bucket configuration');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set display_name = 'Edited Owner', bio = 'Public bio' where id = a;
  perform pg_temp.assert_true((select display_name = 'Edited Owner' from public.profiles where id = a), 'owner can edit name/bio');
  update public.profiles set bio = 'forged' where id = b;
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'cannot edit another profile');
  begin
    update public.profiles set school_id = other where id = a;
    raise exception 'FAIL: school mutation allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set bio = repeat('x', 301) where id = a;
    raise exception 'FAIL: oversized bio allowed';
  exception when check_violation then null; end;
  begin
    update public.profiles set display_name = ' ' where id = a;
    raise exception 'FAIL: blank display name allowed';
  exception when check_violation then null; end;
  begin
    update public.profiles set avatar_path = photo_b where id = a;
    raise exception 'FAIL: another owner photo reference allowed';
  exception when check_violation then null; end;
  insert into storage.objects(bucket_id, name) values ('profile-photos', photo_a);
  update public.profiles set avatar_path = photo_a where id = a;
  perform pg_temp.assert_true((select count(*) = 2 from storage.objects where bucket_id = 'profile-photos'), 'campus photo isolation and unpublished upload privacy');
  begin
    insert into storage.objects(bucket_id, name) values ('profile-photos', b::text || '/' || gen_random_uuid()::text || '.png');
    raise exception 'FAIL: another owner upload allowed';
  exception when insufficient_privilege then null; end;
  delete from storage.objects where bucket_id = 'profile-photos' and name = photo_b;
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'cannot delete another owner photo');
  delete from storage.objects where bucket_id = 'profile-photos' and name = photo_a;
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'cannot delete active photo');
  update storage.objects set name = a::text || '/' || gen_random_uuid()::text || '.png' where bucket_id = 'profile-photos' and name = photo_a;
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'cannot overwrite profile photo');
  update public.profiles set avatar_path = null where id = a;
  delete from storage.objects where bucket_id = 'profile-photos' and name = photo_a;
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 1, 'can clean up unused own photo');

  perform pg_temp.assert_true(not exists(select 1 from public.profiles where id = c), 'profile school RLS');
  perform pg_temp.assert_true(not exists(select 1 from public.items where owner_id = c), 'listing school RLS');
  perform pg_temp.assert_true(not exists(select 1 from public.search_campus_items(owner_filter => c)), 'public closet school isolation');
  perform pg_temp.assert_true(not exists(select 1 from public.search_campus_items(query_text => 'Test Jacket') where status <> 'available'), 'unavailable search exclusion');
  perform pg_temp.assert_true(exists(select 1 from public.search_campus_items(query_text => 'Warm cotton')), 'description search');
  perform pg_temp.assert_true(exists(select 1 from public.search_campus_items(query_text => 'Outerwear')), 'category text search');
  perform pg_temp.assert_true(exists(select 1 from public.search_campus_items(query_text => 'vintage')), 'tag text search');
  perform pg_temp.assert_true(not exists(select 1 from public.search_campus_items(query_text => '%')), 'wildcard treated literally');
  perform pg_temp.assert_true(not exists(select 1 from public.search_campus_items(query_text => 'Jacket', category_filter => 'Shoes')), 'category filter');
  perform pg_temp.assert_true(not exists(select 1 from public.search_campus_items(query_text => 'Jacket', tag_filter => 'grunge')), 'style filter');
  select array_agg(r.id order by r.created_at desc, r.id desc) into first_ids
    from public.search_campus_items(query_text => 'Jacket', category_filter => 'Outerwear', tag_filter => 'vintage') r;
  perform pg_temp.assert_true(cardinality(first_ids) = 25, 'first listing page plus lookahead');
  select array_agg(r.id order by r.created_at desc, r.id desc) into second_ids
    from public.search_campus_items(query_text => 'Jacket', category_filter => 'Outerwear', tag_filter => 'vintage', after_created_at => tied_at, after_id => first_ids[24]) r;
  select array_agg(r.id order by r.created_at desc, r.id desc) into last_ids
    from public.search_campus_items(query_text => 'Jacket', category_filter => 'Outerwear', tag_filter => 'vintage', after_created_at => tied_at, after_id => second_ids[24]) r;
  perform pg_temp.assert_true(cardinality(second_ids) = 25 and cardinality(last_ids) = 1, 'listing pagination with timestamp ties');
  perform pg_temp.assert_true(not (first_ids[1:24] && second_ids[1:24]) and not (last_ids && second_ids[1:24]), 'no duplicate displayed listings');
  select array_agg(r.id order by lower(r.display_name), r.id) into first_ids from public.search_campus_people(query_text => 'Search Name') r;
  perform pg_temp.assert_true(cardinality(first_ids) = 25, 'people page excludes other school');
  select display_name into pivot_name from public.profiles where id = first_ids[24];
  select array_agg(r.id order by lower(r.display_name), r.id) into second_ids
    from public.search_campus_people(query_text => 'Search Name', after_name => pivot_name, after_id => first_ids[24]) r;
  perform pg_temp.assert_true(cardinality(second_ids) = 2 and not (first_ids[1:24] && second_ids), 'people pagination with duplicate names');
  select to_jsonb(r) into person_json from public.search_campus_people(query_text => 'Edited Owner') r;
  perform pg_temp.assert_true(not (person_json ? 'email') and not (person_json ? 'school_id'), 'public search projection excludes authentication data');
  begin
    perform public.search_campus_items(query_text => repeat('x', 101));
    raise exception 'FAIL: oversized query allowed';
  exception when invalid_parameter_value then null; end;
  reset role;
  delete from auth.users where id = b;
  set local role authenticated;
  perform pg_temp.assert_true(not exists(select 1 from public.profiles where id = b), 'deleted profile absent');
  perform pg_temp.assert_true(not exists(select 1 from public.search_campus_items(owner_filter => b)), 'deleted closet absent');
  reset role;
  perform pg_temp.assert_true(not has_function_privilege('anon', 'public.search_campus_items(text,text,text,timestamptz,uuid,uuid)', 'execute'), 'anonymous listing search denied');
  perform pg_temp.assert_true(not has_function_privilege('anon', 'public.search_campus_people(text,text,uuid)', 'execute'), 'anonymous people search denied');
end;
$$;
rollback;
