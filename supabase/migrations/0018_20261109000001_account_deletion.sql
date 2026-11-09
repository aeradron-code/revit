-- Keep a retryable deletion job while the Auth user still exists. The row is
-- removed automatically by the Auth foreign key after successful deletion.
create table public.account_deletion_jobs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'failed')),
  locked_until timestamptz,
  last_error text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_jobs enable row level security;
revoke all on table public.account_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_jobs to service_role;

create index entities_by_creator_idx
  on public.entities (created_by) where created_by is not null;

-- Claim a job atomically. An expired lease lets a later request resume a
-- function invocation that was interrupted before it could record failure.
create function public.claim_account_deletion_job(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_deletion_jobs (user_id, status, locked_until)
  values (p_user_id, 'processing', pg_catalog.now() + interval '5 minutes')
  on conflict (user_id) do update
    set status = 'processing',
        locked_until = pg_catalog.now() + interval '5 minutes',
        last_error = null,
        updated_at = pg_catalog.now()
    where public.account_deletion_jobs.status <> 'processing'
      or public.account_deletion_jobs.locked_until is null
      or public.account_deletion_jobs.locked_until < pg_catalog.now();
  return found;
end;
$$;

revoke all on function public.claim_account_deletion_job(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_account_deletion_job(uuid) to service_role;

-- Enqueue only objects that still exist. Account deletion removes the user's
-- Storage objects before Auth cascades remove post_media rows.
create or replace function private.enqueue_deleted_post_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id = 'post-images' and name = old.storage_path
  ) then
    insert into private.post_media_cleanup_queue (storage_path)
    values (old.storage_path)
    on conflict (storage_path) do update set queued_at = pg_catalog.now();
  end if;
  return old;
end;
$$;
