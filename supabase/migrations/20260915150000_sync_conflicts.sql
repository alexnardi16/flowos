create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid references public.commitments(id) on delete set null,
  external_provider text not null default 'google',
  external_resource_type text,
  external_id text,
  conflict_type text not null,
  local_snapshot jsonb,
  remote_snapshot jsonb,
  message text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists sync_conflicts_user_status_idx on public.sync_conflicts(user_id,status,created_at desc);
create unique index if not exists sync_conflicts_open_identity_idx
  on public.sync_conflicts(user_id, commitment_id, external_id, conflict_type)
  where status='open';

alter table public.sync_conflicts enable row level security;

drop policy if exists "sync conflicts own rows" on public.sync_conflicts;
create policy "sync conflicts own rows" on public.sync_conflicts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
