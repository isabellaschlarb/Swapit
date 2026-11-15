-- =====================================================================
-- Social rules test. Checks the database rules for likes, follows,
-- chat messages, profiles, and the helper functions (0007 + 0008).
--
-- Run it:  npx supabase db query --remote --yes -f supabase/tests/social_rules_test.sql -o table
--
-- SAFE TO RUN ON THE REAL DATABASE: like swap_rules_test.sql, it ends
-- with an error on purpose, which undoes EVERYTHING it did, and prints
-- the report. Look for PASS / FAIL.
-- =====================================================================

-- Run one statement as a signed-in user. expect = null → should work;
-- expect = 'text' → should fail with an error containing that text.
create or replace function pg_temp.check_as(label text, uid uuid, stmt text, expect text default null)
returns text
language plpgsql
as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute stmt;
    execute 'reset role';
  exception when others then
    execute 'reset role';
    if expect is not null and position(lower(expect) in lower(sqlerrm)) > 0 then
      return 'PASS  ' || label || '   [blocked: ' || sqlerrm || ']';
    end if;
    return 'FAIL  ' || label || '   [unexpected error: ' || sqlerrm || ']';
  end;
  if expect is null then
    return 'PASS  ' || label;
  end if;
  return 'FAIL  ' || label || '   [should have been blocked with "' || expect || '"]';
end;
$f$;

-- Run a query as a signed-in user and return its single value as text.
create or replace function pg_temp.value_as(uid uuid, query text)
returns text
language plpgsql
as $f$
declare
  result text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute query into result;
  execute 'reset role';
  return result;
end;
$f$;

create or replace function pg_temp.check_eq(label text, actual text, expected text)
returns text
language sql
as $f$
  select case when actual is not distinct from expected
    then 'PASS  ' || label
    else 'FAIL  ' || label || '   [got ' || coalesce(actual, 'null') || ', expected ' || coalesce(expected, 'null') || ']'
  end;
$f$;

create or replace function pg_temp.social_test_body()
returns void
language plpgsql
as $test$
declare
  r text := '';
  a uuid := gen_random_uuid();  -- owner of the item
  b uuid := gen_random_uuid();  -- requester, same school
  d uuid := gen_random_uuid();  -- same school, not in the swap
  c uuid := gen_random_uuid();  -- other school
  calpoly uuid; other_school uuid; spot uuid; other_spot uuid;
  a_item uuid; b_item uuid; swap uuid; msg uuid;
  storage_base text := 'https://example.supabase.co/storage/v1/object/public/avatars/';
begin
  ---------------------------------------------------------------- setup (as admin)
  select id into calpoly from public.schools where email_domain = 'calpoly.edu';
  select id into spot from public.meetup_spots where school_id = calpoly limit 1;
  insert into public.schools (name, email_domain) values ('Test U', 'swapit-test.invalid') returning id into other_school;
  insert into public.meetup_spots (school_id, name) values (other_school, 'Test spot') returning id into other_spot;

  insert into auth.users (id, email) values
    (a, 'swapit-test-a@calpoly.edu'), (b, 'swapit-test-b@calpoly.edu'),
    (d, 'swapit-test-d@calpoly.edu'), (c, 'swapit-test-c@swapit-test.invalid');
  update public.profiles set display_name = 'Test A', style_tags = '{vintage,y2k}' where id = a;
  update public.profiles set display_name = 'Test B', style_tags = '{vintage}' where id = b;
  update public.profiles set display_name = 'Test D', style_tags = '{athletic}' where id = d;

  insert into public.items (owner_id, title, style_tags) values (a, 'A vintage tee', '{vintage}') returning id into a_item;
  insert into public.items (owner_id, title) values (b, 'B hoodie') returning id into b_item;
  insert into public.swap_requests (requested_item_id, requester_id, owner_id, offered_item_ids, meetup_spot_id, meetup_time)
    values (a_item, b, a, array[b_item], spot, now() + interval '1 day') returning id into swap;

  ---------------------------------------------------------------- likes
  r := r || E'\n-- Likes\n';
  r := r || pg_temp.check_as('B likes A''s item', b,
    format('insert into public.likes (item_id) values (%L)', a_item)) || E'\n';
  r := r || pg_temp.check_as('B can''t like as someone else', b,
    format('insert into public.likes (user_id, item_id) values (%L, %L)', d, a_item), 'row-level security') || E'\n';
  r := r || pg_temp.check_as('Other school can''t like the item', c,
    format('insert into public.likes (item_id) values (%L)', a_item), 'row-level security') || E'\n';
  r := r || pg_temp.check_eq('Likes are private (D sees none of B''s)',
    pg_temp.value_as(d, format('select count(*) from public.likes where user_id = %L', b)), '0') || E'\n';
  r := r || pg_temp.check_eq('Trending shows A''s item with 1 like',
    pg_temp.value_as(d, format('select like_count from public.trending_items() where item_id = %L', a_item)), '1') || E'\n';
  r := r || pg_temp.check_eq('Trending is per school (other school sees nothing)',
    pg_temp.value_as(c, 'select count(*) from public.trending_items()'), '0') || E'\n';

  ---------------------------------------------------------------- follows
  r := r || E'\n-- Follows\n';
  r := r || pg_temp.check_as('B follows A', b,
    format('insert into public.follows (followee_id) values (%L)', a)) || E'\n';
  r := r || pg_temp.check_as('Can''t follow yourself', b,
    format('insert into public.follows (followee_id) values (%L)', b), 'check constraint') || E'\n';
  r := r || pg_temp.check_as('Can''t follow someone at another school', c,
    format('insert into public.follows (followee_id) values (%L)', a), 'row-level security') || E'\n';
  r := r || pg_temp.check_as('Can''t make someone else follow', d,
    format('insert into public.follows (follower_id, followee_id) values (%L, %L)', b, d), 'row-level security') || E'\n';
  r := r || pg_temp.check_eq('A''s follower count is 1',
    pg_temp.value_as(d, format('select followers from public.profile_stats(%L)', a)), '1') || E'\n';
  r := r || pg_temp.check_eq('Other school can''t read A''s stats',
    pg_temp.value_as(c, format('select count(*) from public.profile_stats(%L)', a)), '0') || E'\n';
  r := r || pg_temp.check_eq('Style twins: B matches A',
    pg_temp.value_as(b, format('select (match_pct > 0)::text from public.style_twins() where profile_id = %L', a)), 'true') || E'\n';
  r := r || pg_temp.check_eq('Style twins: no match with D (nothing in common)',
    pg_temp.value_as(b, format('select count(*) from public.style_twins() where profile_id = %L', d)), '0') || E'\n';

  ---------------------------------------------------------------- chat
  r := r || E'\n-- Chat\n';
  r := r || pg_temp.check_as('B sends a message in their swap', b,
    format('insert into public.messages (swap_request_id, body, created_at) values (%L, %L, %L)', swap, 'Hi! Still free?', '2000-01-01')) || E'\n';
  select id into msg from public.messages where swap_request_id = swap;
  r := r || pg_temp.check_eq('Server sets the message time (no back-dating)',
    (select (created_at > now() - interval '1 minute')::text from public.messages where id = msg), 'true') || E'\n';
  r := r || pg_temp.check_eq('A (other person in the swap) can read it',
    pg_temp.value_as(a, format('select count(*) from public.messages where swap_request_id = %L', swap)), '1') || E'\n';
  r := r || pg_temp.check_eq('D (same school, not in the swap) can''t read it',
    pg_temp.value_as(d, format('select count(*) from public.messages where swap_request_id = %L', swap)), '0') || E'\n';
  r := r || pg_temp.check_as('D can''t send in someone else''s swap', d,
    format('insert into public.messages (swap_request_id, body) values (%L, %L)', swap, 'hey'), 'row-level security') || E'\n';
  r := r || pg_temp.check_as('B can''t send as A', b,
    format('insert into public.messages (swap_request_id, sender_id, body) values (%L, %L, %L)', swap, a, 'fake'), 'row-level security') || E'\n';
  r := r || pg_temp.check_as('B tries to edit their message', b,
    format('update public.messages set body = %L where id = %L', 'edited', msg)) || E'\n';
  r := r || pg_temp.check_eq('…message unchanged (no editing)', (select body from public.messages where id = msg), 'Hi! Still free?') || E'\n';
  r := r || pg_temp.check_as('A marks the chat read', a,
    format('insert into public.message_reads (swap_request_id) values (%L)', swap)) || E'\n';
  r := r || pg_temp.check_as('D can''t add a read marker to someone else''s swap', d,
    format('insert into public.message_reads (swap_request_id) values (%L)', swap), 'row-level security') || E'\n';

  ---------------------------------------------------------------- profiles
  r := r || E'\n-- Profiles\n';
  r := r || pg_temp.check_as('B picks a meetup spot on campus', b,
    format('update public.profiles set preferred_meetup_spot_id = %L where id = %L', spot, b)) || E'\n';
  r := r || pg_temp.check_as('B can''t pick another school''s spot', b,
    format('update public.profiles set preferred_meetup_spot_id = %L where id = %L', other_spot, b), 'on your campus') || E'\n';
  r := r || pg_temp.check_as('Avatar in my own folder is OK', b,
    format('update public.profiles set avatar_url = %L where id = %L', storage_base || b || '/me.jpg', b)) || E'\n';
  r := r || pg_temp.check_as('Avatar from a random website is blocked', b,
    format('update public.profiles set avatar_url = %L where id = %L', 'https://evil.example/x.jpg', b), 'through the app') || E'\n';
  r := r || pg_temp.check_as('Avatar from someone else''s folder is blocked', b,
    format('update public.profiles set avatar_url = %L where id = %L', storage_base || a || '/me.jpg', b), 'through the app') || E'\n';

  ---------------------------------------------------------------- done: undo everything
  raise exception E'TEST REPORT (all test data rolled back)%\nTotal: % passed, % failed',
    r,
    (length(r) - length(replace(r, E'\nPASS', ''))) / 5,
    (length(r) - length(replace(r, E'\nFAIL', ''))) / 5;
end;
$test$;

create or replace function pg_temp.run_social_tests()
returns text
language plpgsql
as $f$
declare
  report text;
begin
  begin
    perform pg_temp.social_test_body();
  exception when others then
    report := sqlerrm;
  end;
  return report;
end;
$f$;

select line as report
from unnest(string_to_array(pg_temp.run_social_tests(), E'\n')) as line
where line <> '';
