-- Internal custody transfers: neither a deposit nor an on-chain withdrawal.
ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS check_tx_type;
ALTER TABLE public.ledger_entries ADD CONSTRAINT check_tx_type CHECK (tx_type IN (
  'DEPOSIT', 'WITHDRAW', 'SWAP_IN', 'SWAP_OUT', 'REFERRAL_BONUS',
  'FOSTER_BONUS', 'MAMA_BONUS', 'CHEOTAN_BONUS', 'RANK_BONUS',
  'RANK_STAR_BONUS', 'CHOITAN_BONUS', 'PACKAGE_BUY', 'PACKAGE_BONUS',
  'GAME_WAGER', 'GAME_WIN', 'GAME_REFUND', 'GAME_REWARD', 'GAME_CONSOLATION',
  'TRANSFER_IN', 'TRANSFER_OUT'
));

CREATE TABLE public.member_usdt_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  sender_user_id UUID NOT NULL REFERENCES public.users(id),
  recipient_user_id UUID NOT NULL REFERENCES public.users(id),
  asset_id INTEGER NOT NULL REFERENCES public.assets(id),
  amount NUMERIC(30,6) NOT NULL CHECK (amount > 0),
  recipient_network TEXT NOT NULL CHECK (recipient_network IN ('BSC', 'TRON')),
  recipient_address TEXT NOT NULL,
  sender_ledger_id UUID REFERENCES public.ledger_entries(id),
  recipient_ledger_id UUID REFERENCES public.ledger_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_user_id, request_id),
  CHECK (sender_user_id <> recipient_user_id)
);
CREATE INDEX member_usdt_transfers_recipient_idx
  ON public.member_usdt_transfers (recipient_user_id, created_at DESC);
ALTER TABLE public.member_usdt_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_usdt_transfers FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.member_usdt_transfers IS
  'Server-only, atomic member USDT transfers with sender-scoped idempotency. Network identifies recipient address; balances are unified.';
