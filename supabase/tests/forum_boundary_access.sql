-- Characterizes current access; it does not assert that direct access is desirable.
-- Run only in an approved test project. Fixture writes are rolled back.
begin;
select set_config('test_forum_access.owner', gen_random_uuid()::text, true),
       set_config('test_forum_access.viewer', gen_random_uuid()::text, true),
       set_config('test_forum_access.forum', gen_random_uuid()::text, true),
       set_config('test_forum_access.ask', gen_random_uuid()::text, true),
       set_config('test_forum_access.comment', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'forum-access-' || id || '@example.com'
from unnest(array[current_setting('test_forum_access.owner'),
                  current_setting('test_forum_access.viewer')]) as id;
insert into public.forums (id, owner_id, slug, name)
values (current_setting('test_forum_access.forum')::uuid,
        current_setting('test_forum_access.owner')::uuid,
        'forum-access-' || current_setting('test_forum_access.forum'), 'Forum access test');
insert into public.posts (id, author_id, post_type, forum_id, body)
values (current_setting('test_forum_access.ask')::uuid,
        current_setting('test_forum_access.owner')::uuid, 'ASK',
        current_setting('test_forum_access.forum')::uuid, 'unique-forum-access-test');
insert into public.comments (id, post_id, author_id, body)
values (current_setting('test_forum_access.comment')::uuid,
        current_setting('test_forum_access.ask')::uuid,
        current_setting('test_forum_access.owner')::uuid, 'Forum comment');
insert into public.ratings (post_id, rater_id, score)
values (current_setting('test_forum_access.ask')::uuid,
        current_setting('test_forum_access.owner')::uuid, 4);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test_forum_access.viewer'), true);
select
  exists (select 1 from public.forum_memberships where forum_id = current_setting('test_forum_access.forum')::uuid
          and user_id = current_setting('test_forum_access.viewer')::uuid) as viewer_is_member,
  exists (select 1 from public.posts where id = current_setting('test_forum_access.ask')::uuid) as direct_post_visible,
  exists (select 1 from public.comments where id = current_setting('test_forum_access.comment')::uuid) as direct_comment_visible,
  exists (select 1 from public.ratings where post_id = current_setting('test_forum_access.ask')::uuid) as direct_rating_visible,
  exists (select 1 from public.get_home_feed(51, null, null, 'for-you')
          where id = current_setting('test_forum_access.ask')::uuid) as forum_post_in_home,
  exists (select 1 from public.search_discover_posts('unique-forum-access-test', 50)
          where id = current_setting('test_forum_access.ask')::uuid) as forum_post_in_search,
  exists (select 1 from public.posts where body ilike '%unique-forum-access-test%'
          and forum_id is null and id = current_setting('test_forum_access.ask')::uuid) as forum_post_in_app_discover,
  exists (select 1 from public.posts where author_id = current_setting('test_forum_access.owner')::uuid
          and post_type = 'ASK' and forum_id is null
          and id = current_setting('test_forum_access.ask')::uuid) as forum_post_in_app_profile;
rollback;
