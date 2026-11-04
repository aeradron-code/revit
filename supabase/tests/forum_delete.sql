-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_forum_delete.owner', gen_random_uuid()::text, true),
       set_config('test_forum_delete.other', gen_random_uuid()::text, true),
       set_config('test_forum_delete.forum', gen_random_uuid()::text, true),
       set_config('test_forum_delete.post', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'forum-delete-' || id || '@example.com'
from unnest(array[current_setting('test_forum_delete.owner'),
                  current_setting('test_forum_delete.other')]) as id;
insert into public.forums (id, owner_id, slug, name)
values (current_setting('test_forum_delete.forum')::uuid,
        current_setting('test_forum_delete.owner')::uuid,
        'forum-delete-' || current_setting('test_forum_delete.forum'), 'Forum delete test');
insert into public.posts (id, author_id, post_type, forum_id, body)
values (current_setting('test_forum_delete.post')::uuid,
        current_setting('test_forum_delete.owner')::uuid, 'ASK',
        current_setting('test_forum_delete.forum')::uuid, 'Forum post');
-- Metadata-only fixture: no Storage object is created or deleted.
insert into public.post_media (post_id, storage_path, position)
values (current_setting('test_forum_delete.post')::uuid,
        current_setting('test_forum_delete.owner') || '/' ||
        current_setting('test_forum_delete.post') || '/1.jpg', 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_forum_delete.other'), true);
do $$
declare affected integer;
begin
  delete from public.forums where id = current_setting('test_forum_delete.forum')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user deleted the forum'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_forum_delete.owner'), true);
do $$
declare affected integer;
begin
  delete from public.forums where id = current_setting('test_forum_delete.forum')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Forum owner could not delete the forum'; end if;
  if exists (select 1 from public.posts where id = current_setting('test_forum_delete.post')::uuid) then
    raise exception 'Forum post did not cascade';
  end if;
  delete from public.forums where id = current_setting('test_forum_delete.forum')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated deletion affected an unexpected row'; end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from private.post_media_cleanup_queue
      where storage_path = current_setting('test_forum_delete.owner') || '/' ||
        current_setting('test_forum_delete.post') || '/1.jpg') <> 1 then
    raise exception 'Forum post media was not queued for cleanup';
  end if;
end;
$$;
select 'Forum delete checks passed' as result;
rollback;
