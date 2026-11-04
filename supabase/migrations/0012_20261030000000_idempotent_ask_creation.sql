-- A normal Ask creation attempt is identified by a caller-supplied UUID.
-- The record and post commit together; no client can access the ledger directly.
create table private.ask_creation_operations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  operation_id uuid not null,
  request jsonb not null,
  post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);
revoke all on private.ask_creation_operations from public, anon, authenticated;

create function private.create_ask_post_idempotent(
  p_operation_id uuid, p_post_id uuid, p_body text,
  p_media_paths text[] default array[]::text[]
)
returns public.posts
language plpgsql security definer set search_path = '' as $$
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
  if p_operation_id is null or p_post_id is null or p_body is null or p_media_paths is null then
    raise exception using errcode = '23514', message = 'Invalid creation request.';
  end if;
  payload := jsonb_build_object('post_id', p_post_id, 'body', btrim(p_body), 'media_paths', p_media_paths);

  insert into private.ask_creation_operations (user_id, operation_id, request)
  values (caller, p_operation_id, payload)
  on conflict (user_id, operation_id) do nothing;
  inserted := found;

  select * into operation from private.ask_creation_operations
    where user_id = caller and operation_id = p_operation_id for update;
  if operation.request is distinct from payload then
    raise exception using errcode = '23514', message = 'Creation request does not match the original operation.';
  end if;

  if inserted then
    result := private.create_ask_post_with_media(p_post_id, p_body, p_media_paths, null);
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
revoke all on function private.create_ask_post_idempotent(uuid, uuid, text, text[]) from public, anon, authenticated;
grant execute on function private.create_ask_post_idempotent(uuid, uuid, text, text[]) to authenticated;

create function public.create_ask_post_idempotent(
  p_operation_id uuid, p_post_id uuid, p_body text,
  p_media_paths text[] default array[]::text[]
)
returns public.posts language sql security invoker set search_path = '' as $$
  select private.create_ask_post_idempotent(p_operation_id, p_post_id, p_body, p_media_paths);
$$;
revoke all on function public.create_ask_post_idempotent(uuid, uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.create_ask_post_idempotent(uuid, uuid, text, text[]) to authenticated;
