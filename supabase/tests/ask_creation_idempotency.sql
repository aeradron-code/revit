-- Run after migration 0012 in an isolated transaction; the runner rolls back.
select set_config('test_ask_create.owner', gen_random_uuid()::text, true),
       set_config('test_ask_create.other', gen_random_uuid()::text, true),
       set_config('test_ask_create.operation', gen_random_uuid()::text, true),
       set_config('test_ask_create.post', gen_random_uuid()::text, true);
insert into auth.users (id, email)
select id::uuid, 'ask-idempotency-' || id || '@example.com'
from unnest(array[current_setting('test_ask_create.owner'), current_setting('test_ask_create.other')]) as id;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_ask_create.owner'), true);
do $$
declare first_post public.posts; retried public.posts;
begin
  first_post := public.create_ask_post_idempotent(current_setting('test_ask_create.operation')::uuid,
    current_setting('test_ask_create.post')::uuid, 'Original');
  retried := public.create_ask_post_idempotent(current_setting('test_ask_create.operation')::uuid,
    current_setting('test_ask_create.post')::uuid, ' Original ');
  if first_post.id <> retried.id or first_post.forum_id is not null then
    raise exception 'Matching retry did not return the normal Ask';
  end if;
  begin
    perform public.create_ask_post_idempotent(current_setting('test_ask_create.operation')::uuid,
      current_setting('test_ask_create.post')::uuid, 'Changed');
    raise exception 'Changed payload was accepted';
  exception when check_violation then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_ask_create.other'), true);
do $$
begin
  begin
    perform public.create_ask_post_idempotent(current_setting('test_ask_create.operation')::uuid,
      current_setting('test_ask_create.post')::uuid, 'Original');
    raise exception 'Other user reused the original post ID';
  exception when unique_violation then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_ask_create.owner'), true);
delete from public.posts where id = current_setting('test_ask_create.post')::uuid;
do $$
begin
  begin
    perform public.create_ask_post_idempotent(current_setting('test_ask_create.operation')::uuid,
      current_setting('test_ask_create.post')::uuid, 'Original');
    raise exception 'Deleted post was recreated';
  exception when no_data_found then null; end;
end;
$$;
select 'Ask creation idempotency checks passed' as result;
