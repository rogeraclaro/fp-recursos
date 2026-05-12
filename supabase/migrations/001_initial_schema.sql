-- Profiles (extends auth.users)
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  username   text not null,
  role       text not null default 'editor' check (role in ('editor', 'admin')),
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- Categories (admin-managed)
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Bookmarks
create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  url         text not null,
  categories  text[] not null default '{}',
  user_id     uuid references public.profiles(id) on delete cascade not null,
  highlighted boolean not null default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bookmarks_updated_at
  before update on public.bookmarks
  for each row execute procedure public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable RLS
alter table public.profiles   enable row level security;
alter table public.categories enable row level security;
alter table public.bookmarks  enable row level security;

-- Profiles policies
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Categories policies
create policy "Categories are viewable by everyone"
  on public.categories for select using (true);

create policy "Admins can manage categories"
  on public.categories for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- Bookmarks policies
create policy "Bookmarks are viewable by everyone"
  on public.bookmarks for select using (true);

create policy "Editors can insert own bookmarks"
  on public.bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Editors can update own bookmarks"
  on public.bookmarks for update
  using (auth.uid() = user_id);

create policy "Admin can update any bookmark"
  on public.bookmarks for update
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

create policy "Editors can delete own bookmarks"
  on public.bookmarks for delete
  using (auth.uid() = user_id);

create policy "Admin can delete any bookmark"
  on public.bookmarks for delete
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));
