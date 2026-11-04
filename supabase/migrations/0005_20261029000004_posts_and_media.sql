create type public.post_type as enum ('ASK', 'SHARE');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  post_type public.post_type not null,
  entity_id uuid references public.entities (id) on delete restrict,
  forum_id uuid references public.forums (id) on delete cascade,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_length check (body is null or char_length(btrim(body)) between 1 and 2000),
  constraint posts_type_fields check (
    (post_type = 'ASK' and entity_id is null and body is not null)
    or (post_type = 'SHARE' and entity_id is not null)
  )
);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null check (position between 1 and 3),
  alt_text text check (alt_text is null or char_length(btrim(alt_text)) between 1 and 300),
  created_at timestamptz not null default now(),
  constraint post_media_post_position_key unique (post_id, position),
  constraint post_media_path_length check (char_length(storage_path) between 1 and 512)
);

create index posts_by_author_created_at_idx
  on public.posts (author_id, created_at desc, id desc);
create index posts_by_forum_created_at_idx
  on public.posts (forum_id, created_at desc, id desc) where forum_id is not null;
create index posts_public_feed_created_at_idx
  on public.posts (created_at desc, id desc) where forum_id is null;
create index posts_by_entity_created_at_idx
  on public.posts (entity_id, created_at desc, id desc) where entity_id is not null;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function private.set_updated_at();

-- Deletion of a post, its forum, or its author must all enqueue its images.
-- A later trusted worker will remove the objects through the Storage API.
create table private.post_media_cleanup_queue (
  storage_path text primary key,
  queued_at timestamptz not null default now()
);
revoke all on table private.post_media_cleanup_queue from public, anon, authenticated;

create function private.enqueue_deleted_post_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.post_media_cleanup_queue (storage_path)
  values (old.storage_path)
  on conflict (storage_path) do update set queued_at = pg_catalog.now();
  return old;
end;
$$;
revoke all on function private.enqueue_deleted_post_media() from public, anon, authenticated;

create trigger post_media_enqueue_cleanup
  after delete on public.post_media
  for each row execute function private.enqueue_deleted_post_media();

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
revoke all on table public.posts, public.post_media from public, anon, authenticated;
grant select, delete on public.posts to authenticated;
grant update (body) on public.posts to authenticated;
grant select on public.post_media to authenticated;

create policy "Authenticated users can view posts"
  on public.posts for select to authenticated using (true);
create policy "Authors can update their Ask posts"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()) and post_type = 'ASK')
  with check (author_id = (select auth.uid()) and post_type = 'ASK');
create policy "Authors can delete their posts"
  on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));
create policy "Authenticated users can view post media"
  on public.post_media for select to authenticated
  using (exists (select 1 from public.posts where posts.id = post_media.post_id));

-- Only the checked helper can insert Ask posts and their media. Share creation
-- is added alongside its required rating in the next migration.
create function private.create_ask_post_with_media(
  p_post_id uuid,
  p_body text,
  p_media_paths text[] default array[]::text[],
  p_forum_id uuid default null
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
    raise exception using errcode = '42501', message = 'You must be signed in to create a post.';
  end if;
  if p_post_id is null or p_media_paths is null or cardinality(p_media_paths) > 3 then
    raise exception using errcode = '23514', message = 'Provide a post ID and up to three images.';
  end if;
  if p_forum_id is not null and not exists (
    select 1 from public.forum_memberships
    where forum_id = p_forum_id and user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Join this forum before posting.';
  end if;

  insert into public.posts (id, author_id, post_type, forum_id, body)
  values (p_post_id, current_user_id, 'ASK', p_forum_id, nullif(btrim(p_body), ''))
  returning * into result;

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

revoke all on function private.create_ask_post_with_media(uuid, text, text[], uuid)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.create_ask_post_with_media(uuid, text, text[], uuid)
  to authenticated;

-- Exposed wrapper runs with the caller's permissions; the private helper
-- performs the transactional write and validates identity and membership.
create function public.create_ask_post_with_media(
  p_post_id uuid,
  p_body text,
  p_media_paths text[] default array[]::text[],
  p_forum_id uuid default null
)
returns public.posts
language sql
security invoker
set search_path = ''
as $$
  select private.create_ask_post_with_media(p_post_id, p_body, p_media_paths, p_forum_id);
$$;
revoke all on function public.create_ask_post_with_media(uuid, text, text[], uuid)
  from public, anon, authenticated;
grant execute on function public.create_ask_post_with_media(uuid, text, text[], uuid)
  to authenticated;
