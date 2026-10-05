alter table public.commitments
  add column if not exists completed_at timestamptz;

create index if not exists commitments_completed_at_idx
  on public.commitments(user_id, completed_at)
  where completed_at is not null;
