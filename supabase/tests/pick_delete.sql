-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_pick_delete.author', gen_random_uuid()::text, true),
       set_config('test_pick_delete.other', gen_random_uuid()::text, true),
       set_config('test_pick_delete.pick', gen_random_uuid()::text, true),
       set_config('test_pick_delete.entity', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'pick-delete-' || id || '@example.com'
from unnest(array[current_setting('test_pick_delete.author'),
                  current_setting('test_pick_delete.other')]) as id;
insert into public.entities (id, category_id, created_by, name)
select current_setting('test_pick_delete.entity')::uuid, id,
       current_setting('test_pick_delete.author')::uuid, 'Pick delete test find'
from public.entity_categories where slug = 'place';
insert into public.picks (id, author_id, title)
values (current_setting('test_pick_delete.pick')::uuid,
        current_setting('test_pick_delete.author')::uuid, 'Pick delete test');
insert into public.pick_items (pick_id, entity_id, position)
values (current_setting('test_pick_delete.pick')::uuid,
        current_setting('test_pick_delete.entity')::uuid, 1);
insert into public.pick_follows (pick_id, user_id)
values (current_setting('test_pick_delete.pick')::uuid,
        current_setting('test_pick_delete.other')::uuid);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_pick_delete.other'), true);
do $$
declare affected integer;
begin
  delete from public.picks where id = current_setting('test_pick_delete.pick')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another user deleted the Pick'; end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_pick_delete.author'), true);
do $$
declare affected integer;
begin
  delete from public.picks where id = current_setting('test_pick_delete.pick')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Pick author could not delete the Pick'; end if;
  delete from public.picks where id = current_setting('test_pick_delete.pick')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated deletion affected an unexpected row'; end if;
end;
$$;

reset role;
do $$
begin
  if exists (select 1 from public.pick_items where pick_id = current_setting('test_pick_delete.pick')::uuid)
    or exists (select 1 from public.pick_follows where pick_id = current_setting('test_pick_delete.pick')::uuid) then
    raise exception 'Pick items or follows did not cascade';
  end if;
  if not exists (select 1 from public.entities where id = current_setting('test_pick_delete.entity')::uuid) then
    raise exception 'Deleting the Pick also deleted its find';
  end if;
end;
$$;
select 'Pick delete checks passed' as result;
rollback;
