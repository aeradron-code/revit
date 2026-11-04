-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_ask_rollback.owner', gen_random_uuid()::text, true),
       set_config('test_ask_rollback.operation', gen_random_uuid()::text, true),
       set_config('test_ask_rollback.post', gen_random_uuid()::text, true);
insert into auth.users (id, email)
values (current_setting('test_ask_rollback.owner')::uuid,
        'ask-rollback-' || current_setting('test_ask_rollback.owner') || '@example.com');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_ask_rollback.owner'), true);
do $$
begin
  if has_table_privilege('authenticated', 'private.ask_creation_operations', 'select')
    or has_function_privilege('anon', 'public.create_ask_post_idempotent(uuid,uuid,text,text[])', 'execute') then
    raise exception 'Creation ledger or RPC grants are too broad';
  end if;
  begin
    perform public.create_ask_post_idempotent(current_setting('test_ask_rollback.operation')::uuid,
      current_setting('test_ask_rollback.post')::uuid, 'Question', array['not-an-upload']);
    raise exception 'Invalid media path unexpectedly succeeded';
  exception when check_violation then null; end;
end;
$$;

reset role;
do $$
begin
  if exists (select 1 from private.ask_creation_operations
             where user_id = current_setting('test_ask_rollback.owner')::uuid
               and operation_id = current_setting('test_ask_rollback.operation')::uuid)
    or exists (select 1 from public.posts where id = current_setting('test_ask_rollback.post')::uuid) then
    raise exception 'Rejected creation left a ledger entry or post';
  end if;
end;
$$;

set local role authenticated;
select public.create_ask_post_idempotent(current_setting('test_ask_rollback.operation')::uuid,
  current_setting('test_ask_rollback.post')::uuid, 'Question');
do $$
begin
  if (select count(*) from public.posts where id = current_setting('test_ask_rollback.post')::uuid) <> 1 then
    raise exception 'Corrected creation did not succeed';
  end if;
end;
$$;
select 'Ask creation rollback checks passed' as result;
rollback;
