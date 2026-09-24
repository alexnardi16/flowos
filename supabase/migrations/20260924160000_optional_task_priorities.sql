-- Task execution order is optional. Existing tasks start without a priority.
update public.commitments
set priority = null
where kind = 'task';
