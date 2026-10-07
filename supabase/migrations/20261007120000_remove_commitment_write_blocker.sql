-- FlowOS-created commitments must be able to become Google-linked regardless of date.
-- The previous BEFORE INSERT/UPDATE trigger returned NULL outside a date range,
-- which silently cancelled writes (including Google-linking updates and local deletes).
DROP TRIGGER IF EXISTS enforce_google_visible_range ON public.commitments;
DROP FUNCTION IF EXISTS public.enforce_flowos_google_visible_range();

COMMENT ON TABLE public.commitments IS
  'FlowOS commitments. Google sync range is a read/sync concern, never a write blocker.';
