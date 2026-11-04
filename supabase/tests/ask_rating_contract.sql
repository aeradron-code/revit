-- Run only in an approved test project. Fixture writes are rolled back.
begin;

select set_config('test_ask_rating.owner', gen_random_uuid()::text, true),
       set_config('test_ask_rating.member', gen_random_uuid()::text, true),
       set_config('test_ask_rating.outsider', gen_random_uuid()::text, true),
       set_config('test_ask_rating.forum', gen_random_uuid()::text, true),
       set_config('test_ask_rating.global_post', gen_random_uuid()::text, true),
       set_config('test_ask_rating.forum_post', gen_random_uuid()::text, true);

insert into auth.users (id, email)
select id::uuid, 'rating-contract-' || id || '@example.com'
from unnest(array[current_setting('test_ask_rating.owner'),
                  current_setting('test_ask_rating.member'),
                  current_setting('test_ask_rating.outsider')]) as id;

insert into public.forums (id, owner_id, slug, name)
values (current_setting('test_ask_rating.forum')::uuid,
        current_setting('test_ask_rating.owner')::uuid,
        'rating-' || current_setting('test_ask_rating.forum'), 'Rating test');
insert into public.forum_memberships (forum_id, user_id)
values (current_setting('test_ask_rating.forum')::uuid,
        current_setting('test_ask_rating.member')::uuid);

select set_config('request.jwt.claim.sub', current_setting('test_ask_rating.owner'), true);
set local role authenticated;
select public.create_ask_post_with_media(current_setting('test_ask_rating.global_post')::uuid, 'Global question');
select public.create_ask_post_with_media(current_setting('test_ask_rating.forum_post')::uuid, 'Forum question',
  array[]::text[], current_setting('test_ask_rating.forum')::uuid);

select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if has_function_privilege('anon', 'public.save_ask_rating(uuid,uuid,smallint)', 'execute') then
    raise exception 'Anonymous role can execute save_ask_rating';
  end if;
  begin
    perform public.save_ask_rating(current_setting('test_ask_rating.global_post')::uuid,
      current_setting('test_ask_rating.member')::uuid, 3::smallint);
    raise exception 'Missing identity unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_ask_rating.member'), true);
select public.save_ask_rating(current_setting('test_ask_rating.global_post')::uuid,
  current_setting('test_ask_rating.member')::uuid, 2::smallint);
select public.save_ask_rating(current_setting('test_ask_rating.global_post')::uuid,
  current_setting('test_ask_rating.member')::uuid, 5::smallint);
select public.save_ask_rating(current_setting('test_ask_rating.forum_post')::uuid,
  current_setting('test_ask_rating.member')::uuid, 4::smallint);

do $$
begin
  if (select count(*) from public.ratings where post_id = current_setting('test_ask_rating.global_post')::uuid
      and rater_id = current_setting('test_ask_rating.member')::uuid and score = 5) <> 1 then
    raise exception 'Global rating insert/update failed';
  end if;
  if (select count(*) from public.ratings where post_id = current_setting('test_ask_rating.forum_post')::uuid
      and rater_id = current_setting('test_ask_rating.member')::uuid and score = 4) <> 1 then
    raise exception 'Forum member rating failed';
  end if;
  begin
    perform public.save_ask_rating(current_setting('test_ask_rating.global_post')::uuid,
      current_setting('test_ask_rating.outsider')::uuid, 3::smallint);
    raise exception 'Mismatched identity unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.save_ask_rating(current_setting('test_ask_rating.global_post')::uuid,
      current_setting('test_ask_rating.member')::uuid, 6::smallint);
    raise exception 'Invalid score unexpectedly succeeded';
  exception when check_violation then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_ask_rating.outsider'), true);
do $$
begin
  begin
    perform public.save_ask_rating(current_setting('test_ask_rating.forum_post')::uuid,
      current_setting('test_ask_rating.outsider')::uuid, 3::smallint);
    raise exception 'Non-member forum rating unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('test_ask_rating.owner'), true);
do $$
begin
  if (select count(*) from public.notifications where recipient_id = current_setting('test_ask_rating.owner')::uuid
      and actor_id = current_setting('test_ask_rating.member')::uuid and notification_type = 'ASK_RATING'
      and (post_id = current_setting('test_ask_rating.global_post')::uuid
           or forum_id = current_setting('test_ask_rating.forum')::uuid)) <> 2 then
    raise exception 'Rating notifications did not match one per inserted rating';
  end if;
end;
$$;

select 'Ask rating contract passed' as result;
rollback;
