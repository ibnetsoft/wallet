-- Support daily reusable game rounds and draw transaction types.

ALTER TABLE public.game_rounds
  ADD COLUMN IF NOT EXISTS last_processed_date DATE;

ALTER TABLE public.game_participants
  ADD COLUMN IF NOT EXISTS round_date DATE
  DEFAULT ((now() AT TIME ZONE 'Asia/Shanghai')::date) NOT NULL;

UPDATE public.game_participants
SET round_date = COALESCE(round_date, (created_at AT TIME ZONE 'Asia/Shanghai')::date)
WHERE round_date IS NULL;

ALTER TABLE public.game_participants
  DROP CONSTRAINT IF EXISTS unique_user_round;

ALTER TABLE public.game_participants
  ADD CONSTRAINT unique_user_round_per_day UNIQUE (round_id, user_id, round_date);

CREATE INDEX IF NOT EXISTS idx_game_participants_round_date
  ON public.game_participants (round_id, round_date);

ALTER TABLE public.ledger_entries
  DROP CONSTRAINT IF EXISTS check_tx_type;

ALTER TABLE public.ledger_entries
  ADD CONSTRAINT check_tx_type CHECK (tx_type IN (
    'DEPOSIT',
    'WITHDRAW',
    'SWAP_IN',
    'SWAP_OUT',
    'REFERRAL_BONUS',
    'FOSTER_BONUS',
    'MAMA_BONUS',
    'CHEOTAN_BONUS',
    'RANK_BONUS',
    'RANK_STAR_BONUS',
    'CHOITAN_BONUS',
    'PACKAGE_BUY',
    'PACKAGE_BONUS',
    'GAME_WAGER',
    'GAME_WIN',
    'GAME_REFUND',
    'GAME_REWARD',
    'GAME_CONSOLATION'
  ));
