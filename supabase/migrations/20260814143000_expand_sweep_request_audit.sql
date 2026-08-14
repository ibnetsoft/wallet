ALTER TABLE public.sweep_requests
  ADD COLUMN IF NOT EXISTS dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attempted_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swept_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_db_amount NUMERIC(36, 18),
  ADD COLUMN IF NOT EXISTS total_onchain_amount NUMERIC(36, 18),
  ADD COLUMN IF NOT EXISTS summary JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now());

UPDATE public.sweep_requests
SET updated_at = created_at
WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS sweep_requests_created_at_idx
  ON public.sweep_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS sweep_requests_status_created_at_idx
  ON public.sweep_requests (status, created_at DESC);
