CREATE TABLE IF NOT EXISTS public.auto_bet_settings (
  user_id UUID PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  daily_repeat BOOLEAN NOT NULL DEFAULT TRUE,
  rounds INTEGER[] NOT NULL DEFAULT '{}',
  bets_count INTEGER NOT NULL DEFAULT 10 CHECK (bets_count >= 1 AND bets_count <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auto_bet_executions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  round_id INTEGER NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  round_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, round_id, round_date)
);

ALTER TABLE public.auto_bet_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_bet_executions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auto_bet_settings_enabled
  ON public.auto_bet_settings (enabled);

CREATE INDEX IF NOT EXISTS idx_auto_bet_executions_lookup
  ON public.auto_bet_executions (user_id, round_date);
