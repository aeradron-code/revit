create type public.report_target_type as enum (
  'user', 'post', 'comment', 'entity', 'forum', 'pick'
);
create type public.report_reason as enum (
  'spam', 'harassment', 'inappropriate', 'impersonation', 'other'
);
create type public.report_status as enum ('pending', 'reviewed');

-- Target IDs intentionally have no foreign keys: reports about content or a
-- person remain reviewable if the target deletes their account or content.
-- Reporter deletion removes reports through reporter_id's cascade.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reporter_summary text not null,
  target_type public.report_target_type not null,
  target_id uuid not null,
  target_user_id uuid,
  target_path text,
  target_summary text not null,
  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  constraint reports_details_length check (
    details is null or char_length(details) <= 1000
  ),
  constraint reports_review_fields check (
    (status = 'pending' and reviewed_at is null)
    or (status = 'reviewed' and reviewed_at is not null)
  ),
  constraint reports_unique_reporter_target unique
    (reporter_id, target_type, target_id)
);

create index reports_by_status_created_idx
  on public.reports (status, created_at desc, id desc);

alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;
grant select on public.reports to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.reports to authenticated;

create function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'admin'::public.profile_role
  );
$$;
revoke all on function private.is_admin(uuid) from public, anon, authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

create policy "Reporters and admins can view reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or private.is_admin((select auth.uid())));
create policy "Admins can review reports"
  on public.reports for update to authenticated
  using (private.is_admin((select auth.uid())))
  with check (
    private.is_admin((select auth.uid()))
    and status = 'reviewed'
    and reviewed_at is not null
    and reviewed_by = (select auth.uid())
  );

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);
create index user_blocks_by_blocked_idx on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
create policy "Users can view their blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "Users can block other accounts"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id);
create policy "Users can unblock accounts"
  on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create function private.remove_mutual_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;
revoke all on function private.remove_mutual_follows_on_block()
  from public, anon, authenticated;
create trigger user_blocks_remove_mutual_follows
  after insert on public.user_blocks
  for each row execute function private.remove_mutual_follows_on_block();

create function private.is_blocked_between(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_a is not null and p_user_b is not null and exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;
revoke all on function private.is_blocked_between(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;

-- Blocks hide each other's posts and comments and prevent new follows,
-- comments, replies, and Ask ratings between the involved accounts.
drop policy "Authenticated users can view posts" on public.posts;
create policy "Authenticated users can view posts"
  on public.posts for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    or not private.is_blocked_between((select auth.uid()), author_id)
  );

drop policy "Authenticated users can view Picks" on public.picks;
create policy "Authenticated users can view Picks"
  on public.picks for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    or not private.is_blocked_between((select auth.uid()), author_id)
  );
drop policy "Authenticated users can view Pick items" on public.pick_items;
create policy "Authenticated users can view Pick items"
  on public.pick_items for select to authenticated
  using (exists (select 1 from public.picks p where p.id = pick_items.pick_id));

drop policy "Authenticated users can view comments on accessible posts"
  on public.comments;
create policy "Authenticated users can view comments on accessible posts"
  on public.comments for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    or (
      not private.is_blocked_between((select auth.uid()), author_id)
      and exists (select 1 from public.posts p where p.id = comments.post_id)
    )
  );

drop policy "Users can comment on accessible posts" on public.comments;
create policy "Users can comment on accessible posts"
  on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and not private.is_blocked_between((select auth.uid()), p.author_id)
        and (p.forum_id is null or exists (
          select 1 from public.forum_memberships m
          where m.forum_id = p.forum_id and m.user_id = (select auth.uid())
        ))
    )
    and (parent_id is null or exists (
      select 1 from public.comments parent
      where parent.id = comments.parent_id
        and not private.is_blocked_between((select auth.uid()), parent.author_id)
    ))
  );

drop policy "Users can follow profiles themselves" on public.follows;
create policy "Users can follow profiles themselves"
  on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not private.is_blocked_between((select auth.uid()), following_id)
  );

drop policy "Users can rate accessible Ask posts" on public.ratings;
create policy "Users can rate accessible Ask posts"
  on public.ratings for insert to authenticated with check (
    rater_id = (select auth.uid()) and exists (
      select 1 from public.posts p where p.id = ratings.post_id
        and p.post_type = 'ASK'
        and not private.is_blocked_between((select auth.uid()), p.author_id)
        and (p.forum_id is null or exists (
          select 1 from public.forum_memberships m
          where m.forum_id = p.forum_id and m.user_id = (select auth.uid())
        ))
    )
  );

create function public.submit_content_report(
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason public.report_reason,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_user_id uuid;
  target_summary text;
  target_path text;
  target_forum_id uuid;
  report_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in to report content.';
  end if;
  if p_target_id is null or p_reason is null then
    raise exception using errcode = '23514', message = 'Choose a report reason.';
  end if;
  if p_details is not null and char_length(btrim(p_details)) > 1000 then
    raise exception using errcode = '23514', message = 'Report details are too long.';
  end if;

  case p_target_type
    when 'user' then
      select p.id, '@' || coalesce(p.username, 'unknown') || ' · '
        || coalesce(p.display_name, 'Profile'), null
        into target_user_id, target_summary, target_path
      from public.profiles p where p.id = p_target_id;
    when 'post' then
      select p.author_id, coalesce(nullif(btrim(p.body), ''), 'Post with images'),
        p.forum_id, '/posts/' || p.id::text
        into target_user_id, target_summary, target_forum_id, target_path
      from public.posts p where p.id = p_target_id;
    when 'comment' then
      select c.author_id, c.body, p.forum_id, '/posts/' || p.id::text
        into target_user_id, target_summary, target_forum_id, target_path
      from public.comments c join public.posts p on p.id = c.post_id
      where c.id = p_target_id;
    when 'entity' then
      select e.created_by, e.name || coalesce(' · ' || e.description, ''),
        '/entities/' || e.id::text
        into target_user_id, target_summary, target_path
      from public.entities e where e.id = p_target_id;
    when 'forum' then
      select f.owner_id, f.name || coalesce(' · ' || f.description, ''),
        '/forums/' || f.id::text
        into target_user_id, target_summary, target_path
      from public.forums f where f.id = p_target_id;
    when 'pick' then
      select p.author_id, p.title || coalesce(' · ' || p.description, ''),
        '/picks/' || p.id::text
        into target_user_id, target_summary, target_path
      from public.picks p where p.id = p_target_id;
  end case;

  if target_summary is null then
    raise exception using errcode = 'P0002', message = 'The reported item is unavailable.';
  end if;
  if target_forum_id is not null and not exists (
    select 1 from public.forum_memberships m
    where m.forum_id = target_forum_id and m.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Join the forum to report its content.';
  end if;
  if target_user_id = current_user_id then
    raise exception using errcode = '23514', message = 'You cannot report your own content.';
  end if;

  insert into public.reports (
    reporter_id, reporter_summary, target_type, target_id, target_user_id,
    target_path, target_summary, reason, details
  )
  select current_user_id,
    '@' || coalesce(p.username, 'unknown'), p_target_type, p_target_id,
    target_user_id, target_path, left(target_summary, 1000), p_reason,
    nullif(btrim(p_details), '')
  from public.profiles p where p.id = current_user_id
  on conflict (reporter_id, target_type, target_id) do nothing
  returning id into report_id;

  if report_id is null then
    select r.id into report_id from public.reports r
    where r.reporter_id = current_user_id
      and r.target_type = p_target_type and r.target_id = p_target_id;
  end if;
  return report_id;
end;
$$;
revoke all on function public.submit_content_report(
  public.report_target_type, uuid, public.report_reason, text
) from public, anon, authenticated;
grant execute on function public.submit_content_report(
  public.report_target_type, uuid, public.report_reason, text
) to authenticated;
