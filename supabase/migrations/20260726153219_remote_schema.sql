drop extension if exists "pg_net";

create schema if not exists "private";


  create table "private"."google_calendar_sync_state" (
    "user_id" uuid not null,
    "google_calendar_id" text not null,
    "sync_token" text,
    "channel_id" uuid,
    "channel_token" text,
    "resource_id" text,
    "channel_expires_at" timestamp with time zone,
    "last_sync_at" timestamp with time zone,
    "updated_at" timestamp with time zone not null default now()
      );



  create table "private"."google_oauth_tokens" (
    "user_id" uuid not null,
    "access_token" text not null,
    "refresh_token" text,
    "expires_at" timestamp with time zone,
    "token_type" text,
    "scopes" text[] not null default '{}'::text[],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "private"."google_task_sync_state" (
    "user_id" uuid not null,
    "google_task_list_id" text not null,
    "updated_min" timestamp with time zone,
    "last_sync_at" timestamp with time zone,
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."google_calendars" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "google_calendar_id" text not null,
    "summary" text not null,
    "description" text,
    "color_id" text,
    "background_color" text,
    "foreground_color" text,
    "access_role" text not null default 'reader'::text,
    "primary_calendar" boolean not null default false,
    "selected" boolean not null default true,
    "is_default" boolean not null default false,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."google_calendars" enable row level security;


  create table "public"."google_connections" (
    "user_id" uuid not null,
    "google_email" text,
    "google_account_id" text,
    "scopes" text[] not null default '{}'::text[],
    "connected_at" timestamp with time zone not null default now(),
    "last_sync_at" timestamp with time zone,
    "last_sync_status" text not null default 'pending'::text,
    "last_sync_error" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."google_connections" enable row level security;


  create table "public"."google_task_lists" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "google_task_list_id" text not null,
    "title" text not null,
    "selected" boolean not null default true,
    "is_default" boolean not null default false,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."google_task_lists" enable row level security;

alter table "public"."commitments" add column "deleted_at" timestamp with time zone;

alter table "public"."commitments" add column "external_etag" text;

alter table "public"."commitments" add column "external_id" text;

alter table "public"."commitments" add column "external_provider" text;

alter table "public"."commitments" add column "external_resource_type" text;

alter table "public"."commitments" add column "external_updated_at" timestamp with time zone;

alter table "public"."commitments" add column "google_calendar_id" text;

alter table "public"."commitments" add column "google_task_list_id" text;

alter table "public"."commitments" add column "last_sync_origin" text;

alter table "public"."commitments" add column "sync_error" text;

alter table "public"."commitments" add column "sync_status" text not null default 'pending'::text;

CREATE UNIQUE INDEX google_calendar_sync_state_pkey ON private.google_calendar_sync_state USING btree (user_id, google_calendar_id);

CREATE UNIQUE INDEX google_oauth_tokens_pkey ON private.google_oauth_tokens USING btree (user_id);

CREATE UNIQUE INDEX google_task_sync_state_pkey ON private.google_task_sync_state USING btree (user_id, google_task_list_id);

CREATE UNIQUE INDEX commitments_google_external_unique ON public.commitments USING btree (user_id, external_resource_type, COALESCE(google_calendar_id, google_task_list_id), external_id) WHERE ((external_provider = 'google'::text) AND (external_id IS NOT NULL));

CREATE INDEX commitments_google_pending_idx ON public.commitments USING btree (user_id, sync_status, updated_at) WHERE ((external_provider = 'google'::text) OR (sync_status = 'pending'::text));

CREATE UNIQUE INDEX google_calendars_one_default_per_user ON public.google_calendars USING btree (user_id) WHERE (is_default AND (deleted_at IS NULL));

CREATE UNIQUE INDEX google_calendars_pkey ON public.google_calendars USING btree (id);

CREATE UNIQUE INDEX google_calendars_user_id_google_calendar_id_key ON public.google_calendars USING btree (user_id, google_calendar_id);

CREATE INDEX google_calendars_user_selected_idx ON public.google_calendars USING btree (user_id, selected) WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX google_connections_pkey ON public.google_connections USING btree (user_id);

CREATE UNIQUE INDEX google_task_lists_one_default_per_user ON public.google_task_lists USING btree (user_id) WHERE (is_default AND (deleted_at IS NULL));

CREATE UNIQUE INDEX google_task_lists_pkey ON public.google_task_lists USING btree (id);

CREATE UNIQUE INDEX google_task_lists_user_id_google_task_list_id_key ON public.google_task_lists USING btree (user_id, google_task_list_id);

CREATE INDEX google_task_lists_user_selected_idx ON public.google_task_lists USING btree (user_id, selected) WHERE (deleted_at IS NULL);

alter table "private"."google_calendar_sync_state" add constraint "google_calendar_sync_state_pkey" PRIMARY KEY using index "google_calendar_sync_state_pkey";

alter table "private"."google_oauth_tokens" add constraint "google_oauth_tokens_pkey" PRIMARY KEY using index "google_oauth_tokens_pkey";

alter table "private"."google_task_sync_state" add constraint "google_task_sync_state_pkey" PRIMARY KEY using index "google_task_sync_state_pkey";

alter table "public"."google_calendars" add constraint "google_calendars_pkey" PRIMARY KEY using index "google_calendars_pkey";

alter table "public"."google_connections" add constraint "google_connections_pkey" PRIMARY KEY using index "google_connections_pkey";

alter table "public"."google_task_lists" add constraint "google_task_lists_pkey" PRIMARY KEY using index "google_task_lists_pkey";

alter table "private"."google_calendar_sync_state" add constraint "google_calendar_sync_state_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "private"."google_calendar_sync_state" validate constraint "google_calendar_sync_state_user_id_fkey";

alter table "private"."google_oauth_tokens" add constraint "google_oauth_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "private"."google_oauth_tokens" validate constraint "google_oauth_tokens_user_id_fkey";

alter table "private"."google_task_sync_state" add constraint "google_task_sync_state_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "private"."google_task_sync_state" validate constraint "google_task_sync_state_user_id_fkey";

alter table "public"."commitments" add constraint "commitments_external_provider_check" CHECK (((external_provider IS NULL) OR (external_provider = 'google'::text))) not valid;

alter table "public"."commitments" validate constraint "commitments_external_provider_check";

alter table "public"."commitments" add constraint "commitments_external_resource_type_check" CHECK (((external_resource_type IS NULL) OR (external_resource_type = ANY (ARRAY['calendar_event'::text, 'task'::text])))) not valid;

alter table "public"."commitments" validate constraint "commitments_external_resource_type_check";

alter table "public"."commitments" add constraint "commitments_last_sync_origin_check" CHECK (((last_sync_origin IS NULL) OR (last_sync_origin = ANY (ARRAY['flowos'::text, 'google'::text])))) not valid;

alter table "public"."commitments" validate constraint "commitments_last_sync_origin_check";

alter table "public"."commitments" add constraint "commitments_sync_status_check" CHECK ((sync_status = ANY (ARRAY['pending'::text, 'syncing'::text, 'synced'::text, 'error'::text, 'local_only'::text]))) not valid;

alter table "public"."commitments" validate constraint "commitments_sync_status_check";

alter table "public"."google_calendars" add constraint "google_calendars_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."google_calendars" validate constraint "google_calendars_user_id_fkey";

alter table "public"."google_calendars" add constraint "google_calendars_user_id_google_calendar_id_key" UNIQUE using index "google_calendars_user_id_google_calendar_id_key";

alter table "public"."google_connections" add constraint "google_connections_last_sync_status_check" CHECK ((last_sync_status = ANY (ARRAY['pending'::text, 'syncing'::text, 'ok'::text, 'error'::text, 'disconnected'::text]))) not valid;

alter table "public"."google_connections" validate constraint "google_connections_last_sync_status_check";

alter table "public"."google_connections" add constraint "google_connections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."google_connections" validate constraint "google_connections_user_id_fkey";

alter table "public"."google_task_lists" add constraint "google_task_lists_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."google_task_lists" validate constraint "google_task_lists_user_id_fkey";

alter table "public"."google_task_lists" add constraint "google_task_lists_user_id_google_task_list_id_key" UNIQUE using index "google_task_lists_user_id_google_task_list_id_key";

set check_function_bodies = off;

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
  if new.external_provider is distinct from 'google' then
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
$function$
;

CREATE OR REPLACE FUNCTION public.purge_google_items_outside_flowos_range()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_start timestamptz := make_timestamptz(extract(year from now())::int, 1, 1, 0, 0, 0, 'UTC');
  v_end timestamptz := make_timestamptz(extract(year from now())::int + 2, 1, 1, 0, 0, 0, 'UTC');
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.commitments
  where user_id = v_user_id
    and external_provider = 'google'
    and (
      (external_resource_type = 'calendar_event' and (starts_at is null or starts_at < v_start or starts_at >= v_end))
      or
      (external_resource_type = 'task' and (deadline_at is null or deadline_at < v_start or deadline_at >= v_end))
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_default_google_calendar(p_calendar_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.google_calendars where id = p_calendar_id and user_id = (select auth.uid()) and deleted_at is null and selected) then
    raise exception 'Calendar not found, disabled, or not owned by current user';
  end if;
  update public.google_calendars set is_default = false, updated_at = now() where user_id = (select auth.uid()) and is_default;
  update public.google_calendars set is_default = true, updated_at = now() where id = p_calendar_id and user_id = (select auth.uid());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_default_google_task_list(p_task_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.google_task_lists where id = p_task_list_id and user_id = (select auth.uid()) and deleted_at is null and selected) then
    raise exception 'Task list not found, disabled, or not owned by current user';
  end if;
  update public.google_task_lists set is_default = false, updated_at = now() where user_id = (select auth.uid()) and is_default;
  update public.google_task_lists set is_default = true, updated_at = now() where id = p_task_list_id and user_id = (select auth.uid());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

grant delete on table "private"."google_calendar_sync_state" to "service_role";

grant insert on table "private"."google_calendar_sync_state" to "service_role";

grant references on table "private"."google_calendar_sync_state" to "service_role";

grant select on table "private"."google_calendar_sync_state" to "service_role";

grant trigger on table "private"."google_calendar_sync_state" to "service_role";

grant truncate on table "private"."google_calendar_sync_state" to "service_role";

grant update on table "private"."google_calendar_sync_state" to "service_role";

grant delete on table "private"."google_oauth_tokens" to "service_role";

grant insert on table "private"."google_oauth_tokens" to "service_role";

grant references on table "private"."google_oauth_tokens" to "service_role";

grant select on table "private"."google_oauth_tokens" to "service_role";

grant trigger on table "private"."google_oauth_tokens" to "service_role";

grant truncate on table "private"."google_oauth_tokens" to "service_role";

grant update on table "private"."google_oauth_tokens" to "service_role";

grant delete on table "private"."google_task_sync_state" to "service_role";

grant insert on table "private"."google_task_sync_state" to "service_role";

grant references on table "private"."google_task_sync_state" to "service_role";

grant select on table "private"."google_task_sync_state" to "service_role";

grant trigger on table "private"."google_task_sync_state" to "service_role";

grant truncate on table "private"."google_task_sync_state" to "service_role";

grant update on table "private"."google_task_sync_state" to "service_role";

grant delete on table "public"."commitments" to "anon";

grant insert on table "public"."commitments" to "anon";

grant select on table "public"."commitments" to "anon";

grant update on table "public"."commitments" to "anon";

grant delete on table "public"."commitments" to "authenticated";

grant insert on table "public"."commitments" to "authenticated";

grant select on table "public"."commitments" to "authenticated";

grant update on table "public"."commitments" to "authenticated";

grant delete on table "public"."commitments" to "service_role";

grant insert on table "public"."commitments" to "service_role";

grant select on table "public"."commitments" to "service_role";

grant update on table "public"."commitments" to "service_role";

grant delete on table "public"."google_calendars" to "anon";

grant insert on table "public"."google_calendars" to "anon";

grant references on table "public"."google_calendars" to "anon";

grant select on table "public"."google_calendars" to "anon";

grant trigger on table "public"."google_calendars" to "anon";

grant truncate on table "public"."google_calendars" to "anon";

grant update on table "public"."google_calendars" to "anon";

grant delete on table "public"."google_calendars" to "authenticated";

grant insert on table "public"."google_calendars" to "authenticated";

grant references on table "public"."google_calendars" to "authenticated";

grant select on table "public"."google_calendars" to "authenticated";

grant trigger on table "public"."google_calendars" to "authenticated";

grant truncate on table "public"."google_calendars" to "authenticated";

grant update on table "public"."google_calendars" to "authenticated";

grant delete on table "public"."google_calendars" to "service_role";

grant insert on table "public"."google_calendars" to "service_role";

grant references on table "public"."google_calendars" to "service_role";

grant select on table "public"."google_calendars" to "service_role";

grant trigger on table "public"."google_calendars" to "service_role";

grant truncate on table "public"."google_calendars" to "service_role";

grant update on table "public"."google_calendars" to "service_role";

grant delete on table "public"."google_connections" to "anon";

grant insert on table "public"."google_connections" to "anon";

grant references on table "public"."google_connections" to "anon";

grant select on table "public"."google_connections" to "anon";

grant trigger on table "public"."google_connections" to "anon";

grant truncate on table "public"."google_connections" to "anon";

grant update on table "public"."google_connections" to "anon";

grant delete on table "public"."google_connections" to "authenticated";

grant insert on table "public"."google_connections" to "authenticated";

grant references on table "public"."google_connections" to "authenticated";

grant select on table "public"."google_connections" to "authenticated";

grant trigger on table "public"."google_connections" to "authenticated";

grant truncate on table "public"."google_connections" to "authenticated";

grant update on table "public"."google_connections" to "authenticated";

grant delete on table "public"."google_connections" to "service_role";

grant insert on table "public"."google_connections" to "service_role";

grant references on table "public"."google_connections" to "service_role";

grant select on table "public"."google_connections" to "service_role";

grant trigger on table "public"."google_connections" to "service_role";

grant truncate on table "public"."google_connections" to "service_role";

grant update on table "public"."google_connections" to "service_role";

grant delete on table "public"."google_task_lists" to "anon";

grant insert on table "public"."google_task_lists" to "anon";

grant references on table "public"."google_task_lists" to "anon";

grant select on table "public"."google_task_lists" to "anon";

grant trigger on table "public"."google_task_lists" to "anon";

grant truncate on table "public"."google_task_lists" to "anon";

grant update on table "public"."google_task_lists" to "anon";

grant delete on table "public"."google_task_lists" to "authenticated";

grant insert on table "public"."google_task_lists" to "authenticated";

grant references on table "public"."google_task_lists" to "authenticated";

grant select on table "public"."google_task_lists" to "authenticated";

grant trigger on table "public"."google_task_lists" to "authenticated";

grant truncate on table "public"."google_task_lists" to "authenticated";

grant update on table "public"."google_task_lists" to "authenticated";

grant delete on table "public"."google_task_lists" to "service_role";

grant insert on table "public"."google_task_lists" to "service_role";

grant references on table "public"."google_task_lists" to "service_role";

grant select on table "public"."google_task_lists" to "service_role";

grant trigger on table "public"."google_task_lists" to "service_role";

grant truncate on table "public"."google_task_lists" to "service_role";

grant update on table "public"."google_task_lists" to "service_role";


  create policy "Users manage their Google calendars"
  on "public"."google_calendars"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users update their Google connection"
  on "public"."google_connections"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users view their Google connection"
  on "public"."google_connections"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users manage their Google task lists"
  on "public"."google_task_lists"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));


CREATE TRIGGER enforce_google_visible_range BEFORE INSERT OR UPDATE ON public.commitments FOR EACH ROW EXECUTE FUNCTION public.enforce_flowos_google_visible_range();

CREATE TRIGGER google_calendars_touch_updated_at BEFORE UPDATE ON public.google_calendars FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER google_connections_touch_updated_at BEFORE UPDATE ON public.google_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER google_task_lists_touch_updated_at BEFORE UPDATE ON public.google_task_lists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


