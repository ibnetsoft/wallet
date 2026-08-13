-- Isolated audit log for the standalone administrator BNB transfer page.
-- This does not alter existing wallet, withdrawal, sweep, or ledger tables.
CREATE TABLE IF NOT EXISTS public.admin_bnb_transfers (
  id UUID PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  requested_by TEXT NOT NULL,
  source_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount NUMERIC(36, 18) NOT NULL CHECK (amount > 0),
  chain_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'BROADCAST', 'CONFIRMED', 'FAILED')),
  transaction_nonce BIGINT,
  tx_hash TEXT UNIQUE,
  -- Used only to re-broadcast the exact same transaction after an RPC timeout.
  -- It never contains a private key and is not returned by the API.
  signed_transaction TEXT,
  note TEXT,
  failure_reason TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_bnb_transfers
  ADD COLUMN IF NOT EXISTS signed_transaction TEXT;

CREATE INDEX IF NOT EXISTS admin_bnb_transfers_created_at_idx
  ON public.admin_bnb_transfers (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_bnb_transfers_status_idx
  ON public.admin_bnb_transfers (status, created_at DESC);

-- A durable lock keeps only this feature's dedicated sender wallet from using
-- the same BSC nonce in concurrent browser requests.
CREATE TABLE IF NOT EXISTS public.admin_bnb_transfer_locks (
  lock_key TEXT PRIMARY KEY,
  lock_token UUID NOT NULL,
  locked_by TEXT NOT NULL,
  lock_state TEXT NOT NULL CHECK (lock_state IN ('LOCKED', 'BROADCAST')),
  tx_hash TEXT,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_bnb_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_bnb_transfer_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_bnb_transfers FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_bnb_transfer_locks FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_bnb_transfers FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_bnb_transfer_locks FROM anon, authenticated;
