
DO $$ BEGIN
  CREATE TYPE public.shooter_type AS ENUM ('club','state','national','trials');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_head_coach boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS shooter_type public.shooter_type,
  ADD COLUMN IF NOT EXISTS member_number text;
