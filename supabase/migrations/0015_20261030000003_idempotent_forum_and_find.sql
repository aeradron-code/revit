-- Reuse the post operation ledger so a user cannot reuse an operation ID for
-- another kind of creation. Deletions keep a tombstone until account deletion.
alter table private.ask_creation_operations
  add column forum_id uuid references public.forums(id) on delete set null,
  add column entity_id uuid references public.entities(id) on delete set null;

create function private.create_forum_idempotent(
  p_operation_id uuid, p_forum_id uuid, p_name text, p_slug text,
  p_description text, p_rules text, p_image_path text, p_cover_image_path text
) returns public.forums language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  payload jsonb;
  operation private.ask_creation_operations;
  result public.forums;
  inserted boolean;
  path text;
begin
  if caller is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  if p_operation_id is null or p_forum_id is null or p_name is null or p_slug is null or p_rules is null then
    raise exception using errcode = '23514', message = 'Invalid forum creation request.';
  end if;
  payload := jsonb_build_object('kind', 'FORUM', 'forum_id', p_forum_id,
    'name', btrim(p_name), 'slug', lower(btrim(p_slug)), 'description', nullif(btrim(p_description), ''),
    'rules', btrim(p_rules), 'image_path', p_image_path, 'cover_image_path', p_cover_image_path);
  insert into private.ask_creation_operations(user_id, operation_id, request)
    values (caller, p_operation_id, payload) on conflict (user_id, operation_id) do nothing;
  inserted := found;
  select * into operation from private.ask_creation_operations
    where user_id = caller and operation_id = p_operation_id for update;
  if operation.request is distinct from payload then
    raise exception using errcode = '23514', message = 'Creation request does not match the original operation.';
  end if;
  if inserted then
    foreach path in array array[p_image_path, p_cover_image_path] loop
      if path is not null and not exists (select 1 from storage.objects o
        where o.bucket_id = 'forum-images' and o.name = path
          and (storage.foldername(o.name))[1] = caller::text) then
        raise exception using errcode = '23514', message = 'Forum image is unavailable.';
      end if;
    end loop;
    insert into public.forums(id, owner_id, name, slug, description, rules, image_path, cover_image_path)
      values (p_forum_id, caller, p_name, p_slug, p_description, p_rules, p_image_path, p_cover_image_path)
      returning * into result;
    update private.ask_creation_operations set forum_id = result.id
      where user_id = caller and operation_id = p_operation_id;
    return result;
  end if;
  select * into result from public.forums where id = operation.forum_id and owner_id = caller;
  if not found then raise exception using errcode = 'P0002', message = 'The created forum is no longer available.'; end if;
  return result;
end;
$$;
revoke all on function private.create_forum_idempotent(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function private.create_forum_idempotent(uuid, uuid, text, text, text, text, text, text) to authenticated;
create function public.create_forum_idempotent(
  p_operation_id uuid, p_forum_id uuid, p_name text, p_slug text,
  p_description text default null, p_rules text default '', p_image_path text default null, p_cover_image_path text default null
) returns public.forums language sql security invoker set search_path = '' as $$
  select private.create_forum_idempotent(p_operation_id, p_forum_id, p_name, p_slug, p_description, p_rules, p_image_path, p_cover_image_path);
$$;
revoke all on function public.create_forum_idempotent(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_forum_idempotent(uuid, uuid, text, text, text, text, text, text) to authenticated;

create function private.create_find_idempotent(
  p_operation_id uuid, p_entity_id uuid, p_category_slug text, p_name text,
  p_description text, p_image_url text, p_image_path text, p_address_line_1 text,
  p_address_line_2 text, p_locality text, p_district text, p_state text, p_country text, p_postal_code text
) returns public.entities language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  payload jsonb;
  operation private.ask_creation_operations;
  result public.entities;
  category uuid;
  inserted boolean;
begin
  if caller is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  if p_operation_id is null or p_entity_id is null or p_category_slug is null or p_name is null
     or ((p_image_path is null) <> (p_image_url is null)) then
    raise exception using errcode = '23514', message = 'Invalid find creation request.';
  end if;
  payload := jsonb_build_object('kind', 'FIND', 'entity_id', p_entity_id,
    'category', lower(btrim(p_category_slug)), 'name', btrim(p_name),
    'description', nullif(btrim(p_description), ''), 'image_url', p_image_url, 'image_path', p_image_path,
    'address_line_1', nullif(btrim(p_address_line_1), ''), 'address_line_2', nullif(btrim(p_address_line_2), ''),
    'locality', nullif(btrim(p_locality), ''), 'district', nullif(btrim(p_district), ''),
    'state', nullif(btrim(p_state), ''), 'country', nullif(btrim(p_country), ''), 'postal_code', nullif(btrim(p_postal_code), ''));
  insert into private.ask_creation_operations(user_id, operation_id, request)
    values (caller, p_operation_id, payload) on conflict (user_id, operation_id) do nothing;
  inserted := found;
  select * into operation from private.ask_creation_operations
    where user_id = caller and operation_id = p_operation_id for update;
  if operation.request is distinct from payload then
    raise exception using errcode = '23514', message = 'Creation request does not match the original operation.';
  end if;
  if inserted then
    select id into category from public.entity_categories where slug = lower(btrim(p_category_slug));
    if category is null then raise exception using errcode = '23503', message = 'Choose a valid category.'; end if;
    if p_image_path is not null and (
      right(p_image_url, length('/storage/v1/object/public/entity-images/' || p_image_path)) <> '/storage/v1/object/public/entity-images/' || p_image_path
      or not exists (select 1 from storage.objects o where o.bucket_id = 'entity-images' and o.name = p_image_path
        and (storage.foldername(o.name))[1] = caller::text)
    ) then raise exception using errcode = '23514', message = 'Find image is unavailable.'; end if;
    insert into public.entities(id, category_id, created_by, name, description, image_url,
      address_line_1, address_line_2, locality, district, state, country, postal_code)
    values (p_entity_id, category, caller, p_name, p_description, p_image_url,
      p_address_line_1, p_address_line_2, p_locality, p_district, p_state, p_country, p_postal_code)
    returning * into result;
    update private.ask_creation_operations set entity_id = result.id
      where user_id = caller and operation_id = p_operation_id;
    return result;
  end if;
  select * into result from public.entities where id = operation.entity_id and created_by = caller;
  if not found then raise exception using errcode = 'P0002', message = 'The created find is no longer available.'; end if;
  return result;
end;
$$;
revoke all on function private.create_find_idempotent(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function private.create_find_idempotent(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
create function public.create_find_idempotent(
  p_operation_id uuid, p_entity_id uuid, p_category_slug text, p_name text,
  p_description text default null, p_image_url text default null, p_image_path text default null,
  p_address_line_1 text default null, p_address_line_2 text default null, p_locality text default null,
  p_district text default null, p_state text default null, p_country text default null, p_postal_code text default null
) returns public.entities language sql security invoker set search_path = '' as $$
  select private.create_find_idempotent(p_operation_id, p_entity_id, p_category_slug, p_name,
    p_description, p_image_url, p_image_path, p_address_line_1, p_address_line_2, p_locality,
    p_district, p_state, p_country, p_postal_code);
$$;
revoke all on function public.create_find_idempotent(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_find_idempotent(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

create function private.lookup_resource_creation(p_operation_id uuid, p_kind text)
returns table (resource_id uuid) language plpgsql stable security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null then raise exception using errcode = '42501', message = 'Authentication required.'; end if;
  if p_operation_id is null or p_kind is null or p_kind not in ('FORUM', 'FIND') then
    raise exception using errcode = '23514', message = 'Invalid creation lookup.';
  end if;
  return query select case when p_kind = 'FORUM' then f.id else e.id end
    from private.ask_creation_operations o
    left join public.forums f on f.id = o.forum_id and f.owner_id = caller
    left join public.entities e on e.id = o.entity_id and e.created_by = caller
    where o.user_id = caller and o.operation_id = p_operation_id and o.request ->> 'kind' = p_kind
      and ((p_kind = 'FORUM' and f.id is not null) or (p_kind = 'FIND' and e.id is not null));
end;
$$;
revoke all on function private.lookup_resource_creation(uuid, text) from public, anon, authenticated;
grant execute on function private.lookup_resource_creation(uuid, text) to authenticated;
create function public.lookup_resource_creation(p_operation_id uuid, p_kind text)
returns table (resource_id uuid) language sql stable security invoker set search_path = '' as $$
  select * from private.lookup_resource_creation(p_operation_id, p_kind);
$$;
revoke all on function public.lookup_resource_creation(uuid, text) from public, anon, authenticated;
grant execute on function public.lookup_resource_creation(uuid, text) to authenticated;
