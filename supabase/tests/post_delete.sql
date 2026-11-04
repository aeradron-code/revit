-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_post_delete.author', gen_random_uuid()::text, true),
       set_config('test_post_delete.other', gen_random_uuid()::text, true),
       set_config('test_post_delete.post', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'post-delete-' || id || '@example.com'
from unnest(array[current_setting('test_post_delete.author'),
                  current_setting('test_post_delete.other')]) as id;
insert into public.posts (id, author_id, post_type, body)
values (current_setting('test_post_delete.post')::uuid,
        current_setting('test_post_delete.author')::uuid, 'ASK', 'Post delete test');
-- A metadata-only fixture; no Storage object is created or deleted.
insert into public.post_media (post_id, storage_path, position)
values (current_setting('test_post_delete.post')::uuid,
        current_setting('test_post_delete.author') || '/' ||
        current_setting('test_post_delete.post') || '/1.jpg', 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_post_delete.other'), true);
do $$
declare affected integer;
begin
  delete from public.posts where id = current_setting('test_post_delete.post')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user deleted the post'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_post_delete.author'), true);
do $$
declare affected integer;
begin
  delete from public.posts where id = current_setting('test_post_delete.post')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Post author could not delete the post'; end if;
  if exists (select 1 from public.post_media where post_id = current_setting('test_post_delete.post')::uuid) then
    raise exception 'Post media metadata did not cascade';
  end if;
  delete from public.posts where id = current_setting('test_post_delete.post')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated deletion affected an unexpected row'; end if;
end;
$$;

reset role;
do $$
begin
  if (select count(*) from private.post_media_cleanup_queue
      where storage_path = current_setting('test_post_delete.author') || '/' ||
        current_setting('test_post_delete.post') || '/1.jpg') <> 1 then
    raise exception 'Deleted post media was not queued for cleanup';
  end if;
end;
$$;
select 'Post delete checks passed' as result;
rollback;
