-- A positive result confirms that this user created the post. No result is
-- deliberately inconclusive: the original request may still be in flight, may
-- have failed, or the post may have since been deleted.
create function private.lookup_ask_creation(p_operation_id uuid)
returns setof public.posts
language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_operation_id is null then
    raise exception using errcode = '23514', message = 'An operation ID is required.';
  end if;
  return query
    select p.* from private.ask_creation_operations o
    join public.posts p on p.id = o.post_id
    where o.user_id = caller and o.operation_id = p_operation_id
      and p.author_id = caller and p.post_type = 'ASK' and p.forum_id is null;
end;
$$;
revoke all on function private.lookup_ask_creation(uuid) from public, anon, authenticated;
grant execute on function private.lookup_ask_creation(uuid) to authenticated;

create function public.lookup_ask_creation(p_operation_id uuid)
returns setof public.posts language sql stable security invoker set search_path = '' as $$
  select * from private.lookup_ask_creation(p_operation_id);
$$;
revoke all on function public.lookup_ask_creation(uuid) from public, anon, authenticated;
grant execute on function public.lookup_ask_creation(uuid) to authenticated;
