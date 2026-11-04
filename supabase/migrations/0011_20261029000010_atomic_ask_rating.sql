-- Keep the insert and update in one statement while retaining the caller's
-- table privileges and row-level security checks.
create function public.save_ask_rating(p_post_id uuid, p_rater_id uuid, p_score smallint)
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

  insert into public.ratings (post_id, rater_id, score)
  values (p_post_id, (select auth.uid()), p_score)
  on conflict (rater_id, post_id) do update set score = excluded.score
  returning * into saved;
  return saved;
end;
$$;

revoke all on function public.save_ask_rating(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.save_ask_rating(uuid, uuid, smallint) to authenticated;
