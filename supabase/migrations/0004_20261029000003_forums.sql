-- Public forums are readable by authenticated users; participation is
-- restricted to members by the post, comment, and rating migrations.
create table public.forums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text,
  rules text not null default '',
  image_path text,
  cover_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forums_slug_format check (slug ~ '^[a-z][a-z0-9-]{2,62}$'),
  constraint forums_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint forums_description_length check (description is null or char_length(btrim(description)) between 1 and 1000),
  constraint forums_rules_length check (char_length(btrim(rules)) <= 2000),
  constraint forums_image_path_format check (
    image_path is null or image_path ~
      ('^' || owner_id::text || '/' || id::text || '/image\.(jpg|jpeg|png|webp|heic|heif)$')
  ),
  constraint forums_cover_image_path_format check (
    cover_image_path is null or cover_image_path ~
      ('^' || owner_id::text || '/' || id::text || '/cover\.(jpg|jpeg|png|webp|heic|heif)$')
  )
);

create table public.forum_memberships (
  forum_id uuid not null references public.forums (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (forum_id, user_id)
);

create index forums_by_created_at_idx on public.forums (created_at desc, id desc);
create index forum_memberships_by_user_created_at_idx
  on public.forum_memberships (user_id, created_at desc, forum_id desc);

create function private.prepare_forum()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.slug := lower(btrim(new.slug));
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.rules := btrim(new.rules);
  return new;
end;
$$;
revoke all on function private.prepare_forum() from public, anon, authenticated;

create function private.add_forum_owner_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.forum_memberships (forum_id, user_id)
    values (new.id, new.owner_id);
  return new;
end;
$$;
revoke all on function private.add_forum_owner_membership() from public, anon, authenticated;

create trigger forums_prepare
  before insert or update of slug, name, description, rules on public.forums
  for each row execute function private.prepare_forum();
create trigger forums_set_updated_at
  before update on public.forums
  for each row execute function private.set_updated_at();
create trigger forums_add_owner_membership
  after insert on public.forums
  for each row execute function private.add_forum_owner_membership();

alter table public.forums enable row level security;
alter table public.forum_memberships enable row level security;
revoke all on table public.forums, public.forum_memberships from public, anon, authenticated;
grant select, delete on public.forums to authenticated;
grant insert (id, owner_id, slug, name, description, rules, image_path, cover_image_path)
  on public.forums to authenticated;
grant update (slug, name, description, rules, image_path, cover_image_path)
  on public.forums to authenticated;
grant select, insert, delete on public.forum_memberships to authenticated;

create policy "Authenticated users can view forums"
  on public.forums for select to authenticated using (true);
create policy "Users can create their own forums"
  on public.forums for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners can update their forums"
  on public.forums for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners can delete their forums"
  on public.forums for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Authenticated users can view memberships"
  on public.forum_memberships for select to authenticated using (true);
create policy "Users can join forums themselves"
  on public.forum_memberships for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Members can leave forums they do not own"
  on public.forum_memberships for delete to authenticated
  using (
    user_id = (select auth.uid()) and not exists (
      select 1 from public.forums
      where forums.id = forum_memberships.forum_id
        and forums.owner_id = (select auth.uid())
    )
  );

-- The cursor is (created_at, id), in descending order. Pass both cursor
-- fields together, or neither for the first page or an individual forum.
create function public.get_forum_summaries(
  p_forum_id uuid default null,
  p_limit integer default 20,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid, owner_id uuid, slug text, name text, description text, rules text,
  image_path text, cover_image_path text, created_at timestamptz,
  updated_at timestamptz, member_count bigint, is_member boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.id, f.owner_id, f.slug, f.name, f.description, f.rules,
    f.image_path, f.cover_image_path, f.created_at, f.updated_at,
    (select count(*) from public.forum_memberships m where m.forum_id = f.id),
    exists (select 1 from public.forum_memberships m
      where m.forum_id = f.id and m.user_id = (select auth.uid()))
  from public.forums f
  where (p_forum_id is null or f.id = p_forum_id)
    and ((p_before_created_at is null and p_before_id is null)
      or (p_before_created_at is not null and p_before_id is not null
        and (f.created_at, f.id) < (p_before_created_at, p_before_id)))
  order by f.created_at desc, f.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;
revoke all on function public.get_forum_summaries(uuid, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_forum_summaries(uuid, integer, timestamptz, uuid)
  to authenticated;
