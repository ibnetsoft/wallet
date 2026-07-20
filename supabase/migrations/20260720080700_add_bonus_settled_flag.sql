-- Add bonus_settled flag to user_game_machines for settlement tracking (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_game_machines' AND column_name = 'bonus_settled'
  ) THEN
    ALTER TABLE public.user_game_machines 
    ADD COLUMN bonus_settled BOOLEAN DEFAULT FALSE NOT NULL;
    
    COMMENT ON COLUMN public.user_game_machines.bonus_settled IS 
      'TRUE if the daily settlement cron has already processed referral/foster/imma/cheotan bonuses for this purchase';

    CREATE INDEX idx_game_machines_unsettled ON public.user_game_machines (bonus_settled)
    WHERE bonus_settled = FALSE;
  END IF;

  -- Also ensure purchase_price column exists (used by settlement cron)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_game_machines' AND column_name = 'purchase_price'
  ) THEN
    ALTER TABLE public.user_game_machines
    ADD COLUMN purchase_price NUMERIC(20, 4) DEFAULT 0 NOT NULL;
  END IF;
END
$$;
