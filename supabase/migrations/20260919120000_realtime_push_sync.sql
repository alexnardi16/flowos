create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_select_own" on public.device_push_tokens;
create policy "device_push_tokens_select_own" on public.device_push_tokens for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "device_push_tokens_insert_own" on public.device_push_tokens;
create policy "device_push_tokens_insert_own" on public.device_push_tokens for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "device_push_tokens_update_own" on public.device_push_tokens;
create policy "device_push_tokens_update_own" on public.device_push_tokens for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "device_push_tokens_delete_own" on public.device_push_tokens;
create policy "device_push_tokens_delete_own" on public.device_push_tokens for delete to authenticated using ((select auth.uid()) = user_id);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='commitments') then
    alter publication supabase_realtime add table public.commitments;
  end if;
end $$;
