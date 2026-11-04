-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_find_delete.owner', gen_random_uuid()::text, true),
       set_config('test_find_delete.other', gen_random_uuid()::text, true),
       set_config('test_find_delete.free', gen_random_uuid()::text, true),
       set_config('test_find_delete.picked', gen_random_uuid()::text, true),
       set_config('test_find_delete.rated', gen_random_uuid()::text, true),
       set_config('test_find_delete.pick', gen_random_uuid()::text, true),
       set_config('test_find_delete.post', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'find-delete-' || id || '@example.com'
from unnest(array[current_setting('test_find_delete.owner'),
                  current_setting('test_find_delete.other')]) as id;
insert into public.entities (id, category_id, created_by, name)
select entity_id::uuid, c.id, current_setting('test_find_delete.owner')::uuid, 'Find delete test'
from public.entity_categories c
cross join unnest(array[current_setting('test_find_delete.free'),
                        current_setting('test_find_delete.picked'),
                        current_setting('test_find_delete.rated')]) as entity_id
where c.slug = 'place';
insert into public.picks (id, author_id, title)
values (current_setting('test_find_delete.pick')::uuid,
        current_setting('test_find_delete.owner')::uuid, 'Find reference');
insert into public.pick_items (pick_id, entity_id, position)
values (current_setting('test_find_delete.pick')::uuid,
        current_setting('test_find_delete.picked')::uuid, 1);
insert into public.posts (id, author_id, post_type, entity_id)
values (current_setting('test_find_delete.post')::uuid,
        current_setting('test_find_delete.owner')::uuid, 'SHARE',
        current_setting('test_find_delete.rated')::uuid);
insert into public.entity_ratings (entity_id, author_id, post_id, score)
values (current_setting('test_find_delete.rated')::uuid,
        current_setting('test_find_delete.owner')::uuid,
        current_setting('test_find_delete.post')::uuid, 4);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_find_delete.other'), true);
do $$
declare affected integer;
begin
  delete from public.entities where id = current_setting('test_find_delete.free')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user deleted the find'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_find_delete.owner'), true);
do $$
declare affected integer; referenced text;
begin
  foreach referenced in array array['picked', 'rated'] loop
    begin
      delete from public.entities where id = current_setting('test_find_delete.' || referenced)::uuid;
      raise exception 'Referenced find was deleted: %', referenced;
    exception when foreign_key_violation then null; end;
  end loop;
  delete from public.entities where id = current_setting('test_find_delete.free')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Find owner could not delete an unreferenced find'; end if;
  delete from public.entities where id = current_setting('test_find_delete.free')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated deletion affected an unexpected row'; end if;
end;
$$;
select 'Find delete checks passed' as result;
rollback;
