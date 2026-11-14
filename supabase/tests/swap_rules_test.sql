-- =====================================================================
-- Swap rules test. Checks that the database enforces the swap/buy rules.
--
-- Run it:  npx supabase db query --remote --yes -f supabase/tests/swap_rules_test.sql
--
-- SAFE TO RUN ON THE REAL DATABASE: it creates test users/items, runs the
-- checks, then ends with an error on purpose, which undoes EVERYTHING it
-- did. It catches that error and prints the report: look for PASS / FAIL.
-- =====================================================================

-- Helper: run one SQL statement as a signed-in user and check the result.
--   expect = null       → the statement should succeed
--   expect = 'some text' → it should fail with an error containing that text
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

-- Helper: compare a value we read back with what we expected.
create or replace function pg_temp.check_eq(label text, actual text, expected text)
returns text
language sql
as $f$
  select case when actual is not distinct from expected
    then 'PASS  ' || label
    else 'FAIL  ' || label || '   [got ' || coalesce(actual, 'null') || ', expected ' || coalesce(expected, 'null') || ']'
  end;
$f$;

-- Helper: SQL text for "insert a swap/buy request".
create or replace function pg_temp.request_sql(
  item uuid, offered uuid[], cash int, payer text, spot uuid, at timestamptz,
  kind text default 'swap', requester uuid default null)
returns text
language sql
as $f$
  select format(
    'insert into public.swap_requests (requested_item_id, offered_item_ids, cash_amount_cents,
       cash_paid_by, meetup_spot_id, meetup_time, kind%s)
     values (%L, %L, %s, %L, %L, %L, %L%s)',
    case when requester is null then '' else ', requester_id' end,
    item, offered, cash, payer, spot, at, kind,
    case when requester is null then '' else format(', %L', requester) end);
$f$;

create or replace function pg_temp.run_swap_tests()
returns text
language plpgsql
as $test$
declare
  report text;
begin
  -- Everything inside this inner block is undone when it ends with an
  -- error. We catch that error and keep its message: the test report.
  begin
    perform pg_temp.swap_test_body();
  exception when others then
    report := sqlerrm;
  end;
  return report;
end;
$test$;

create or replace function pg_temp.swap_test_body()
returns void
language plpgsql
as $test$
declare
  r text := E'\n';
  calpoly uuid; spot uuid; other_school uuid; other_spot uuid;
  a uuid := gen_random_uuid();  -- owner
  b uuid := gen_random_uuid();  -- requester
  d uuid := gen_random_uuid();  -- second requester
  c uuid := gen_random_uuid();  -- student at a different school
  a_swap uuid; a_sell uuid; a_both uuid; a_hot uuid; a_extra uuid;
  b_item uuid; b_item2 uuid; b_gone uuid; d_item uuid; c_item uuid;
  swap1 uuid; buy1 uuid;
  soon timestamptz := now() + interval '1 day';
  q text;
begin
  ---------------------------------------------------------------- setup (as admin)
  select id into calpoly from public.schools where email_domain = 'calpoly.edu';
  select id into spot from public.meetup_spots where school_id = calpoly limit 1;
  insert into public.schools (name, email_domain) values ('Test U', 'swapit-test.invalid')
    returning id into other_school;
  insert into public.meetup_spots (school_id, name) values (other_school, 'Test spot')
    returning id into other_spot;

  insert into auth.users (id, email) values
    (a, 'swapit-test-a@calpoly.edu'), (b, 'swapit-test-b@calpoly.edu'),
    (d, 'swapit-test-d@calpoly.edu'), (c, 'swapit-test-c@swapit-test.invalid');

  insert into public.items (owner_id, title, listing_type, price_cents) values (a, 'A swap only', 'swap', null) returning id into a_swap;
  insert into public.items (owner_id, title, listing_type, price_cents) values (a, 'A sell only', 'sell', 2000) returning id into a_sell;
  insert into public.items (owner_id, title, listing_type, price_cents) values (a, 'A swap or sell', 'swap_or_sell', 1500) returning id into a_both;
  insert into public.items (owner_id, title, listing_type, price_cents) values (a, 'A popular', 'swap_or_sell', 1000) returning id into a_hot;
  insert into public.items (owner_id, title) values (a, 'A extra') returning id into a_extra;
  insert into public.items (owner_id, title) values (b, 'B tee') returning id into b_item;
  insert into public.items (owner_id, title) values (b, 'B hoodie') returning id into b_item2;
  insert into public.items (owner_id, title, status) values (b, 'B already swapped', 'swapped') returning id into b_gone;
  insert into public.items (owner_id, title) values (d, 'D jacket') returning id into d_item;
  insert into public.items (owner_id, title) values (c, 'C item (other school)') returning id into c_item;

  ---------------------------------------------------------------- items
  r := r || E'\n-- Items\n';
  r := r || pg_temp.check_as('Selling without a price is blocked', a,
    $$insert into public.items (title, listing_type) values ('No price', 'sell')$$,
    'items_price_required_to_sell') || E'\n';
  r := r || pg_temp.check_as('Posting an item as already swapped is blocked', a,
    $$insert into public.items (title, status) values ('Fake', 'swapped')$$,
    'row-level security') || E'\n';
  r := r || pg_temp.check_as('Owner can''t change item status directly', a,
    format('update public.items set status = %L where id = %L', 'sold', a_swap),
    'permission denied') || E'\n';

  ---------------------------------------------------------------- bad requests
  r := r || E'\n-- Requests that must be rejected\n';
  r := r || pg_temp.check_as('Can''t request your own item', b,
    pg_temp.request_sql(b_item, array[b_item2], 0, null, spot, soon), 'your own item') || E'\n';
  r := r || pg_temp.check_as('Can''t buy a swap-only item', b,
    pg_temp.request_sql(a_swap, '{}', 1000, 'requester', spot, soon, 'buy'), 'swap only') || E'\n';
  r := r || pg_temp.check_as('Can''t swap for a sell-only item', b,
    pg_temp.request_sql(a_sell, array[b_item], 0, null, spot, soon), 'for sale only') || E'\n';
  r := r || pg_temp.check_as('Can''t offer someone else''s item', b,
    pg_temp.request_sql(a_swap, array[a_extra], 0, null, spot, soon), 'own available items') || E'\n';
  r := r || pg_temp.check_as('Can''t offer an item that isn''t available', b,
    pg_temp.request_sql(a_swap, array[b_gone], 0, null, spot, soon), 'own available items') || E'\n';
  r := r || pg_temp.check_as('Can''t request an item at another school', c,
    pg_temp.request_sql(a_swap, array[c_item], 0, null, other_spot, soon), 'at your school') || E'\n';
  r := r || pg_temp.check_as('Meetup spot must be on your campus', b,
    pg_temp.request_sql(a_swap, array[b_item], 0, null, other_spot, soon), 'meetup spot') || E'\n';
  r := r || pg_temp.check_as('Meetup time must be in the future', b,
    pg_temp.request_sql(a_swap, array[b_item], 0, null, spot, now() - interval '1 hour'), 'future') || E'\n';
  r := r || pg_temp.check_as('Cash difference needs a payer', b,
    pg_temp.request_sql(a_swap, array[b_item], 1000, null, spot, soon), 'who pays') || E'\n';
  r := r || pg_temp.check_as('Can''t send a request pretending to be someone else', b,
    pg_temp.request_sql(a_swap, array[d_item], 0, null, spot, soon, 'swap', d), 'row-level security') || E'\n';

  ---------------------------------------------------------------- swap: happy path
  r := r || E'\n-- Swap: request → accept → complete\n';
  r := r || pg_temp.check_as('B requests A''s item, offering an item + $10', b,
    pg_temp.request_sql(a_swap, array[b_item], 1000, 'requester', spot, soon)) || E'\n';
  select id into swap1 from public.swap_requests where requested_item_id = a_swap and requester_id = b;
  r := r || pg_temp.check_eq('owner_id filled in by the database', (select owner_id::text from public.swap_requests where id = swap1), a::text) || E'\n';
  r := r || pg_temp.check_as('Duplicate open request is blocked', b,
    pg_temp.request_sql(a_swap, array[b_item2], 0, null, spot, soon), 'duplicate key') || E'\n';
  r := r || pg_temp.check_as('Requester can''t accept their own request', b,
    format('update public.swap_requests set status = %L where id = %L', 'accepted', swap1),
    'only the item''s owner') || E'\n';
  r := r || pg_temp.check_as('Request details can''t be edited after sending', b,
    format('update public.swap_requests set cash_amount_cents = 0 where id = %L', swap1),
    'permission denied') || E'\n';
  r := r || pg_temp.check_as('Outsider''s update changes nothing (hidden by RLS)', c,
    format('update public.swap_requests set status = %L where id = %L', 'cancelled', swap1)) || E'\n';
  r := r || pg_temp.check_eq('…still pending', (select status from public.swap_requests where id = swap1), 'pending') || E'\n';
  r := r || pg_temp.check_as('Owner accepts', a,
    format('update public.swap_requests set status = %L where id = %L', 'accepted', swap1)) || E'\n';
  r := r || pg_temp.check_eq('Requested item is now pending', (select status from public.items where id = a_swap), 'pending') || E'\n';
  r := r || pg_temp.check_eq('Offered item is now pending', (select status from public.items where id = b_item), 'pending') || E'\n';
  r := r || pg_temp.check_as('Owner tries to delete the on-hold item', a,
    format('delete from public.items where id = %L', a_swap)) || E'\n';
  r := r || pg_temp.check_eq('…item still exists', (select count(*)::text from public.items where id = a_swap), '1') || E'\n';
  r := r || pg_temp.check_as('Accepted swap can''t be declined', a,
    format('update public.swap_requests set status = %L where id = %L', 'declined', swap1),
    'can''t go from accepted to declined') || E'\n';
  r := r || pg_temp.check_as('Requester marks complete', b,
    format('update public.swap_requests set status = %L where id = %L', 'completed', swap1)) || E'\n';
  r := r || pg_temp.check_eq('Requested item is swapped', (select status from public.items where id = a_swap), 'swapped') || E'\n';
  r := r || pg_temp.check_eq('Offered item is swapped', (select status from public.items where id = b_item), 'swapped') || E'\n';
  r := r || pg_temp.check_as('Completed swap can''t be cancelled', a,
    format('update public.swap_requests set status = %L where id = %L', 'cancelled', swap1),
    'can''t go from completed to cancelled') || E'\n';

  ---------------------------------------------------------------- buy flow
  r := r || E'\n-- Buy: decline, cancel, accept → cancel, accept → complete\n';
  r := r || pg_temp.check_as('B offers $12 for a swap-or-sell item', b,
    pg_temp.request_sql(a_both, '{}', 1200, 'requester', spot, soon, 'buy')) || E'\n';
  select id into buy1 from public.swap_requests where requested_item_id = a_both and requester_id = b;
  r := r || pg_temp.check_as('Owner declines', a,
    format('update public.swap_requests set status = %L where id = %L', 'declined', buy1)) || E'\n';
  r := r || pg_temp.check_eq('Item still available', (select status from public.items where id = a_both), 'available') || E'\n';

  r := r || pg_temp.check_as('B buys sell-only item for $20', b,
    pg_temp.request_sql(a_sell, '{}', 2000, 'requester', spot, soon, 'buy')) || E'\n';
  select id into buy1 from public.swap_requests where requested_item_id = a_sell and requester_id = b and status = 'pending';
  r := r || pg_temp.check_as('Requester cancels while pending', b,
    format('update public.swap_requests set status = %L where id = %L', 'cancelled', buy1)) || E'\n';

  r := r || pg_temp.check_as('B asks again (allowed after cancelling)', b,
    pg_temp.request_sql(a_sell, '{}', 1800, 'requester', spot, soon, 'buy')) || E'\n';
  select id into buy1 from public.swap_requests where requested_item_id = a_sell and requester_id = b and status = 'pending';
  r := r || pg_temp.check_as('Owner accepts', a,
    format('update public.swap_requests set status = %L where id = %L', 'accepted', buy1)) || E'\n';
  r := r || pg_temp.check_eq('Item is pending', (select status from public.items where id = a_sell), 'pending') || E'\n';
  r := r || pg_temp.check_as('Owner cancels the accepted sale', a,
    format('update public.swap_requests set status = %L where id = %L', 'cancelled', buy1)) || E'\n';
  r := r || pg_temp.check_eq('Item is available again', (select status from public.items where id = a_sell), 'available') || E'\n';

  r := r || pg_temp.check_as('B asks a third time', b,
    pg_temp.request_sql(a_sell, '{}', 2000, 'requester', spot, soon, 'buy')) || E'\n';
  select id into buy1 from public.swap_requests where requested_item_id = a_sell and requester_id = b and status = 'pending';
  r := r || pg_temp.check_as('Owner accepts', a,
    format('update public.swap_requests set status = %L where id = %L', 'accepted', buy1)) || E'\n';
  r := r || pg_temp.check_as('Owner marks complete', a,
    format('update public.swap_requests set status = %L where id = %L', 'completed', buy1)) || E'\n';
  r := r || pg_temp.check_eq('Item is sold', (select status from public.items where id = a_sell), 'sold') || E'\n';

  ---------------------------------------------------------------- two people want one item
  r := r || E'\n-- Two requests for the same item\n';
  r := r || pg_temp.check_as('B requests the popular item', b,
    pg_temp.request_sql(a_hot, array[b_item2], 0, null, spot, soon)) || E'\n';
  r := r || pg_temp.check_as('D requests it too', d,
    pg_temp.request_sql(a_hot, array[d_item], 0, null, spot, soon)) || E'\n';
  r := r || pg_temp.check_as('Owner accepts B', a,
    format('update public.swap_requests set status = %L where requested_item_id = %L and requester_id = %L', 'accepted', a_hot, b)) || E'\n';
  r := r || pg_temp.check_as('Owner can''t also accept D', a,
    format('update public.swap_requests set status = %L where requested_item_id = %L and requester_id = %L', 'accepted', a_hot, d),
    'isn''t available anymore') || E'\n';
  r := r || pg_temp.check_as('B can''t use an on-hold item in a new offer', b,
    pg_temp.request_sql(a_both, array[b_item2], 0, null, spot, soon), 'own available items') || E'\n';

  ---------------------------------------------------------------- done: undo everything
  raise exception E'TEST REPORT (all test data rolled back)%\nTotal: % passed, % failed',
    r,
    (length(r) - length(replace(r, E'\nPASS', ''))) / 5,
    (length(r) - length(replace(r, E'\nFAIL', ''))) / 5;
end;
$test$;

-- Run it and show the report, one line per row.
select line as report
from unnest(string_to_array(pg_temp.run_swap_tests(), E'\n')) as line
where line <> '';
