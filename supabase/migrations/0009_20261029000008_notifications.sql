create type public.notification_type as enum (
  'FOLLOW', 'ASK_RATING', 'COMMENT', 'REPLY', 'FORUM_JOIN', 'FORUM_POST'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  notification_type public.notification_type not null,
  -- Forum activity exposes the forum as its destination, never a post or
  -- comment in the global activity list. Source IDs support cascade cleanup.
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  forum_id uuid references public.forums (id) on delete cascade,
  source_post_id uuid references public.posts (id) on delete cascade,
  source_comment_id uuid references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_no_self_notification check (recipient_id <> actor_id),
  constraint notifications_forum_destination check (
    forum_id is null or (post_id is null and comment_id is null)
  ),
  constraint notifications_destination check (
    (notification_type = 'FOLLOW' and post_id is null and comment_id is null and forum_id is null)
    or (notification_type = 'ASK_RATING' and (post_id is not null or forum_id is not null))
    or (notification_type in ('COMMENT', 'REPLY') and
      ((post_id is not null and comment_id is not null and forum_id is null)
        or (forum_id is not null and post_id is null and comment_id is null)))
    or (notification_type in ('FORUM_JOIN', 'FORUM_POST') and forum_id is not null)
  )
);

create index notifications_by_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_by_recipient_idx
  on public.notifications (recipient_id, created_at desc, id desc) where read_at is null;
create index notifications_by_source_post_idx on public.notifications (source_post_id)
  where source_post_id is not null;
create index notifications_by_source_comment_idx on public.notifications (source_comment_id)
  where source_comment_id is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select (id, recipient_id, actor_id, notification_type, post_id, comment_id,
  forum_id, created_at, read_at) on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "Users can view their own notifications"
  on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Users can update their own notification read state"
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- Only trigger functions can call this helper; users cannot create arbitrary
-- notifications. No forum post content is copied into activity records.
create function private.create_notification(
  p_recipient uuid, p_actor uuid, p_type public.notification_type,
  p_post uuid default null, p_comment uuid default null, p_forum uuid default null
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then return; end if;
  insert into public.notifications (
    recipient_id, actor_id, notification_type, post_id, comment_id, forum_id,
    source_post_id, source_comment_id
  ) values (
    p_recipient, p_actor, p_type,
    case when p_forum is null then p_post else null end,
    case when p_forum is null then p_comment else null end,
    p_forum, p_post, p_comment
  );
end;
$$;
revoke all on function private.create_notification(uuid, uuid, public.notification_type, uuid, uuid, uuid)
  from public, anon, authenticated;

create function private.notify_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.create_notification(new.following_id, new.follower_id, 'FOLLOW');
  return new;
end;
$$;
create function private.notify_ask_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_author uuid; target_forum uuid;
begin
  select p.author_id, p.forum_id into target_author, target_forum
    from public.posts p where p.id = new.post_id;
  perform private.create_notification(target_author, new.rater_id, 'ASK_RATING', new.post_id, null, target_forum);
  return new;
end;
$$;
create function private.notify_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid; target_forum uuid; activity_type public.notification_type;
begin
  select p.forum_id into target_forum from public.posts p where p.id = new.post_id;
  if new.parent_id is null then
    select p.author_id into recipient from public.posts p where p.id = new.post_id;
    activity_type := 'COMMENT';
  else
    select c.author_id into recipient from public.comments c where c.id = new.parent_id;
    activity_type := 'REPLY';
  end if;
  perform private.create_notification(recipient, new.author_id, activity_type, new.post_id, new.id, target_forum);
  return new;
end;
$$;
create function private.notify_forum_join()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  select f.owner_id into recipient from public.forums f where f.id = new.forum_id;
  perform private.create_notification(recipient, new.user_id, 'FORUM_JOIN', null, null, new.forum_id);
  return new;
end;
$$;
create function private.notify_forum_post()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  if new.forum_id is not null then
    select f.owner_id into recipient from public.forums f where f.id = new.forum_id;
    perform private.create_notification(recipient, new.author_id, 'FORUM_POST', new.id, null, new.forum_id);
  end if;
  return new;
end;
$$;
revoke all on function private.notify_follow(), private.notify_ask_rating(),
  private.notify_comment(), private.notify_forum_join(), private.notify_forum_post()
  from public, anon, authenticated;

create trigger follows_create_notification after insert on public.follows
  for each row execute function private.notify_follow();
create trigger ratings_create_notification after insert on public.ratings
  for each row execute function private.notify_ask_rating();
create trigger comments_create_notification after insert on public.comments
  for each row execute function private.notify_comment();
create trigger forum_memberships_create_notification after insert on public.forum_memberships
  for each row execute function private.notify_forum_join();
create trigger forum_posts_create_notification after insert on public.posts
  for each row execute function private.notify_forum_post();

-- Cursor-based activity read. Only explicitly granted columns are returned.
create function public.get_notifications_page(
  p_limit integer default 30,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid, recipient_id uuid, actor_id uuid, notification_type public.notification_type,
  post_id uuid, comment_id uuid, forum_id uuid, created_at timestamptz, read_at timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select n.id, n.recipient_id, n.actor_id, n.notification_type, n.post_id,
    n.comment_id, n.forum_id, n.created_at, n.read_at
  from public.notifications n
  where n.recipient_id = (select auth.uid())
    and ((p_before_created_at is null and p_before_id is null)
      or (p_before_created_at is not null and p_before_id is not null
        and (n.created_at, n.id) < (p_before_created_at, p_before_id)))
  order by n.created_at desc, n.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 51));
$$;
revoke all on function public.get_notifications_page(integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_notifications_page(integer, timestamptz, uuid)
  to authenticated;
