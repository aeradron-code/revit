-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_pick_unfollow.author', gen_random_uuid()::text, true),
       set_config('test_pick_unfollow.follower', gen_random_uuid()::text, true),
       set_config('test_pick_unfollow.other', gen_random_uuid()::text, true),
       set_config('test_pick_unfollow.pick', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'pick-unfollow-' || id || '@example.com'
from unnest(array[current_setting('test_pick_unfollow.author'),
                  current_setting('test_pick_unfollow.follower'),
                  current_setting('test_pick_unfollow.other')]) as id;
insert into public.picks (id, author_id, title)
values (current_setting('test_pick_unfollow.pick')::uuid,
        current_setting('test_pick_unfollow.author')::uuid, 'Pick unfollow test');
insert into public.pick_follows (user_id, pick_id)
values (current_setting('test_pick_unfollow.follower')::uuid,
        current_setting('test_pick_unfollow.pick')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_pick_unfollow.other'), true);
do $$
declare affected integer;
begin
  delete from public.pick_follows where user_id = current_setting('test_pick_unfollow.follower')::uuid
    and pick_id = current_setting('test_pick_unfollow.pick')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user removed the Pick follow'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_pick_unfollow.follower'), true);
do $$
declare affected integer;
begin
  delete from public.pick_follows where user_id = current_setting('test_pick_unfollow.follower')::uuid
    and pick_id = current_setting('test_pick_unfollow.pick')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Follower could not remove the Pick follow'; end if;
  delete from public.pick_follows where user_id = current_setting('test_pick_unfollow.follower')::uuid
    and pick_id = current_setting('test_pick_unfollow.pick')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated unfollow affected an unexpected row'; end if;
end;
$$;
select 'Pick unfollow checks passed' as result;
rollback;
