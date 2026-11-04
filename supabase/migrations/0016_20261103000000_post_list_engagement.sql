-- Return engagement metadata for a page of posts in one request rather than
-- issuing count and rating-summary requests from every rendered card.
create function public.get_post_list_engagement(p_post_ids uuid[])
returns table (
  post_id uuid,
  comment_count bigint,
  average_score numeric,
  rating_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with requested_posts as (
    select distinct requested.post_id
    from unnest(coalesce(p_post_ids, array[]::uuid[])) as requested(post_id)
    where requested.post_id is not null
    limit 100
  ), comment_counts as (
    select c.post_id, count(*) as comment_count
    from public.comments c
    join requested_posts requested using (post_id)
    group by c.post_id
  ), rating_summaries as (
    select r.post_id, round(avg(r.score), 1) as average_score, count(*) as rating_count
    from public.ratings r
    join requested_posts requested using (post_id)
    group by r.post_id
  )
  select requested.post_id,
    coalesce(comments.comment_count, 0),
    ratings.average_score,
    coalesce(ratings.rating_count, 0)
  from requested_posts requested
  left join comment_counts comments using (post_id)
  left join rating_summaries ratings using (post_id);
$$;

revoke all on function public.get_post_list_engagement(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_post_list_engagement(uuid[])
  to authenticated;
