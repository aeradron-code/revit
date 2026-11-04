-- Run after migration 0013 inside an isolated transaction; the runner rolls back.
select set_config('test_lookup_ask.owner', gen_random_uuid()::text, true),
       set_config('test_lookup_ask.other', gen_random_uuid()::text, true),
       set_config('test_lookup_ask.operation', gen_random_uuid()::text, true),
       set_config('test_lookup_ask.missing', gen_random_uuid()::text, true),
       set_config('test_lookup_ask.post', gen_random_uuid()::text, true);
insert into auth.users (id, email)
select id::uuid, 'lookup-ask-' || id || '@example.com'
from unnest(array[current_setting('test_lookup_ask.owner'), current_setting('test_lookup_ask.other')]) as id;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_lookup_ask.owner'), true);
do $$
begin
  if has_function_privilege('anon', 'public.lookup_ask_creation(uuid)', 'execute') then
    raise exception 'Anonymous role can execute lookup';
  end if;
  if exists (select 1 from public.lookup_ask_creation(current_setting('test_lookup_ask.missing')::uuid)) then
    raise exception 'Unknown operation returned a post';
  end if;
end;
$$;
select public.create_ask_post_idempotent(current_setting('test_lookup_ask.operation')::uuid,
  current_setting('test_lookup_ask.post')::uuid, 'Lookup test');
do $$
begin
  if (select count(*) from public.lookup_ask_creation(current_setting('test_lookup_ask.operation')::uuid)
      where id = current_setting('test_lookup_ask.post')::uuid and forum_id is null) <> 1 then
    raise exception 'Owner could not confirm the created Ask';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_lookup_ask.other'), true);
do $$
begin
  if exists (select 1 from public.lookup_ask_creation(current_setting('test_lookup_ask.operation')::uuid)) then
    raise exception 'Another account could look up the operation';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_lookup_ask.owner'), true);
delete from public.posts where id = current_setting('test_lookup_ask.post')::uuid;
do $$
begin
  if exists (select 1 from public.lookup_ask_creation(current_setting('test_lookup_ask.operation')::uuid)) then
    raise exception 'Deleted post was returned';
  end if;
end;
$$;
select 'Ask creation lookup checks passed' as result;
