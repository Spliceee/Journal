-- Daily Journal — Supabase schema
-- Run this once in your project's SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

create extension if not exists pgcrypto;

-- ============ Categories ============
create table if not exists exercise_categories (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null
);

create table if not exists task_categories (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null
);

-- ============ Diary ============
create table if not exists diary (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  title text default '',
  text text default '',
  mood text,
  photos jsonb not null default '[]'::jsonb, -- [{id, path}]
  created_at bigint not null
);

-- ============ Exercise entries ============
create table if not exists exercise_entries (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  category_id text references exercise_categories(id) on delete set null,
  notes text default '',
  photo jsonb, -- {id, path}
  created_at bigint not null
);

-- ============ Gallery / Moment ============
create table if not exists gallery (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  quote text default '',
  photo jsonb, -- {id, path}
  created_at bigint not null
);

-- ============ Tasks ============
create table if not exists tasks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  time text,
  content text not null,
  location text default '',
  category_id text references task_categories(id) on delete set null,
  created_at bigint not null
);

-- ============ Indexes ============
create index if not exists diary_user_date_idx on diary (user_id, date);
create index if not exists exercise_entries_user_date_idx on exercise_entries (user_id, date);
create index if not exists gallery_user_date_idx on gallery (user_id, date);
create index if not exists tasks_user_date_idx on tasks (user_id, date);

-- ============ Row Level Security: everyone can only touch their own rows ============
alter table exercise_categories enable row level security;
alter table task_categories enable row level security;
alter table diary enable row level security;
alter table exercise_entries enable row level security;
alter table gallery enable row level security;
alter table tasks enable row level security;

create policy "own rows only" on exercise_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on task_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on diary for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on exercise_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on gallery for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Note: user profile fields (name, avatar, birthday, message, goal) are stored
-- directly on the Supabase auth user (auth.updateUser({ data: {...} })) instead
-- of a separate table, so no profile table is needed here.

-- ============ Storage: one "photos" bucket, each user gets their own folder ============
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "users can upload their own photos"
on storage.objects for insert
with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users can update their own photos"
on storage.objects for update
using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users can delete their own photos"
on storage.objects for delete
using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "anyone with the link can view photos"
on storage.objects for select
using (bucket_id = 'photos');
