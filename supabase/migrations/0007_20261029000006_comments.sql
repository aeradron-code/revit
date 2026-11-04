-- Comments belong to one post. Replies may only target a top-level comment
-- on that same post; deleting a parent also deletes its replies.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id uuid,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_id_post_key unique (id, post_id),
  constraint comments_parent_same_post_fkey foreign key (parent_id, post_id)
    references public.comments (id, post_id) on delete cascade,
  constraint comments_not_own_parent check (parent_id is distinct from id),
  constraint comments_body_length check (char_length(btrim(body)) between 1 and 2000)
);

create index comments_by_post_parent_created_at_idx
  on public.comments (post_id, parent_id, created_at desc, id desc);
create index comments_by_author_created_at_idx
  on public.comments (author_id, created_at desc, id desc);

create function private.validate_comment_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.parent_id is not null and exists (
    select 1 from public.comments parent
    where parent.id = new.parent_id and parent.post_id = new.post_id
      and parent.parent_id is not null
  ) then
    raise exception using errcode = '23514', constraint = 'comments_one_reply_level',
      message = 'Replies cannot have replies.';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_comment_parent() from public, anon, authenticated;

create trigger comments_validate_parent
  before insert or update of post_id, parent_id on public.comments
  for each row execute function private.validate_comment_parent();
create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function private.set_updated_at();

alter table public.comments enable row level security;
revoke all on public.comments from public, anon, authenticated;
grant select, delete on public.comments to authenticated;
grant insert (post_id, author_id, parent_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

create policy "Authenticated users can view comments on accessible posts"
  on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = comments.post_id));

-- Forum posts remain readable in their forum, but creating or changing a
-- comment requires current membership. Normal posts do not require it.
create policy "Users can comment on accessible posts"
  on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = comments.post_id
      and (p.forum_id is null or exists (select 1 from public.forum_memberships m
        where m.forum_id = p.forum_id and m.user_id = (select auth.uid())))
  ));

create policy "Users can update their accessible comments"
  on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = comments.post_id
      and (p.forum_id is null or exists (select 1 from public.forum_memberships m
        where m.forum_id = p.forum_id and m.user_id = (select auth.uid())))
  ))
  with check (author_id = (select auth.uid()));

create policy "Users can delete their accessible comments"
  on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) and exists (
    select 1 from public.posts p where p.id = comments.post_id
      and (p.forum_id is null or exists (select 1 from public.forum_memberships m
        where m.forum_id = p.forum_id and m.user_id = (select auth.uid())))
  ));

-- Pass parent_id = null for top-level comments, or a comment ID for replies.
-- The client can request one extra row to detect the next page.
create function public.get_comments_page(
  p_post_id uuid,
  p_parent_id uuid default null,
  p_limit integer default 10,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns setof public.comments
language sql
stable
security invoker
set search_path = ''
as $$
  select c.* from public.comments c
  where c.post_id = p_post_id
    and c.parent_id is not distinct from p_parent_id
    and ((p_before_created_at is null and p_before_id is null)
      or (p_before_created_at is not null and p_before_id is not null
        and (c.created_at, c.id) < (p_before_created_at, p_before_id)))
  order by c.created_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit, 10), 51));
$$;
revoke all on function public.get_comments_page(uuid, uuid, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_comments_page(uuid, uuid, integer, timestamptz, uuid)
  to authenticated;
