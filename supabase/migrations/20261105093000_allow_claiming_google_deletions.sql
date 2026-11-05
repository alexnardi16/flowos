-- The sync worker must also claim tombstoned resolution-pending rows so it can
-- delete their Google resource. Ordinary deleted rows remain ineligible for pushes.
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
   where c.id = p_commitment_id
     and c.user_id = p_user_id
     and (c.deleted_at is null or c.resolution_pending)
     and (
       c.sync_status in ('pending', 'error')
       or (c.sync_status = 'syncing' and (c.sync_claimed_at is null or c.sync_claimed_at < now() - interval '5 minutes'))
       or (p_allow_synced and c.sync_status = 'synced' and c.sync_claimed_at is null)
     )
  returning c.*;
$$;
