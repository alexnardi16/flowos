alter table public.google_connections
  add column if not exists sync_range_start date,
  add column if not exists sync_range_end date;
