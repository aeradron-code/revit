-- Home is always global: forum posts are never part of either feed mode.
create function public.get_home_feed(
  p_limit integer default 11,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_mode text default 'following'
)
returns setof public.posts
language sql stable security invoker set search_path = '' as $$
  select p.* from public.posts p
  where (select auth.uid()) is not null and p.forum_id is null
    and (p_mode = 'for-you' or (p_mode = 'following' and (
      p.author_id = (select auth.uid()) or exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid())
          and f.following_id = p.author_id
      )
    )))
    and ((p_before_created_at is null and p_before_id is null)
      or (p_before_created_at is not null and p_before_id is not null
        and (p.created_at, p.id) < (p_before_created_at, p_before_id)))
  order by p.created_at desc, p.id desc
  limit greatest(1, least(coalesce(p_limit, 11), 51));
$$;
revoke all on function public.get_home_feed(integer, timestamptz, uuid, text)
  from public, anon, authenticated;
grant execute on function public.get_home_feed(integer, timestamptz, uuid, text)
  to authenticated;

-- Discover searches normal posts only. The input is treated literally rather
-- than as an ILIKE pattern and the result count is bounded.
create function public.search_discover_posts(p_query text, p_limit integer default 8)
returns setof public.posts
language sql stable security invoker set search_path = '' as $$
  select p.* from public.posts p
  where (select auth.uid()) is not null and p.forum_id is null
    and length(btrim(coalesce(p_query, ''))) >= 2
    and p.body ilike '%' || replace(replace(replace(btrim(p_query), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
  order by p.created_at desc, p.id desc
  limit greatest(1, least(coalesce(p_limit, 8), 50));
$$;
revoke all on function public.search_discover_posts(text, integer) from public, anon, authenticated;
grant execute on function public.search_discover_posts(text, integer) to authenticated;

-- Forum images and post images are private; entity images are public as in the
-- current product. Uploads are scoped to the authenticated owner's prefix.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-images', 'post-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('forum-images', 'forum-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('entity-images', 'entity-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

create policy "Users can upload post images under their own prefix"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
create policy "Users can view registered post images or their uploads"
  on storage.objects for select to authenticated using (
    bucket_id = 'post-images' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.post_media m where m.storage_path = storage.objects.name)
    )
  );
create policy "Users can delete unregistered post uploads"
  on storage.objects for delete to authenticated using (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.post_media m where m.storage_path = storage.objects.name)
  );

create policy "Users can upload forum images under their own prefix"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'forum-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and storage.filename(name) ~* '^(image|cover)\.(jpg|jpeg|png|webp|heic|heif)$'
  );
create policy "Users can view registered forum images or their uploads"
  on storage.objects for select to authenticated using (
    bucket_id = 'forum-images' and ((storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.forums f
        where f.image_path = storage.objects.name or f.cover_image_path = storage.objects.name))
  );
create policy "Users can delete unregistered forum uploads"
  on storage.objects for delete to authenticated using (
    bucket_id = 'forum-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.forums f
      where f.image_path = storage.objects.name or f.cover_image_path = storage.objects.name)
  );

create policy "Users can upload entity images under their own prefix"
  on storage.objects for insert to authenticated with check (
    bucket_id = 'entity-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
  );
create policy "Users can view their entity image uploads"
  on storage.objects for select to authenticated using (
    bucket_id = 'entity-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users can delete their entity image uploads"
  on storage.objects for delete to authenticated using (
    bucket_id = 'entity-images' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
