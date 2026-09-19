create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(encode(gen_random_bytes(32),'base64'),'flowos_sync_internal_key')
where not exists (select 1 from vault.decrypted_secrets where name='flowos_sync_internal_key');

create or replace function public.get_flowos_sync_internal_key()
returns text
language sql
security definer
set search_path=''
stable
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='flowos_sync_internal_key'
  limit 1;
$$;

revoke execute on function public.get_flowos_sync_internal_key() from public, anon, authenticated;
grant execute on function public.get_flowos_sync_internal_key() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname='flowos-google-sync-minute';

select cron.schedule(
  'flowos-google-sync-minute',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://inifmdkbefwynupqspfr.supabase.co/functions/v1/google-sync-worker',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-flowos-internal-key',(select public.get_flowos_sync_internal_key())
      ),
      body := '{"tasksOnly":true}'::jsonb
    ) as request_id;
  $cron$
);
