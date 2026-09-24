alter table public.commitments
  add column if not exists priority integer;

alter table public.commitments
  drop constraint if exists commitments_priority_positive_check;

alter table public.commitments
  add constraint commitments_priority_positive_check
  check (priority is null or priority >= 1);

with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by coalesce(priority, 2147483647), created_at, id
         ) as new_priority
  from public.commitments
  where kind = 'task'
    and status <> 'completed'
    and deleted_at is null
)
update public.commitments c
set priority = ranked.new_priority
from ranked
where c.id = ranked.id;

alter table public.commitments
  add column if not exists resolution_pending boolean not null default false;

create index if not exists commitments_user_task_priority_idx
  on public.commitments(user_id, priority)
  where kind = 'task' and deleted_at is null and status <> 'completed';

create index if not exists sync_conflicts_resolved_identity_idx
  on public.sync_conflicts(user_id, commitment_id, conflict_type, resolved_at desc)
  where status = 'resolved';
