-- Picks contain entities, not posts, so forum content cannot enter a Pick.
create type public.pick_type as enum ('PERSONAL');

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  pick_type public.pick_type not null default 'PERSONAL',
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(btrim(description)) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pick_items (
  pick_id uuid not null references public.picks (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete restrict,
  position integer not null check (position >= 1),
  note text check (note is null or char_length(btrim(note)) <= 500),
  created_at timestamptz not null default now(),
  primary key (pick_id, entity_id),
  unique (pick_id, position)
);

create table public.pick_follows (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pick_id uuid not null references public.picks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pick_id)
);

create index picks_by_author_updated_at_idx on public.picks (author_id, updated_at desc, id desc);
create index picks_by_updated_at_idx on public.picks (updated_at desc, id desc);
create index pick_items_by_entity_idx on public.pick_items (entity_id);
create index pick_follows_by_pick_idx on public.pick_follows (pick_id);
create trigger picks_set_updated_at before update on public.picks
  for each row execute function private.set_updated_at();

alter table public.picks enable row level security;
alter table public.pick_items enable row level security;
alter table public.pick_follows enable row level security;
revoke all on public.picks, public.pick_items, public.pick_follows from public, anon, authenticated;
grant select, delete on public.picks to authenticated;
grant select on public.pick_items to authenticated;
grant select, insert, delete on public.pick_follows to authenticated;

create policy "Authenticated users can view Picks"
  on public.picks for select to authenticated using (true);
create policy "Authors can delete their Picks"
  on public.picks for delete to authenticated using (author_id = (select auth.uid()));
create policy "Authenticated users can view Pick items"
  on public.pick_items for select to authenticated using (true);
create policy "Users can view their followed Picks"
  on public.pick_follows for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can follow Picks from people they follow"
  on public.pick_follows for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.picks p join public.follows f on f.following_id = p.author_id
      where p.id = pick_follows.pick_id and f.follower_id = (select auth.uid())
    )
  );
create policy "Users can unfollow their Picks"
  on public.pick_follows for delete to authenticated using (user_id = (select auth.uid()));

-- A private definer function owns the coupled write; clients cannot create an
-- empty Pick or replace individual items outside this transaction.
create function private.save_personal_pick(
  p_pick_id uuid, p_title text, p_description text, p_items jsonb
)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  result public.picks;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'You must be signed in to save a Pick.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '23514', message = 'Pick items must be an array.';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '23514', message = 'A Pick needs at least one find.';
  end if;

  if p_pick_id is null then
    insert into public.picks (author_id, title, description)
    values (current_user_id, btrim(p_title), nullif(btrim(p_description), ''))
    returning * into result;
  else
    update public.picks set title = btrim(p_title), description = nullif(btrim(p_description), '')
    where id = p_pick_id and author_id = current_user_id and pick_type = 'PERSONAL'
    returning * into result;
    if not found then
      raise exception using errcode = '42501', message = 'You can only update your own Pick.';
    end if;
    delete from public.pick_items where pick_id = result.id;
  end if;

  insert into public.pick_items (pick_id, entity_id, position, note)
  select result.id, item.entity_id, item.position, nullif(btrim(item.note), '')
  from jsonb_to_recordset(p_items) as item(entity_id uuid, position integer, note text);
  return result;
end;
$$;
revoke all on function private.save_personal_pick(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.save_personal_pick(uuid, text, text, jsonb) to authenticated;

create function public.create_personal_pick(
  p_title text, p_description text default null, p_items jsonb default '[]'::jsonb
)
returns public.picks language sql security invoker set search_path = '' as $$
  select private.save_personal_pick(null, p_title, p_description, p_items);
$$;
create function public.update_personal_pick(
  p_pick_id uuid, p_title text, p_description text default null, p_items jsonb default '[]'::jsonb
)
returns public.picks language plpgsql security invoker set search_path = '' as $$
begin
  if p_pick_id is null then
    raise exception using errcode = '23514', message = 'Choose a Pick to update.';
  end if;
  return private.save_personal_pick(p_pick_id, p_title, p_description, p_items);
end;
$$;
revoke all on function public.create_personal_pick(text, text, jsonb),
  public.update_personal_pick(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_personal_pick(text, text, jsonb),
  public.update_personal_pick(uuid, text, text, jsonb) to authenticated;

-- Each directory page includes author data and up to three image previews.
-- The cursor is (updated_at, id), newest first. The following and followed
-- scopes only include Picks whose authors the viewer currently follows.
create function public.get_picks_directory(
  p_scope text default 'own',
  p_limit integer default 20,
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null
)
returns table (
  id uuid, author_id uuid, pick_type public.pick_type, title text,
  description text, created_at timestamptz, updated_at timestamptz,
  author jsonb, image_previews jsonb, is_followed boolean
)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.author_id, p.pick_type, p.title, p.description, p.created_at, p.updated_at,
    jsonb_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name,
      'avatar_url', a.avatar_url, 'bio', a.bio),
    coalesce((select jsonb_agg(jsonb_build_object('entity_id', preview.entity_id,
      'image_url', preview.image_url) order by preview.position)
      from (select i.entity_id, i.position, e.image_url from public.pick_items i
        join public.entities e on e.id = i.entity_id
        where i.pick_id = p.id and e.image_url is not null
        order by i.position limit 3) preview), '[]'::jsonb),
    exists (select 1 from public.pick_follows pf
      where pf.pick_id = p.id and pf.user_id = (select auth.uid()))
  from public.picks p join public.profiles a on a.id = p.author_id
  where (select auth.uid()) is not null
    and (p_scope = 'own' and p.author_id = (select auth.uid())
      or p_scope in ('following', 'followed') and exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid())
          and f.following_id = p.author_id
      ) and (p_scope = 'following' or exists (select 1 from public.pick_follows pf
        where pf.user_id = (select auth.uid()) and pf.pick_id = p.id)))
    and ((p_before_updated_at is null and p_before_id is null)
      or (p_before_updated_at is not null and p_before_id is not null
        and (p.updated_at, p.id) < (p_before_updated_at, p_before_id)))
  order by p.updated_at desc, p.id desc
  limit greatest(1, least(coalesce(p_limit, 20), 51));
$$;
revoke all on function public.get_picks_directory(text, integer, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_picks_directory(text, integer, timestamptz, uuid)
  to authenticated;
