-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_rating_delete.author', gen_random_uuid()::text, true),
       set_config('test_rating_delete.rater', gen_random_uuid()::text, true),
       set_config('test_rating_delete.other', gen_random_uuid()::text, true),
       set_config('test_rating_delete.post', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'rating-delete-' || id || '@example.com'
from unnest(array[current_setting('test_rating_delete.author'),
                  current_setting('test_rating_delete.rater'),
                  current_setting('test_rating_delete.other')]) as id;
insert into public.posts (id, author_id, post_type, body)
values (current_setting('test_rating_delete.post')::uuid,
        current_setting('test_rating_delete.author')::uuid, 'ASK', 'Delete test');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_rating_delete.rater'), true);
select public.save_ask_rating(current_setting('test_rating_delete.post')::uuid,
  current_setting('test_rating_delete.rater')::uuid, 4::smallint);

select set_config('request.jwt.claim.sub', current_setting('test_rating_delete.other'), true);
do $$
declare affected integer;
begin
  delete from public.ratings where post_id = current_setting('test_rating_delete.post')::uuid
    and rater_id = current_setting('test_rating_delete.rater')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user deleted the rating'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_rating_delete.rater'), true);
do $$
declare affected integer;
begin
  delete from public.ratings where post_id = current_setting('test_rating_delete.post')::uuid
    and rater_id = current_setting('test_rating_delete.rater')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Rating owner could not delete the rating'; end if;
  delete from public.ratings where post_id = current_setting('test_rating_delete.post')::uuid
    and rater_id = current_setting('test_rating_delete.rater')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated deletion affected an unexpected row'; end if;
end;
$$;
select 'Ask rating delete checks passed' as result;
rollback;
