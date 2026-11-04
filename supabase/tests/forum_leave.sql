-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_forum_leave.owner', gen_random_uuid()::text, true),
       set_config('test_forum_leave.member', gen_random_uuid()::text, true),
       set_config('test_forum_leave.other', gen_random_uuid()::text, true),
       set_config('test_forum_leave.forum', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'forum-leave-' || id || '@example.com'
from unnest(array[current_setting('test_forum_leave.owner'),
                  current_setting('test_forum_leave.member'),
                  current_setting('test_forum_leave.other')]) as id;
insert into public.forums (id, owner_id, slug, name)
values (current_setting('test_forum_leave.forum')::uuid,
        current_setting('test_forum_leave.owner')::uuid,
        'forum-leave-' || current_setting('test_forum_leave.forum'), 'Forum leave test');
insert into public.forum_memberships (forum_id, user_id)
values (current_setting('test_forum_leave.forum')::uuid,
        current_setting('test_forum_leave.member')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_forum_leave.other'), true);
do $$
declare affected integer;
begin
  delete from public.forum_memberships where forum_id = current_setting('test_forum_leave.forum')::uuid
    and user_id = current_setting('test_forum_leave.member')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user removed the membership'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_forum_leave.owner'), true);
do $$
declare affected integer;
begin
  delete from public.forum_memberships where forum_id = current_setting('test_forum_leave.forum')::uuid
    and user_id = current_setting('test_forum_leave.owner')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Forum owner was able to leave'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_forum_leave.member'), true);
do $$
declare affected integer;
begin
  delete from public.forum_memberships where forum_id = current_setting('test_forum_leave.forum')::uuid
    and user_id = current_setting('test_forum_leave.member')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Member could not leave the forum'; end if;
  delete from public.forum_memberships where forum_id = current_setting('test_forum_leave.forum')::uuid
    and user_id = current_setting('test_forum_leave.member')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated leave affected an unexpected row'; end if;
end;
$$;
select 'Forum leave checks passed' as result;
rollback;
