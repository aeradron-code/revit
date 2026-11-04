-- An auth account starts with an incomplete profile; no placeholder username
-- is reserved. Onboarding fills in both fields and marks completion together.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,30}$'
  ),
  constraint profiles_display_name_length check (
    display_name is null or char_length(btrim(display_name)) between 1 and 80
  ),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 280),
  constraint profiles_onboarding_complete check (
    onboarding_completed_at is null or (username is not null and display_name is not null)
  )
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Auth inserts run under a separate role; the trigger only creates the profile
-- for the auth row that fired it, using the function owner's privileges.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url, onboarding_completed_at)
  on table public.profiles to authenticated;

create policy "Authenticated users can view profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

-- These indexes match the current follower/following list ordering.
create index follows_by_follower_created_at_idx
  on public.follows (follower_id, created_at desc, following_id);
create index follows_by_following_created_at_idx
  on public.follows (following_id, created_at desc, follower_id);

alter table public.follows enable row level security;
revoke all on table public.follows from public, anon, authenticated;
grant select, insert, delete on table public.follows to authenticated;

create policy "Authenticated users can view follows"
  on public.follows for select to authenticated using (true);

create policy "Users can follow profiles themselves"
  on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));

create policy "Users can remove their own follows"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));
