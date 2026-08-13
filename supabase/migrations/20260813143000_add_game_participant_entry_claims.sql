-- Track which machine entries were consumed by each daily game participation.
CREATE TABLE IF NOT EXISTS public.game_participant_entry_claims (
  id BIGSERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL REFERENCES public.game_participants(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.user_game_machines(id),
  entries_count INTEGER NOT NULL CHECK (entries_count > 0),
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_id, machine_id)
);

ALTER TABLE public.game_participant_entry_claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_game_entry_claims_participant
  ON public.game_participant_entry_claims (participant_id)
  WHERE refunded_at IS NULL;
