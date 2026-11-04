-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_share_boundary.owner', gen_random_uuid()::text, true),
       set_config('test_share_boundary.viewer', gen_random_uuid()::text, true),
       set_config('test_share_boundary.forum', gen_random_uuid()::text, true),
       set_config('test_share_boundary.entity', gen_random_uuid()::text, true),
       set_config('test_share_boundary.global', gen_random_uuid()::text, true),
       set_config('test_share_boundary.forum_post', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'share-boundary-' || id || '@example.com'
from unnest(array[current_setting('test_share_boundary.owner'),
                  current_setting('test_share_boundary.viewer')]) as id;
insert into public.forums (id, owner_id, slug, name)
values (current_setting('test_share_boundary.forum')::uuid,
        current_setting('test_share_boundary.owner')::uuid,
        'share-boundary-' || current_setting('test_share_boundary.forum'), 'Share boundary test');
insert into public.entities (id, category_id, created_by, name)
select current_setting('test_share_boundary.entity')::uuid, id,
       current_setting('test_share_boundary.owner')::uuid, 'Share boundary test find'
from public.entity_categories where slug = 'place';

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_share_boundary.owner'), true);
select public.create_share_post_with_media(current_setting('test_share_boundary.global')::uuid,
  current_setting('test_share_boundary.entity')::uuid, 2::smallint, 'Global Share');
select public.create_share_post_with_media(current_setting('test_share_boundary.forum_post')::uuid,
  current_setting('test_share_boundary.entity')::uuid, 5::smallint, 'Forum Share',
  array[]::text[], current_setting('test_share_boundary.forum')::uuid);

select set_config('request.jwt.claim.sub', current_setting('test_share_boundary.viewer'), true);
do $$
begin
  if not exists (select 1 from public.get_entity_rating_summary(current_setting('test_share_boundary.entity')::uuid)
                 where average_score = 2 and rating_count = 1) then
    raise exception 'Forum Share changed the global find rating';
  end if;
  if exists (select 1 from public.posts where entity_id = current_setting('test_share_boundary.entity')::uuid
             and post_type = 'SHARE' and forum_id is null
             and id = current_setting('test_share_boundary.forum_post')::uuid) then
    raise exception 'Forum Share appeared in global find results';
  end if;
  if exists (select 1 from public.get_home_feed(51, null, null, 'for-you')
             where id = current_setting('test_share_boundary.forum_post')::uuid) then
    raise exception 'Forum Share appeared in Home';
  end if;
  if exists (select 1 from public.search_discover_posts('Forum Share', 50)
             where id = current_setting('test_share_boundary.forum_post')::uuid) then
    raise exception 'Forum Share appeared in Discover';
  end if;
end;
$$;
select 'Forum Share boundary checks passed' as result;
rollback;
