-- Internal helpers live outside the schemas exposed by the Data API.
create schema private;
revoke all on schema private from public, anon, authenticated;

-- Shared trigger for tables that track their last modification time.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- Trigger functions are not part of the client-facing API.
revoke all on function private.set_updated_at() from public, anon, authenticated;
