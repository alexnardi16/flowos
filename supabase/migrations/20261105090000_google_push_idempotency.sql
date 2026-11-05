-- Serialize every Google write for a FlowOS commitment across foreground,
-- background and webhook workers. A short lease permits recovery after a crashed worker.
alter table public.commitments add column if not exists sync_claimed_at timestamptz;

create or replace function public.claim_flowos_google_push(
  p_user_id uuid,
  p_commitment_id uuid,
  p_allow_synced boolean default false
)
returns setof public.commitments
language sql security definer set search_path = public
as $$
  update public.commitments as c
     set sync_status = 'syncing', sync_claimed_at = now()
   where c.id = p_commitment_id and c.user_id = p_user_id and c.deleted_at is null
     and (
       c.sync_status in ('pending', 'error')
       or (c.sync_status = 'syncing' and (c.sync_claimed_at is null or c.sync_claimed_at < now() - interval '5 minutes'))
       or (p_allow_synced and c.sync_status = 'synced' and c.sync_claimed_at is null)
     )
  returning c.*;
$$;

revoke all on function public.claim_flowos_google_push(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_flowos_google_push(uuid, uuid, boolean) to service_role;
create index if not exists commitments_google_claim_lease_idx on public.commitments (user_id, sync_claimed_at) where sync_status = 'syncing';
