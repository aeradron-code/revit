-- Ask ratings are distinct from Share ratings and never affect an entity's
-- global average. One user can rate an Ask once.
create table public.ratings (
  rater_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rater_id, post_id)
);
create index ratings_by_post_idx on public.ratings (post_id, rater_id);
create trigger ratings_set_updated_at before update on public.ratings
  for each row execute function private.set_updated_at();

alter table public.ratings enable row level security;
revoke all on public.ratings from public, anon, authenticated;
grant select, insert, delete on public.ratings to authenticated;
grant update (score) on public.ratings to authenticated;
create policy "Authenticated users can view Ask ratings"
  on public.ratings for select to authenticated using (true);
create policy "Users can rate accessible Ask posts"
  on public.ratings for insert to authenticated with check (
    rater_id = (select auth.uid()) and exists (
      select 1 from public.posts p where p.id = ratings.post_id
        and p.post_type = 'ASK' and (p.forum_id is null or exists (
          select 1 from public.forum_memberships m
          where m.forum_id = p.forum_id and m.user_id = (select auth.uid())
        ))
    )
  );
create policy "Users can update their accessible Ask ratings"
  on public.ratings for update to authenticated
  using (rater_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = ratings.post_id and p.post_type = 'ASK'
      and (p.forum_id is null or exists (select 1 from public.forum_memberships m
        where m.forum_id = p.forum_id and m.user_id = (select auth.uid())))
  ))
  with check (rater_id = (select auth.uid()));
create policy "Users can delete their accessible Ask ratings"
  on public.ratings for delete to authenticated
  using (rater_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = ratings.post_id and p.post_type = 'ASK'
      and (p.forum_id is null or exists (select 1 from public.forum_memberships m
        where m.forum_id = p.forum_id and m.user_id = (select auth.uid())))
  ));

-- These tables deliberately have no client write grants. The Share operation
-- below creates the post and exactly one score in the same transaction.
create table public.entity_ratings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null unique references public.posts (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, entity_id)
);
create index entity_ratings_by_entity_idx on public.entity_ratings (entity_id, post_id);
create trigger entity_ratings_set_updated_at before update on public.entity_ratings
  for each row execute function private.set_updated_at();

create table public.forum_share_ratings (
  post_id uuid primary key references public.posts (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.entity_ratings enable row level security;
alter table public.forum_share_ratings enable row level security;
revoke all on public.entity_ratings, public.forum_share_ratings from public, anon, authenticated;
grant select on public.entity_ratings, public.forum_share_ratings to authenticated;
create policy "Authenticated users can view global entity ratings"
  on public.entity_ratings for select to authenticated using (true);
create policy "Authenticated users can view forum Share ratings"
  on public.forum_share_ratings for select to authenticated
  using (exists (select 1 from public.posts p
    where p.id = forum_share_ratings.post_id and p.forum_id is not null));

create function private.create_share_post_with_media(
  p_post_id uuid, p_entity_id uuid, p_score smallint, p_body text default null,
  p_media_paths text[] default array[]::text[], p_forum_id uuid default null
)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  result public.posts;
  path text;
  position_value integer := 0;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in to share a rating.';
  end if;
  if p_post_id is null or p_entity_id is null or p_score is null
    or p_score not between 1 and 5 or p_media_paths is null or cardinality(p_media_paths) > 3 then
    raise exception using errcode = '23514', message = 'Provide a find, a rating from 1 to 5, and up to three images.';
  end if;
  if p_forum_id is not null and not exists (
    select 1 from public.forum_memberships m
    where m.forum_id = p_forum_id and m.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Join this forum before posting.';
  end if;
  insert into public.posts (id, author_id, post_type, entity_id, forum_id, body)
  values (p_post_id, current_user_id, 'SHARE', p_entity_id, p_forum_id, nullif(btrim(p_body), ''))
  returning * into result;
  if p_forum_id is null then
    insert into public.entity_ratings (author_id, entity_id, post_id, score)
    values (current_user_id, p_entity_id, p_post_id, p_score);
  else
    insert into public.forum_share_ratings (post_id, score) values (p_post_id, p_score);
  end if;
  foreach path in array p_media_paths loop
    position_value := position_value + 1;
    if path is null or left(path, length(current_user_id::text || '/' || p_post_id::text || '/'))
      <> current_user_id::text || '/' || p_post_id::text || '/'
      or not exists (select 1 from storage.objects where bucket_id = 'post-images' and name = path)
    then
      raise exception using errcode = '23514', message = 'Choose an uploaded image belonging to this post.';
    end if;
    insert into public.post_media (post_id, storage_path, position)
    values (p_post_id, path, position_value);
  end loop;
  return result;
end;
$$;
revoke all on function private.create_share_post_with_media(uuid, uuid, smallint, text, text[], uuid)
  from public, anon, authenticated;
grant execute on function private.create_share_post_with_media(uuid, uuid, smallint, text, text[], uuid)
  to authenticated;

create function public.create_share_post_with_media(
  p_post_id uuid, p_entity_id uuid, p_score smallint, p_body text default null,
  p_media_paths text[] default array[]::text[], p_forum_id uuid default null
)
returns public.posts language sql security invoker set search_path = '' as $$
  select private.create_share_post_with_media(p_post_id, p_entity_id, p_score, p_body, p_media_paths, p_forum_id);
$$;
revoke all on function public.create_share_post_with_media(uuid, uuid, smallint, text, text[], uuid)
  from public, anon, authenticated;
grant execute on function public.create_share_post_with_media(uuid, uuid, smallint, text, text[], uuid)
  to authenticated;

create function private.update_share_rating_post(p_post_id uuid, p_score smallint, p_body text default null)
returns public.posts language plpgsql security definer set search_path = '' as $$
declare
  result public.posts;
begin
  if (select auth.uid()) is null or p_score is null or p_score not between 1 and 5 then
    raise exception using errcode = '23514', message = 'Provide a rating from 1 to 5.';
  end if;
  update public.posts set body = nullif(btrim(p_body), '')
    where id = p_post_id and author_id = (select auth.uid())
      and post_type = 'SHARE' and forum_id is null
    returning * into result;
  if not found then
    raise exception using errcode = '42501', message = 'You can only update your own global Share.';
  end if;
  update public.entity_ratings set score = p_score
    where post_id = p_post_id and author_id = (select auth.uid());
  if not found then
    raise exception using errcode = '23514', message = 'The Share has no matching entity rating.';
  end if;
  return result;
end;
$$;
revoke all on function private.update_share_rating_post(uuid, smallint, text) from public, anon, authenticated;
grant execute on function private.update_share_rating_post(uuid, smallint, text) to authenticated;
create function public.update_share_rating_post(p_post_id uuid, p_score smallint, p_body text default null)
returns public.posts language sql security invoker set search_path = '' as $$
  select private.update_share_rating_post(p_post_id, p_score, p_body);
$$;
revoke all on function public.update_share_rating_post(uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.update_share_rating_post(uuid, smallint, text) to authenticated;

create function public.get_ask_rating_summary(target_post_id uuid)
returns table (average_score numeric, rating_count bigint)
language sql stable security invoker set search_path = '' as $$
  select round(avg(score), 1), count(*) from public.ratings where post_id = target_post_id;
$$;
create function public.get_entity_rating_summary(p_entity_id uuid)
returns table (average_score numeric, rating_count bigint)
language sql stable security invoker set search_path = '' as $$
  select round(avg(score), 1), count(*) from public.entity_ratings where entity_id = p_entity_id;
$$;
revoke all on function public.get_ask_rating_summary(uuid), public.get_entity_rating_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.get_ask_rating_summary(uuid), public.get_entity_rating_summary(uuid)
  to authenticated;
