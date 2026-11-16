-- Profiles have one simple account role. New accounts remain ordinary users;
-- an operator can promote an account directly in Supabase Dashboard.
create type public.profile_role as enum ('user', 'admin');

alter table public.profiles
  add column role public.profile_role not null default 'user';

-- Keep role changes out of the client API. Reassert the profile fields that
-- signed-in users are allowed to edit so the role cannot be self-assigned.
revoke update on table public.profiles from public, anon, authenticated;
grant update (username, display_name, bio, avatar_url, onboarding_completed_at)
  on public.profiles to authenticated;
