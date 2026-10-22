-- Signed transactions are a private durable outbox. A timeout must never
-- allocate a second gas payment or a second USDT transfer.
ALTER TABLE public.trc20_sweep_requests
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS source_wallet_id UUID REFERENCES public.user_wallets(id),
  ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS amount_raw NUMERIC(36,0),
  ADD COLUMN IF NOT EXISTS gas_amount_sun BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_limit_sun BIGINT,
  ADD COLUMN IF NOT EXISTS gas_signed_tx JSONB,
  ADD COLUMN IF NOT EXISTS sweep_signed_tx JSONB,
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS trc20_sweep_idempotency_key
  ON public.trc20_sweep_requests(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS trc20_sweep_active_source
  ON public.trc20_sweep_requests(source_address)
  WHERE status IN ('PENDING','GAS_FUNDED','SWEEPING');
-- Serialize gas spending per company wallet, including across serverless instances.
CREATE UNIQUE INDEX IF NOT EXISTS trc20_sweep_active_target
  ON public.trc20_sweep_requests(target_address)
  WHERE status IN ('PENDING','GAS_FUNDED','SWEEPING');

ALTER TABLE public.trc20_sweep_requests
  ADD CONSTRAINT trc20_sweep_positive_raw_amount
  CHECK (amount_raw IS NULL OR amount_raw > 0),
  ADD CONSTRAINT trc20_sweep_bounded_gas
  CHECK (gas_amount_sun BETWEEN 0 AND 100000000
    AND (fee_limit_sun IS NULL OR fee_limit_sun BETWEEN 1 AND 100000000));

ALTER TABLE public.trc20_sweep_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trc20_sweep_requests FROM PUBLIC, anon, authenticated;

-- Do not enable sweeping or change any existing operator spending limits.
INSERT INTO public.system_settings(key,value)
VALUES ('tron_sweep_enabled','false') ON CONFLICT (key) DO NOTHING;
