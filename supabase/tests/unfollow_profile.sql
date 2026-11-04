-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_unfollow.follower', gen_random_uuid()::text, true),
       set_config('test_unfollow.target', gen_random_uuid()::text, true),
       set_config('test_unfollow.other', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'unfollow-test-' || id || '@example.com'
from unnest(array[current_setting('test_unfollow.follower'),
                  current_setting('test_unfollow.target'),
                  current_setting('test_unfollow.other')]) as id;
insert into public.follows (follower_id, following_id)
values (current_setting('test_unfollow.follower')::uuid,
        current_setting('test_unfollow.target')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_unfollow.other'), true);
do $$
declare affected integer;
begin
  delete from public.follows where follower_id = current_setting('test_unfollow.follower')::uuid
    and following_id = current_setting('test_unfollow.target')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user removed the follow'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_unfollow.follower'), true);
do $$
declare affected integer;
begin
  delete from public.follows where follower_id = current_setting('test_unfollow.follower')::uuid
    and following_id = current_setting('test_unfollow.target')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Follower could not remove their follow'; end if;
  delete from public.follows where follower_id = current_setting('test_unfollow.follower')::uuid
    and following_id = current_setting('test_unfollow.target')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated unfollow affected an unexpected row'; end if;
end;
$$;
select 'Unfollow checks passed' as result;
rollback;
