-- Run after migration 0014 inside an isolated transaction; the runner rolls back.
select set_config('test_post_idem.user', gen_random_uuid()::text, true),
       set_config('test_post_idem.other', gen_random_uuid()::text, true),
       set_config('test_post_idem.forum', gen_random_uuid()::text, true),
       set_config('test_post_idem.entity', gen_random_uuid()::text, true),
       set_config('test_post_idem.op', gen_random_uuid()::text, true),
       set_config('test_post_idem.post', gen_random_uuid()::text, true);
insert into auth.users (id, email)
select id::uuid, 'post-idempotency-' || id || '@example.com'
from unnest(array[current_setting('test_post_idem.user'), current_setting('test_post_idem.other')]) as id;
insert into public.forums (id, owner_id, slug, name)
values (current_setting('test_post_idem.forum')::uuid, current_setting('test_post_idem.user')::uuid,
  'post-idem-' || current_setting('test_post_idem.forum'), 'Post idempotency test');
insert into public.entities (id, category_id, created_by, name)
select current_setting('test_post_idem.entity')::uuid, id, current_setting('test_post_idem.user')::uuid, 'Post idempotency find'
from public.entity_categories where slug = 'place';

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_post_idem.user'), true);
do $$
declare kind text; op uuid; post_id uuid; forum_id uuid; entity_id uuid; score smallint; first_result public.posts; second_result public.posts;
begin
  foreach kind in array array['FORUM_ASK', 'FORUM_SHARE', 'GLOBAL_SHARE'] loop
    op := gen_random_uuid(); post_id := gen_random_uuid();
    forum_id := case when kind = 'GLOBAL_SHARE' then null else current_setting('test_post_idem.forum')::uuid end;
    entity_id := case when kind = 'FORUM_ASK' then null else current_setting('test_post_idem.entity')::uuid end;
    score := case when kind = 'FORUM_ASK' then null else 3 end;
    first_result := public.create_post_idempotent(op, post_id, kind, 'Test', array[]::text[], forum_id, entity_id, score);
    perform set_config('test_post_idem.last_op', op::text, true);
    perform set_config('test_post_idem.last_kind', kind, true);
    second_result := public.create_post_idempotent(op, post_id, kind, ' Test ', array[]::text[], forum_id, entity_id, score);
    if first_result.id <> second_result.id or first_result.forum_id is distinct from forum_id then
      raise exception 'Matching retry failed for %', kind;
    end if;
    if (select id from public.lookup_post_creation(op, kind)) is distinct from post_id then
      raise exception 'Lookup failed for %', kind;
    end if;
    if exists (select 1 from public.lookup_post_creation(op, case when kind = 'FORUM_ASK' then 'GLOBAL_SHARE' else 'FORUM_ASK' end)) then
      raise exception 'Lookup exposed a different kind';
    end if;
    begin
      perform public.create_post_idempotent(op, post_id, kind, 'Changed', array[]::text[], forum_id, entity_id, score);
      raise exception 'Changed payload was accepted for %', kind;
    exception when check_violation then null; end;
  end loop;
  op := gen_random_uuid();
  perform public.create_ask_post_idempotent(op, gen_random_uuid(), 'Normal Ask', array[]::text[]);
  begin
    perform public.create_post_idempotent(op, gen_random_uuid(), 'FORUM_ASK', 'Another post', array[]::text[],
      current_setting('test_post_idem.forum')::uuid);
    raise exception 'A normal Ask operation was reused for a forum post';
  exception when check_violation then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_post_idem.other'), true);
do $$
begin
  if exists (select 1 from public.lookup_post_creation(current_setting('test_post_idem.last_op')::uuid,
      current_setting('test_post_idem.last_kind'))) then
    raise exception 'Another user could look up the operation';
  end if;
  begin
    perform public.create_post_idempotent(current_setting('test_post_idem.op')::uuid,
      current_setting('test_post_idem.post')::uuid, 'FORUM_ASK', 'Not a member', array[]::text[],
      current_setting('test_post_idem.forum')::uuid);
    raise exception 'Non-member created a forum post';
  exception when insufficient_privilege then null; end;
end;
$$;
select 'Post creation idempotency checks passed' as result;
