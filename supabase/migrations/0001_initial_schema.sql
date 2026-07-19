create type public.commitment_kind as enum ('task', 'event', 'reminder', 'habit', 'project', 'note');
create type public.commitment_status as enum ('active', 'waiting', 'scheduled', 'blocked', 'someday', 'completed', 'cancelled');
create type public.energy_level as enum ('low', 'medium', 'high');

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  kind public.commitment_kind not null default 'task',
  status public.commitment_status not null default 'active',
  starts_at timestamptz,
  deadline_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  energy public.energy_level,
  context text,
  priority_score numeric not null default 0,
  confidence_score numeric check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  source_text text,
  ai_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commitments enable row level security;

create policy "Users manage their commitments"
on public.commitments
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index commitments_user_status_idx on public.commitments(user_id, status);
create index commitments_user_deadline_idx on public.commitments(user_id, deadline_at);
