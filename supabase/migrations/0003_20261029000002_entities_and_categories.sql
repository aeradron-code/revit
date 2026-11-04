create table public.entity_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null unique,
  created_at timestamptz not null default now(),
  constraint entity_categories_slug_format check (slug ~ '^[a-z][a-z0-9-]{1,62}$'),
  constraint entity_categories_label_length check (char_length(btrim(label)) between 1 and 80)
);

-- Categories are application reference data, needed in every environment.
insert into public.entity_categories (slug, label) values
  ('restaurant', 'Restaurant'),
  ('book', 'Books'),
  ('movie', 'Movies'),
  ('product', 'Products'),
  ('place', 'Places'),
  ('service', 'Services');

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.entity_categories (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  name text not null,
  description text,
  image_url text,
  address_line_1 text,
  address_line_2 text,
  locality text,
  district text,
  state text,
  country text,
  postal_code text,
  normalized_name text not null,
  normalized_address text,
  normalized_locality text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entities_name_length check (char_length(btrim(name)) between 1 and 160),
  constraint entities_description_length check (description is null or char_length(btrim(description)) between 1 and 2000),
  constraint entities_image_url_length check (image_url is null or char_length(btrim(image_url)) between 1 and 2048),
  constraint entities_address_line_1_length check (address_line_1 is null or char_length(btrim(address_line_1)) between 1 and 200),
  constraint entities_address_line_2_length check (address_line_2 is null or char_length(btrim(address_line_2)) between 1 and 200),
  constraint entities_locality_length check (locality is null or char_length(btrim(locality)) between 1 and 120),
  constraint entities_district_length check (district is null or char_length(btrim(district)) between 1 and 120),
  constraint entities_state_length check (state is null or char_length(btrim(state)) between 1 and 120),
  constraint entities_country_length check (country is null or char_length(btrim(country)) between 1 and 120),
  constraint entities_postal_code_length check (postal_code is null or char_length(btrim(postal_code)) between 1 and 24)
);

create function private.prepare_entity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(new.description), '');
  new.image_url := nullif(btrim(new.image_url), '');
  new.address_line_1 := nullif(btrim(new.address_line_1), '');
  new.address_line_2 := nullif(btrim(new.address_line_2), '');
  new.locality := nullif(btrim(new.locality), '');
  new.district := nullif(btrim(new.district), '');
  new.state := nullif(btrim(new.state), '');
  new.country := nullif(btrim(new.country), '');
  new.postal_code := nullif(btrim(new.postal_code), '');
  new.normalized_name := lower(regexp_replace(new.name, '\s+', ' ', 'g'));
  new.normalized_locality := lower(regexp_replace(new.locality, '\s+', ' ', 'g'));
  new.normalized_address := nullif(lower(regexp_replace(
    concat_ws(' ', new.address_line_1, new.address_line_2, new.postal_code),
    '\s+', ' ', 'g'
  )), '');
  return new;
end;
$$;

revoke all on function private.prepare_entity() from public, anon, authenticated;

create trigger entities_prepare
  before insert or update on public.entities
  for each row execute function private.prepare_entity();
create trigger entities_set_updated_at
  before update on public.entities
  for each row execute function private.set_updated_at();

create index entities_by_category_name_idx
  on public.entities (category_id, normalized_name, normalized_locality);

-- A name alone is not a reliable identity for books, films, products, or
-- unlocated places. Only reject matches with both locality and address;
-- district, state and country distinguish otherwise identical locations.
create unique index entities_located_identity_idx
  on public.entities (category_id, normalized_name, normalized_locality, normalized_address,
    (lower(regexp_replace(coalesce(district, ''), '\s+', ' ', 'g'))),
    (lower(regexp_replace(coalesce(state, ''), '\s+', ' ', 'g'))),
    (lower(regexp_replace(coalesce(country, ''), '\s+', ' ', 'g'))))
  where normalized_locality is not null and normalized_address is not null;

alter table public.entity_categories enable row level security;
alter table public.entities enable row level security;
revoke all on table public.entity_categories, public.entities from public, anon, authenticated;
grant select on table public.entity_categories, public.entities to authenticated;
grant insert (category_id, name, description, image_url, address_line_1, address_line_2,
  locality, district, state, country, postal_code) on public.entities to authenticated;
grant delete on public.entities to authenticated;

create policy "Authenticated users can view categories"
  on public.entity_categories for select to authenticated using (true);
create policy "Authenticated users can view entities"
  on public.entities for select to authenticated using (true);
create policy "Users can create entities as themselves"
  on public.entities for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Creators can delete entities"
  on public.entities for delete to authenticated
  using (created_by = (select auth.uid()));

-- The invoker remains subject to the table grants and RLS policies above.
create function public.create_entity(
  p_category_slug text,
  p_name text,
  p_description text default null,
  p_image_url text default null,
  p_address_line_1 text default null,
  p_address_line_2 text default null,
  p_locality text default null,
  p_district text default null,
  p_state text default null,
  p_country text default null,
  p_postal_code text default null
)
returns public.entities
language plpgsql
security invoker
set search_path = ''
as $$
declare
  category_id_value uuid;
  result public.entities;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'You must be signed in to create an entity.';
  end if;
  select id into category_id_value from public.entity_categories
    where slug = lower(btrim(p_category_slug));
  if category_id_value is null then
    raise exception using errcode = '23503', message = 'Choose a valid entity category.';
  end if;
  insert into public.entities (
    category_id, name, description, image_url, address_line_1, address_line_2,
    locality, district, state, country, postal_code
  ) values (
    category_id_value, p_name, p_description, p_image_url, p_address_line_1,
    p_address_line_2, p_locality, p_district, p_state, p_country, p_postal_code
  ) returning * into result;
  return result;
end;
$$;

revoke all on function public.create_entity(text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_entity(text, text, text, text, text, text, text, text, text, text, text)
  to authenticated;
