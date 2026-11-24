-- Ratings belong to a post. Allow the same per-post rating behavior on Share
-- posts while keeping forum ratings visible and writable only to members.
drop policy "Authenticated users can view Ask ratings" on public.ratings;
create policy "Users can view ratings on accessible posts"
  on public.ratings for select to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = ratings.post_id
        and (p.forum_id is null or exists (
          select 1 from public.forum_memberships m
          where m.forum_id = p.forum_id and m.user_id = (select auth.uid())
        ))
        and not private.is_blocked_between((select auth.uid()), p.author_id)
    )
    and not private.is_blocked_between((select auth.uid()), ratings.rater_id)
  );

drop policy "Users can rate accessible Ask posts" on public.ratings;
create policy "Users can rate accessible posts"
  on public.ratings for insert to authenticated
  with check (
    rater_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = ratings.post_id
        and p.post_type in ('ASK', 'SHARE')
        and (p.forum_id is null or exists (
          select 1 from public.forum_memberships m
          where m.forum_id = p.forum_id and m.user_id = (select auth.uid())
        ))
        and not private.is_blocked_between((select auth.uid()), p.author_id)
    )
  );

drop policy "Users can update their accessible Ask ratings" on public.ratings;
create policy "Users can update their accessible post ratings"
  on public.ratings for update to authenticated
  using (
    rater_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = ratings.post_id
        and p.post_type in ('ASK', 'SHARE')
        and (p.forum_id is null or exists (
          select 1 from public.forum_memberships m
          where m.forum_id = p.forum_id and m.user_id = (select auth.uid())
        ))
        and not private.is_blocked_between((select auth.uid()), p.author_id)
    )
  )
  with check (rater_id = (select auth.uid()));

drop policy "Users can delete their accessible Ask ratings" on public.ratings;
create policy "Users can delete their accessible post ratings"
  on public.ratings for delete to authenticated
  using (
    rater_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = ratings.post_id
        and p.post_type in ('ASK', 'SHARE')
        and (p.forum_id is null or exists (
          select 1 from public.forum_memberships m
          where m.forum_id = p.forum_id and m.user_id = (select auth.uid())
        ))
        and not private.is_blocked_between((select auth.uid()), p.author_id)
    )
  );

create function public.save_post_rating(p_post_id uuid, p_rater_id uuid, p_score smallint)
returns public.ratings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.ratings;
begin
  if (select auth.uid()) is null or p_rater_id is distinct from (select auth.uid()) then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_score is null or p_score not between 1 and 5 then
    raise exception using errcode = '23514', message = 'Choose a rating from 1 to 5.';
  end if;

  insert into public.ratings (post_id, rater_id, score)
  values (p_post_id, (select auth.uid()), p_score)
  on conflict (rater_id, post_id) do update set score = excluded.score
  returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_post_rating(uuid, uuid, smallint)
  from public, anon, authenticated;
grant execute on function public.save_post_rating(uuid, uuid, smallint)
  to authenticated;

create function public.get_post_rating_summary(target_post_id uuid)
returns table (average_score numeric, rating_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select round(avg(score), 1), count(*)
  from public.ratings
  where post_id = target_post_id;
$$;
revoke all on function public.get_post_rating_summary(uuid)
  from public, anon, authenticated;
grant execute on function public.get_post_rating_summary(uuid)
  to authenticated;
