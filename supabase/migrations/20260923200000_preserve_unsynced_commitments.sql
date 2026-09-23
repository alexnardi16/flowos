-- New FlowOS-created commitments do not have a Google external id yet.
-- They must remain visible and persist locally even when their date is outside
-- the Google sync range. Range enforcement applies only after Google linkage.
CREATE OR REPLACE FUNCTION public.enforce_flowos_google_visible_range()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_start timestamptz := make_timestamptz(extract(year from now())::int, 1, 1, 0, 0, 0, 'UTC');
  v_end timestamptz := make_timestamptz(extract(year from now())::int + 2, 1, 1, 0, 0, 0, 'UTC');
  v_date timestamptz;
begin
  if new.external_provider is distinct from 'google' or new.external_id is null then
    return new;
  end if;

  if new.external_resource_type = 'calendar_event' then
    v_date := new.starts_at;
  elsif new.external_resource_type = 'task' then
    v_date := new.deadline_at;
  else
    return new;
  end if;

  if v_date is null or v_date < v_start or v_date >= v_end then
    return null;
  end if;

  return new;
end;
$function$;
