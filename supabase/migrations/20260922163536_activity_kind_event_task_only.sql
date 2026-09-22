DO $$
BEGIN
  ALTER TABLE public.commitments ALTER COLUMN kind DROP DEFAULT;
  CREATE TYPE public.commitment_kind_v2 AS ENUM ('task', 'event');
  ALTER TABLE public.commitments
    ALTER COLUMN kind TYPE public.commitment_kind_v2
    USING kind::text::public.commitment_kind_v2;
  DROP TYPE public.commitment_kind;
  ALTER TYPE public.commitment_kind_v2 RENAME TO commitment_kind;
  ALTER TABLE public.commitments ALTER COLUMN kind SET DEFAULT 'task'::public.commitment_kind;
END $$;
