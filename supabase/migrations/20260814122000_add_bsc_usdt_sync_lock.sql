-- Existing deployments may have applied the initial deposit-indexer migration
-- before the durable lease table was added. Keep this migration idempotent.
CREATE TABLE IF NOT EXISTS public.bsc_usdt_deposit_sync_locks (
  cursor_key TEXT PRIMARY KEY,
  lock_token TEXT NOT NULL,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.bsc_usdt_deposit_sync_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bsc_usdt_deposit_sync_locks FROM PUBLIC;
REVOKE ALL ON TABLE public.bsc_usdt_deposit_sync_locks FROM anon, authenticated;
