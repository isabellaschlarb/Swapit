-- Disposable LOCAL Supabase only, after migrations. Run with psql -v ON_ERROR_STOP=1.
-- No shared database. All fixtures roll back; an assertion fails the command.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end;
$$;
do $$
declare
  campus uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  changed integer;
begin
  insert into public.schools(id, name, email_domain) values
    (campus, 'Matching Test', 'matching-test.invalid'), (other, 'Other Test', 'matching-other.invalid');
  insert into auth.users(id, email) values
    (a, 'a@matching-test.invalid'), (b, 'b@matching-test.invalid'), (c, 'c@matching-other.invalid');
  insert into public.swap_preferences(user_id, school_id, category) values
    (b, campus, 'Tops'), (c, other, 'Shoes');
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform pg_temp.assert_true((select count(*) = 1 from public.swap_preferences), 'school isolation');
  insert into public.swap_preferences(category, size, details) values ('Outerwear', 'M', 'Rain jacket');
  update public.swap_preferences set details = 'Warm jacket' where user_id = a;
  perform pg_temp.assert_true((select details = 'Warm jacket' from public.swap_preferences where user_id = a), 'owner can save');
  update public.swap_preferences set details = 'forged' where user_id = b;
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'cannot edit another student');
  delete from public.swap_preferences where user_id = b;
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed = 0, 'cannot delete another student');
  begin
    insert into public.swap_preferences(user_id, school_id, category) values (c, campus, 'Tops');
    raise exception 'FAIL: forged owner allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.swap_preferences set school_id = other where user_id = a;
    raise exception 'FAIL: school change allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.swap_preferences set details = repeat('x', 301) where user_id = a;
    raise exception 'FAIL: oversized details allowed';
  exception when check_violation then null; end;
  perform pg_temp.assert_true(public.claim_mutual_match_request(), 'first search allowed');
  perform pg_temp.assert_true(not public.claim_mutual_match_request(), 'immediate repeat denied');
  begin
    update public.mutual_match_limits set requests = 0 where user_id = a;
    raise exception 'FAIL: quota tampering allowed';
  exception when insufficient_privilege then null; end;
  reset role;
  update public.mutual_match_limits set last_request = now() - interval '31 seconds', requests = 30 where user_id = a;
  set local role authenticated;
  perform pg_temp.assert_true(not public.claim_mutual_match_request(), 'daily maximum enforced');
  reset role;
  update public.mutual_match_limits set last_request = now() - interval '1 day', request_day = (now() at time zone 'UTC')::date - 1 where user_id = a;
  set local role authenticated;
  perform pg_temp.assert_true(public.claim_mutual_match_request(), 'new day resets quota');
  delete from public.swap_preferences where user_id = a;
  perform pg_temp.assert_true(not exists(select 1 from public.swap_preferences where user_id = a), 'owner can opt out');
  reset role;
  perform pg_temp.assert_true(not has_function_privilege('anon', 'public.claim_mutual_match_request()', 'execute'), 'anon cannot claim searches');
  perform pg_temp.assert_true(not has_table_privilege('anon', 'public.swap_preferences', 'select'), 'anon cannot read preferences');
  perform pg_temp.assert_true(not has_table_privilege('authenticated', 'public.swap_preferences', 'truncate'), 'cannot bypass RLS with truncate');
end;
$$;
rollback;
