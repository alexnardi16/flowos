-- Reset active task priorities independently for each calendar day.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, (coalesce(deadline_at, starts_at)::date)
      order by
        case when priority is null or priority <= 0 then 1 else 0 end,
        priority nulls last,
        title collate "C",
        id
    ) as new_priority
  from public.commitments
  where kind = 'task'
    and status <> 'done'
    and deleted_at is null
    and coalesce(deadline_at, starts_at) is not null
)
update public.commitments c
set priority = ranked.new_priority
from ranked
where c.id = ranked.id;
