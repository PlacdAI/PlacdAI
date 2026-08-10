-- ─────────────────────────────────────────────────────────────
-- PlacdAI — fix: "Direct deletion from storage tables is not allowed"
--
-- Root cause: gallery_enforce_fifo() and gallery_purge_expired() both
-- ran `delete from storage.objects ...` directly in SQL. Supabase's
-- Storage schema tracks folder "prefixes" internally and blocks raw
-- DELETEs on storage.objects — even from security-definer functions —
-- to force cleanup through the Storage API instead.
--
-- Fix: these functions now only delete the `gallery` metadata rows
-- (a normal table, no restriction) and queue the storage_path into
-- gallery_deleted_pending. The app drains that queue via the real
-- Storage API (see save-generation.ts) right after each save.
-- ─────────────────────────────────────────────────────────────

-- Staging table for storage paths that still need to be removed from
-- the bucket. service_role only — the admin client bypasses RLS anyway.
create table if not exists public.gallery_deleted_pending (
  storage_path text primary key,
  created_at timestamptz not null default now()
);
grant all on public.gallery_deleted_pending to service_role;
alter table public.gallery_deleted_pending enable row level security;

-- Rewritten FIFO trigger: metadata-only delete, queue storage cleanup.
create or replace function public.gallery_enforce_fifo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  victim record;
begin
  for victim in
    select id, storage_path from public.gallery
     where user_id = new.user_id
     order by created_at desc
     offset 20
  loop
    insert into public.gallery_deleted_pending (storage_path)
      values (victim.storage_path)
      on conflict (storage_path) do nothing;
    delete from public.gallery where id = victim.id;
  end loop;
  return new;
end; $$;

-- Rewritten 72h purge: same pattern, metadata-only + queue.
create or replace function public.gallery_purge_expired()
returns void language plpgsql security definer set search_path = public as $$
declare
  victim record;
begin
  for victim in
    select id, storage_path from public.gallery where expires_at < now()
  loop
    insert into public.gallery_deleted_pending (storage_path)
      values (victim.storage_path)
      on conflict (storage_path) do nothing;
    delete from public.gallery where id = victim.id;
  end loop;
end; $$;

-- Note: gallery_fifo_trg (the trigger binding) doesn't need to be
-- recreated — CREATE OR REPLACE FUNCTION keeps it pointed at the new
-- body. pg_cron schedule for gallery_purge_expired() is untouched too.