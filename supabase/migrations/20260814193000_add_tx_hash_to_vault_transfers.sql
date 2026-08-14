ALTER TABLE public.vault_transfers
  ADD COLUMN IF NOT EXISTS tx_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_vault_transfers_tx_hash
  ON public.vault_transfers (tx_hash)
  WHERE tx_hash IS NOT NULL;
