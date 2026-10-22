-- Configuration and auditable work queue for TRC20 collection.  The feature
-- remains disabled until an operator explicitly enables it after testing.
CREATE TABLE IF NOT EXISTS public.trc20_sweep_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  source_address TEXT NOT NULL,
  target_address TEXT NOT NULL,
  amount NUMERIC(36, 6) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'GAS_FUNDED', 'SWEEPING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  gas_funding_tx_hash TEXT,
  sweep_tx_hash TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS trc20_sweep_requests_status_created_idx
  ON public.trc20_sweep_requests (status, created_at);

ALTER TABLE public.trc20_sweep_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trc20_sweep_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.trc20_sweep_requests FROM anon, authenticated;

INSERT INTO public.system_settings (key, value)
VALUES
  ('tron_master_hot_wallet', ''),
  ('tron_master_hot_wallet_private_key', ''),
  ('tron_energy_reserve_trx', '50'),
  ('tron_sweep_gas_fund_trx', '15'),
  ('tron_sweep_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
