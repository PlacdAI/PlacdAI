-- ─────────────────────────────────────────────────────────────
-- PlacdAI — full credit + gallery migration
-- Run ONCE in Supabase SQL Editor. Requires: pg_cron enabled,
-- a public storage bucket named 'gallery' (already created).
-- ─────────────────────────────────────────────────────────────

-- 1. Add credits column to profiles (default 3)
alter table public.profiles
  add column if not exists credits integer not null default 3;

-- 2. Atomic credit consumer (returns remaining, -1 if insufficient)
create or replace function public.consume_credit(_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  remaining integer;
begin
  update public.profiles
     set credits = credits - 1,
         updated_at = now()
   where id = _user_id and credits > 0
   returning credits into remaining;
  if remaining is null then return -1; end if;
  return remaining;
end; $$;

-- 3. Refund helper (Stripe webhook grants credits)
create or replace function public.grant_credits(_user_id uuid, _amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  total integer;
begin
  update public.profiles
     set credits = credits + _amount,
         updated_at = now()
   where id = _user_id
   returning credits into total;
  return total;
end; $$;

grant execute on function public.consume_credit(uuid) to authenticated;
grant execute on function public.grant_credits(uuid, integer) to service_role;

-- 4. Stripe payments log (webhook idempotency)
create table if not exists public.stripe_payments (
  id text primary key,               -- stripe checkout session id
  user_id uuid references auth.users(id) on delete cascade,
  price_id text not null,
  credits_granted integer not null,
  amount_total integer,
  currency text,
  created_at timestamptz not null default now()
);
grant select on public.stripe_payments to authenticated;
grant all on public.stripe_payments to service_role;
alter table public.stripe_payments enable row level security;
drop policy if exists "sp: read own" on public.stripe_payments;
create policy "sp: read own" on public.stripe_payments
  for select to authenticated using (auth.uid() = user_id);

-- 5. Gallery table — one row per saved generation (72h TTL, 20 item cap)
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,        -- key inside 'gallery' bucket
  public_url text not null,
  style text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '72 hours')
);
create index if not exists gallery_user_created_idx
  on public.gallery(user_id, created_at desc);
create index if not exists gallery_expires_idx
  on public.gallery(expires_at);

grant select, insert, delete on public.gallery to authenticated;
grant all on public.gallery to service_role;
alter table public.gallery enable row level security;

drop policy if exists "gallery: own read" on public.gallery;
create policy "gallery: own read" on public.gallery
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "gallery: own insert" on public.gallery;
create policy "gallery: own insert" on public.gallery
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "gallery: own delete" on public.gallery;
create policy "gallery: own delete" on public.gallery
  for delete to authenticated using (auth.uid() = user_id);

-- 6. Storage policies for the 'gallery' bucket (public read, owner write)
drop policy if exists "gallery obj: public read" on storage.objects;
create policy "gallery obj: public read" on storage.objects
  for select to public using (bucket_id = 'gallery');

drop policy if exists "gallery obj: owner insert" on storage.objects;
create policy "gallery obj: owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gallery obj: owner delete" on storage.objects;
create policy "gallery obj: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);

-- 7. FIFO trigger — keep only the 20 newest gallery rows per user, and
--    delete the underlying storage.objects for the evicted rows.
create or replace function public.gallery_enforce_fifo()
returns trigger language plpgsql security definer set search_path = public, storage as $$
declare
  victim record;
begin
  for victim in
    select id, storage_path from public.gallery
     where user_id = new.user_id
     order by created_at desc
     offset 20
  loop
    delete from storage.objects
     where bucket_id = 'gallery' and name = victim.storage_path;
    delete from public.gallery where id = victim.id;
  end loop;
  return new;
end; $$;

drop trigger if exists gallery_fifo_trg on public.gallery;
create trigger gallery_fifo_trg
  after insert on public.gallery
  for each row execute function public.gallery_enforce_fifo();

-- 8. 72-hour purge — run every hour via pg_cron
create or replace function public.gallery_purge_expired()
returns void language plpgsql security definer set search_path = public, storage as $$
declare
  victim record;
begin
  for victim in
    select id, storage_path from public.gallery where expires_at < now()
  loop
    delete from storage.objects
     where bucket_id = 'gallery' and name = victim.storage_path;
    delete from public.gallery where id = victim.id;
  end loop;
end; $$;

-- Remove any previous schedule with the same name, then reschedule.
select cron.unschedule(jobid)
  from cron.job where jobname = 'placdai_gallery_purge';
select cron.schedule(
  'placdai_gallery_purge',
  '0 * * * *',                       -- top of every hour
  $$ select public.gallery_purge_expired(); $$
);
