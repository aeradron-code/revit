-- Run after migration 0015 in a transaction that will be rolled back.
select set_config('test_resource.user', gen_random_uuid()::text, true),
       set_config('test_resource.other', gen_random_uuid()::text, true),
       set_config('test_resource.forum', gen_random_uuid()::text, true),
       set_config('test_resource.find', gen_random_uuid()::text, true),
       set_config('test_resource.forum_op', gen_random_uuid()::text, true),
       set_config('test_resource.find_op', gen_random_uuid()::text, true);
insert into auth.users (id, email)
select id::uuid, 'resource-idempotency-' || id || '@example.com'
from unnest(array[current_setting('test_resource.user'), current_setting('test_resource.other')]) id;
insert into storage.objects(bucket_id, name) values
  ('forum-images', current_setting('test_resource.user') || '/' || current_setting('test_resource.forum') || '/image.jpg'),
  ('entity-images', current_setting('test_resource.user') || '/' || current_setting('test_resource.find') || '.jpg');
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_resource.user'), true);
do $$
declare
  forum_id uuid := current_setting('test_resource.forum')::uuid;
  find_id uuid := current_setting('test_resource.find')::uuid;
  forum_op uuid := current_setting('test_resource.forum_op')::uuid;
  find_op uuid := current_setting('test_resource.find_op')::uuid;
  slug text := 'test-' || forum_id;
  a public.forums; b public.forums; c public.entities; d public.entities;
begin
  a := public.create_forum_idempotent(forum_op, forum_id, ' Test forum ', slug, null, '', auth.uid()::text || '/' || forum_id || '/image.jpg');
  b := public.create_forum_idempotent(forum_op, forum_id, 'Test forum', slug, null, '', auth.uid()::text || '/' || forum_id || '/image.jpg');
  if a.id <> b.id or not exists(select 1 from public.forum_memberships m where m.forum_id = a.id and m.user_id = auth.uid()) then
    raise exception 'Forum retry or owner membership failed';
  end if;
  c := public.create_find_idempotent(find_op, find_id, 'place', 'Test find', null,
    'https://example.invalid/storage/v1/object/public/entity-images/' || auth.uid()::text || '/' || find_id || '.jpg',
    auth.uid()::text || '/' || find_id || '.jpg');
  d := public.create_find_idempotent(find_op, find_id, 'PLACE', ' Test find ', null,
    'https://example.invalid/storage/v1/object/public/entity-images/' || auth.uid()::text || '/' || find_id || '.jpg',
    auth.uid()::text || '/' || find_id || '.jpg');
  if c.id <> d.id then raise exception 'Find retry failed'; end if;
  if (select resource_id from public.lookup_resource_creation(forum_op, 'FORUM')) is distinct from forum_id
    or (select resource_id from public.lookup_resource_creation(find_op, 'FIND')) is distinct from find_id
    or exists(select 1 from public.lookup_resource_creation(forum_op, 'FIND')) then
    raise exception 'Resource lookup failed';
  end if;
  begin
    perform public.create_forum_idempotent(forum_op, forum_id, 'Changed', slug);
    raise exception 'Changed forum accepted';
  exception when check_violation then null; end;
  begin
    perform public.create_find_idempotent(find_op, find_id, 'place', 'Changed');
    raise exception 'Changed find accepted';
  exception when check_violation then null; end;
  begin
    perform public.create_find_idempotent(forum_op, gen_random_uuid(), 'place', 'Other kind');
    raise exception 'Cross-kind operation reuse accepted';
  exception when check_violation then null; end;
  begin
    perform public.create_ask_post_idempotent(forum_op, gen_random_uuid(), 'Other post');
    raise exception 'Forum operation reused for an Ask';
  exception when check_violation then null; end;
  begin
    perform public.create_forum_idempotent(gen_random_uuid(), gen_random_uuid(), 'Missing image', 'missing-' || gen_random_uuid(),
      null, '', auth.uid()::text || '/missing/image.jpg');
    raise exception 'Missing image accepted';
  exception when check_violation then null; end;
  begin
    perform public.create_find_idempotent(gen_random_uuid(), gen_random_uuid(), 'place', 'Missing image', null,
      'https://example.invalid/storage/v1/object/public/entity-images/' || auth.uid()::text || '/missing.jpg', auth.uid()::text || '/missing.jpg');
    raise exception 'Missing find image accepted';
  exception when check_violation then null; end;
end;
$$;
select set_config('request.jwt.claim.sub', current_setting('test_resource.other'), true);
do $$ begin
  if exists(select 1 from public.lookup_resource_creation(current_setting('test_resource.forum_op')::uuid, 'FORUM'))
     or exists(select 1 from public.lookup_resource_creation(current_setting('test_resource.find_op')::uuid, 'FIND')) then
    raise exception 'Another user could look up an operation';
  end if;
end; $$;
select set_config('request.jwt.claim.sub', current_setting('test_resource.user'), true);
do $$
declare
  forum_id uuid := current_setting('test_resource.forum')::uuid;
  find_id uuid := current_setting('test_resource.find')::uuid;
  forum_op uuid := current_setting('test_resource.forum_op')::uuid;
  find_op uuid := current_setting('test_resource.find_op')::uuid;
begin
  delete from public.forums f where f.id = forum_id;
  delete from public.entities e where e.id = find_id;
  begin
    perform public.create_forum_idempotent(forum_op, forum_id, 'Test forum', 'test-' || forum_id, null, '',
      auth.uid()::text || '/' || forum_id || '/image.jpg');
    raise exception 'Deleted forum recreated';
  exception when no_data_found then null; end;
  begin
    perform public.create_find_idempotent(find_op, find_id, 'place', 'Test find', null,
      'https://example.invalid/storage/v1/object/public/entity-images/' || auth.uid()::text || '/' || find_id || '.jpg',
      auth.uid()::text || '/' || find_id || '.jpg');
    raise exception 'Deleted find recreated';
  exception when no_data_found then null; end;
end;
$$;
select 'Resource creation idempotency checks passed' as result;
