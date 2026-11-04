-- Share the existing operation ledger with normal Asks. Its historical name is
-- retained so the already-deployed Ask functions continue to work.

create function private.create_post_idempotent(
  p_operation_id uuid, p_post_id uuid, p_kind text, p_body text,
  p_media_paths text[], p_forum_id uuid, p_entity_id uuid, p_score smallint
)
returns public.posts language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  payload jsonb;
  operation private.ask_creation_operations;
  result public.posts;
  inserted boolean;
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_operation_id is null or p_post_id is null or p_media_paths is null
     or p_kind is null or p_kind not in ('FORUM_ASK', 'FORUM_SHARE', 'GLOBAL_SHARE')
     or (p_kind = 'FORUM_ASK' and (p_forum_id is null or p_entity_id is not null or p_score is not null))
     or (p_kind = 'FORUM_SHARE' and (p_forum_id is null or p_entity_id is null or p_score is null))
     or (p_kind = 'GLOBAL_SHARE' and (p_forum_id is not null or p_entity_id is null or p_score is null)) then
    raise exception using errcode = '23514', message = 'Invalid creation request.';
  end if;
  payload := jsonb_build_object('kind', p_kind, 'post_id', p_post_id,
    'body', nullif(btrim(p_body), ''), 'media_paths', p_media_paths,
    'forum_id', p_forum_id, 'entity_id', p_entity_id, 'score', p_score);
  insert into private.ask_creation_operations (user_id, operation_id, request)
  values (caller, p_operation_id, payload) on conflict (user_id, operation_id) do nothing;
  inserted := found;
  select * into operation from private.ask_creation_operations
    where user_id = caller and operation_id = p_operation_id for update;
  if operation.request is distinct from payload then
    raise exception using errcode = '23514', message = 'Creation request does not match the original operation.';
  end if;
  if inserted then
    if p_kind = 'FORUM_ASK' then
      result := private.create_ask_post_with_media(p_post_id, p_body, p_media_paths, p_forum_id);
    else
      result := private.create_share_post_with_media(p_post_id, p_entity_id, p_score, p_body, p_media_paths, p_forum_id);
    end if;
    update private.ask_creation_operations set post_id = result.id
      where user_id = caller and operation_id = p_operation_id;
    return result;
  end if;
  select * into result from public.posts where id = operation.post_id and author_id = caller;
  if not found then
    raise exception using errcode = 'P0002', message = 'The created post is no longer available.';
  end if;
  return result;
end;
$$;
revoke all on function private.create_post_idempotent(uuid, uuid, text, text, text[], uuid, uuid, smallint)
  from public, anon, authenticated;
grant execute on function private.create_post_idempotent(uuid, uuid, text, text, text[], uuid, uuid, smallint) to authenticated;

create function public.create_post_idempotent(
  p_operation_id uuid, p_post_id uuid, p_kind text, p_body text default null,
  p_media_paths text[] default array[]::text[], p_forum_id uuid default null,
  p_entity_id uuid default null, p_score smallint default null
)
returns public.posts language sql security invoker set search_path = '' as $$
  select private.create_post_idempotent(p_operation_id, p_post_id, p_kind, p_body,
    p_media_paths, p_forum_id, p_entity_id, p_score);
$$;
revoke all on function public.create_post_idempotent(uuid, uuid, text, text, text[], uuid, uuid, smallint)
  from public, anon, authenticated;
grant execute on function public.create_post_idempotent(uuid, uuid, text, text, text[], uuid, uuid, smallint) to authenticated;

-- Only a positive lookup confirms completion; no row remains inconclusive.
create function private.lookup_post_creation(p_operation_id uuid, p_kind text)
returns setof public.posts language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;
  if p_operation_id is null or p_kind is null or p_kind not in ('FORUM_ASK', 'FORUM_SHARE', 'GLOBAL_SHARE') then
    raise exception using errcode = '23514', message = 'Invalid creation lookup.';
  end if;
  return query select p.* from private.ask_creation_operations o
    join public.posts p on p.id = o.post_id
    where o.user_id = caller and o.operation_id = p_operation_id
      and o.request ->> 'kind' = p_kind and p.author_id = caller;
end;
$$;
revoke all on function private.lookup_post_creation(uuid, text) from public, anon, authenticated;
grant execute on function private.lookup_post_creation(uuid, text) to authenticated;

create function public.lookup_post_creation(p_operation_id uuid, p_kind text)
returns setof public.posts language sql stable security invoker set search_path = '' as $$
  select * from private.lookup_post_creation(p_operation_id, p_kind);
$$;
revoke all on function public.lookup_post_creation(uuid, text) from public, anon, authenticated;
grant execute on function public.lookup_post_creation(uuid, text) to authenticated;
