-- ─────────────────────────────────────────────────────────────
-- Profiles table + auto-insert trigger for PlacdAI
--
-- Run this ONCE in your external Supabase project:
--   Supabase dashboard → SQL Editor → paste this file → Run
-- ─────────────────────────────────────────────────────────────

-- 1. Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  avatar_url text,
  preferred_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Grants (required for the Data API — RLS alone is not enough)
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- 3. RLS
alter table public.profiles enable row level security;

drop policy if exists "Profiles: users can read own" on public.profiles;
create policy "Profiles: users can read own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Profiles: users can update own" on public.profiles;
create policy "Profiles: users can update own"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Profiles: users can insert own" on public.profiles;
create policy "Profiles: users can insert own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- 4. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
