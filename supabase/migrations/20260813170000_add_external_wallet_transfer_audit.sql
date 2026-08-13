-- Records the full lifecycle of administrative on-chain USDT and BNB transfers.
-- Existing historical rows are preserved as LEGACY records.
ALTER TABLE public.vault_transfers
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN IF NOT EXISTS tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS requested_by TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'BSC',
  ADD COLUMN IF NOT EXISTS transfer_kind TEXT NOT NULL DEFAULT 'COLD_VAULT',
  ADD COLUMN IF NOT EXISTS source_address TEXT,
  ADD COLUMN IF NOT EXISTS transaction_nonce BIGINT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.vault_transfers
  DROP CONSTRAINT IF EXISTS vault_transfers_status_check;

ALTER TABLE public.vault_transfers
  ADD CONSTRAINT vault_transfers_status_check
  CHECK (status IN ('LEGACY', 'PROCESSING', 'BROADCAST', 'CONFIRMED', 'FAILED'));

CREATE UNIQUE INDEX IF NOT EXISTS vault_transfers_idempotency_key_unique
  ON public.vault_transfers (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS vault_transfers_status_created_at_idx
  ON public.vault_transfers (status, created_at DESC);

-- Serializes all on-chain sends made by the master wallet without relying on
-- connection-scoped advisory locks, which are unsafe with transaction poolers.
CREATE TABLE IF NOT EXISTS public.master_wallet_operation_locks (
  lock_key TEXT PRIMARY KEY,
  lock_token UUID NOT NULL,
  locked_by TEXT NOT NULL,
  lock_state TEXT NOT NULL DEFAULT 'LOCKED',
  tx_hash TEXT,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.master_wallet_operation_locks
  ADD COLUMN IF NOT EXISTS lock_state TEXT NOT NULL DEFAULT 'LOCKED',
  ADD COLUMN IF NOT EXISTS tx_hash TEXT;

ALTER TABLE public.master_wallet_operation_locks
  DROP CONSTRAINT IF EXISTS master_wallet_operation_locks_lock_state_check;

ALTER TABLE public.master_wallet_operation_locks
  ADD CONSTRAINT master_wallet_operation_locks_lock_state_check
  CHECK (lock_state IN ('LOCKED', 'BROADCAST'));

-- No browser client needs direct access to this operational audit table.
ALTER TABLE public.vault_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vault_transfers FROM anon, authenticated;
ALTER TABLE public.master_wallet_operation_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.master_wallet_operation_locks FROM anon, authenticated;

COMMENT ON COLUMN public.vault_transfers.idempotency_key IS
  'Prevents duplicate administrative broadcasts caused by browser retry or double-click.';
