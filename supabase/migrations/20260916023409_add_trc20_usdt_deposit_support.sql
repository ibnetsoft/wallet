-- TRC20-USDT deposit support. BSC records remain untouched; each member can
-- now have one independent TRON deposit address as well.
ALTER TABLE public.user_wallets
  DROP CONSTRAINT IF EXISTS user_wallets_derivation_index_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_wallets_chain_derivation_index_key
  ON public.user_wallets (chain_type, derivation_index);

CREATE UNIQUE INDEX IF NOT EXISTS user_wallets_user_chain_key
  ON public.user_wallets (user_id, chain_type);

CREATE TABLE IF NOT EXISTS public.trc20_usdt_deposits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  network TEXT NOT NULL DEFAULT 'TRON' CHECK (network = 'TRON'),
  contract_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  event_index INTEGER NOT NULL CHECK (event_index >= 0),
  block_number BIGINT,
  block_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  raw_amount TEXT NOT NULL,
  amount NUMERIC(36, 6) NOT NULL CHECK (amount > 0),
  asset_id INTEGER NOT NULL REFERENCES public.assets(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL CHECK (status IN ('CREDITED', 'LEGACY_CREDITED')),
  credited_ledger_entry_id UUID REFERENCES public.ledger_entries(id),
  credited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT trc20_usdt_deposits_event_key
    UNIQUE (contract_address, tx_hash, event_index)
);

CREATE INDEX IF NOT EXISTS trc20_usdt_deposits_user_created_at_idx
  ON public.trc20_usdt_deposits (user_id, created_at DESC);

ALTER TABLE public.trc20_usdt_deposits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trc20_usdt_deposits FROM PUBLIC;
REVOKE ALL ON TABLE public.trc20_usdt_deposits FROM anon, authenticated;

INSERT INTO public.system_settings (key, value)
VALUES
  ('tron_wallet_derivation_index', '0'),
  ('trc20_rpc_urls', '')
ON CONFLICT (key) DO NOTHING;
