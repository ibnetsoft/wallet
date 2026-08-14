-- Durable event storage for BSC mainnet USDT deposits. The unique chain-event
-- key makes a retry, manual sync, or scheduler overlap safe.
CREATE TABLE IF NOT EXISTS public.bsc_usdt_deposits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  contract_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL CHECK (log_index >= 0),
  block_number BIGINT NOT NULL CHECK (block_number >= 0),
  block_hash TEXT NOT NULL,
  block_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  raw_amount TEXT NOT NULL,
  amount NUMERIC(36, 18) NOT NULL CHECK (amount > 0),
  asset_id INTEGER NOT NULL REFERENCES public.assets(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL CHECK (status IN ('CREDITED', 'LEGACY_CREDITED')),
  credited_ledger_entry_id UUID REFERENCES public.ledger_entries(id),
  credited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT bsc_usdt_deposits_chain_event_key
    UNIQUE (chain_id, contract_address, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS bsc_usdt_deposits_user_created_at_idx
  ON public.bsc_usdt_deposits (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS bsc_usdt_deposits_tx_hash_idx
  ON public.bsc_usdt_deposits (tx_hash);

-- One cursor is maintained for every chain and token contract pairing.
CREATE TABLE IF NOT EXISTS public.chain_sync_cursors (
  cursor_key TEXT PRIMARY KEY,
  last_scanned_block BIGINT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- A durable lease avoids cursor races when a manual sync and the scheduler run
-- at the same time through a transaction-pooled database connection.
CREATE TABLE IF NOT EXISTS public.bsc_usdt_deposit_sync_locks (
  cursor_key TEXT PRIMARY KEY,
  lock_token TEXT NOT NULL,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.bsc_usdt_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chain_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bsc_usdt_deposit_sync_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.bsc_usdt_deposits FROM PUBLIC;
REVOKE ALL ON TABLE public.chain_sync_cursors FROM PUBLIC;
REVOKE ALL ON TABLE public.bsc_usdt_deposit_sync_locks FROM PUBLIC;
REVOKE ALL ON TABLE public.bsc_usdt_deposits FROM anon, authenticated;
REVOKE ALL ON TABLE public.chain_sync_cursors FROM anon, authenticated;
REVOKE ALL ON TABLE public.bsc_usdt_deposit_sync_locks FROM anon, authenticated;
