-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_comment_delete.author', gen_random_uuid()::text, true),
       set_config('test_comment_delete.other', gen_random_uuid()::text, true),
       set_config('test_comment_delete.post', gen_random_uuid()::text, true),
       set_config('test_comment_delete.comment', gen_random_uuid()::text, true),
       set_config('test_comment_delete.reply', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'comment-delete-' || id || '@example.com'
from unnest(array[current_setting('test_comment_delete.author'),
                  current_setting('test_comment_delete.other')]) as id;
insert into public.posts (id, author_id, post_type, body)
values (current_setting('test_comment_delete.post')::uuid,
        current_setting('test_comment_delete.author')::uuid, 'ASK', 'Comment delete test');
insert into public.comments (id, post_id, author_id, body)
values (current_setting('test_comment_delete.comment')::uuid,
        current_setting('test_comment_delete.post')::uuid,
        current_setting('test_comment_delete.author')::uuid, 'Parent comment');
insert into public.comments (id, post_id, author_id, parent_id, body)
values (current_setting('test_comment_delete.reply')::uuid,
        current_setting('test_comment_delete.post')::uuid,
        current_setting('test_comment_delete.other')::uuid,
        current_setting('test_comment_delete.comment')::uuid, 'Reply');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_comment_delete.other'), true);
do $$
declare affected integer;
begin
  delete from public.comments where id = current_setting('test_comment_delete.comment')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user deleted the comment'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_comment_delete.author'), true);
do $$
declare affected integer;
begin
  delete from public.comments where id = current_setting('test_comment_delete.comment')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Comment owner could not delete the comment'; end if;
  if exists (select 1 from public.comments where id = current_setting('test_comment_delete.reply')::uuid) then
    raise exception 'Deleting a parent did not delete its reply';
  end if;
  delete from public.comments where id = current_setting('test_comment_delete.comment')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated deletion affected an unexpected row'; end if;
end;
$$;
select 'Comment delete checks passed' as result;
rollback;
