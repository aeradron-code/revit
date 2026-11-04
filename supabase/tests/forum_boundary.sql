-- Run only in an approved test project. All fixture writes are rolled back.
begin;

select set_config('test_forum_boundary.user_id', gen_random_uuid()::text, true),
       set_config('test_forum_boundary.forum_id', gen_random_uuid()::text, true),
       set_config('test_forum_boundary.entity_id', gen_random_uuid()::text, true),
       set_config('test_forum_boundary.global_ask', gen_random_uuid()::text, true),
       set_config('test_forum_boundary.forum_ask', gen_random_uuid()::text, true),
       set_config('test_forum_boundary.global_share', gen_random_uuid()::text, true),
       set_config('test_forum_boundary.forum_share', gen_random_uuid()::text, true);

insert into auth.users (id, email)
values (current_setting('test_forum_boundary.user_id')::uuid,
        'forum-boundary-' || current_setting('test_forum_boundary.user_id') || '@example.com');

insert into public.forums (id, owner_id, slug, name)
values (current_setting('test_forum_boundary.forum_id')::uuid,
        current_setting('test_forum_boundary.user_id')::uuid,
        'boundary-' || current_setting('test_forum_boundary.forum_id'), 'Boundary test');

insert into public.entities (id, category_id, created_by, name)
select current_setting('test_forum_boundary.entity_id')::uuid, id,
       current_setting('test_forum_boundary.user_id')::uuid, 'Boundary test find'
from public.entity_categories where slug = 'place';

select set_config('request.jwt.claim.sub', current_setting('test_forum_boundary.user_id'), true);
set local role authenticated;

select public.create_ask_post_with_media(
  current_setting('test_forum_boundary.global_ask')::uuid, 'boundarytestphrase global');
select public.create_ask_post_with_media(
  current_setting('test_forum_boundary.forum_ask')::uuid, 'boundarytestphrase forum',
  array[]::text[], current_setting('test_forum_boundary.forum_id')::uuid);
select public.create_share_post_with_media(
  current_setting('test_forum_boundary.global_share')::uuid,
  current_setting('test_forum_boundary.entity_id')::uuid, 2::smallint, 'Global rating');
select public.create_share_post_with_media(
  current_setting('test_forum_boundary.forum_share')::uuid,
  current_setting('test_forum_boundary.entity_id')::uuid, 5::smallint, 'Forum rating',
  array[]::text[], current_setting('test_forum_boundary.forum_id')::uuid);

create temporary table forum_boundary_results on commit drop as
select
  (select count(*) = 1 from public.get_home_feed(51, null, null, 'for-you')
    where id = current_setting('test_forum_boundary.global_ask')::uuid) as global_ask_in_home,
  (select count(*) = 0 from public.get_home_feed(51, null, null, 'for-you')
    where id in (current_setting('test_forum_boundary.forum_ask')::uuid,
                 current_setting('test_forum_boundary.forum_share')::uuid)) as forum_posts_excluded_from_home,
  (select count(*) = 1 from public.search_discover_posts('boundarytestphrase', 50)
    where id = current_setting('test_forum_boundary.global_ask')::uuid) as global_ask_in_discovery,
  (select count(*) = 0 from public.search_discover_posts('boundarytestphrase', 50)
    where id = current_setting('test_forum_boundary.forum_ask')::uuid) as forum_ask_excluded_from_discovery,
  (select count(*) = 0 from public.posts
    where author_id = current_setting('test_forum_boundary.user_id')::uuid
      and post_type = 'ASK' and forum_id is null
      and id = current_setting('test_forum_boundary.forum_ask')::uuid) as forum_ask_excluded_from_profile_query,
  (select count(*) = 0 from public.posts
    where entity_id = current_setting('test_forum_boundary.entity_id')::uuid
      and post_type = 'SHARE' and forum_id is null
      and id = current_setting('test_forum_boundary.forum_share')::uuid) as forum_share_excluded_from_find_query,
  (select average_score = 2 and rating_count = 1
    from public.get_entity_rating_summary(current_setting('test_forum_boundary.entity_id')::uuid)) as forum_score_excluded_from_global_summary,
  (select count(*) = 1 from public.posts
    where id = current_setting('test_forum_boundary.forum_ask')::uuid) as forum_post_directly_queryable;

do $$
begin
  if exists (select 1 from forum_boundary_results where not (
    global_ask_in_home and forum_posts_excluded_from_home and
    global_ask_in_discovery and forum_ask_excluded_from_discovery and
    forum_ask_excluded_from_profile_query and forum_share_excluded_from_find_query and
    forum_score_excluded_from_global_summary
  )) then
    raise exception 'A forum/global boundary check failed';
  end if;
end;
$$;
select * from forum_boundary_results;
rollback;
