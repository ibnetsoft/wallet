-- Repair production drift between the user web application and the database.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS recommender_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS sponsor_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS original_recommender_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS referral_seq INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE public.user_game_machines
  ADD COLUMN IF NOT EXISTS bonus_settled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cheotan_tickets INTEGER NOT NULL DEFAULT 0;

UPDATE public.users
SET recommender_id = parent_id
WHERE recommender_id IS NULL
  AND parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_recommender ON public.users (recommender_id);
CREATE INDEX IF NOT EXISTS idx_users_sponsor ON public.users (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_game_machines_unsettled
  ON public.user_game_machines (bonus_settled)
  WHERE bonus_settled = FALSE;

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

CREATE OR REPLACE FUNCTION public.credit_capped_bonus(
  p_user_id UUID,
  p_asset_id INTEGER,
  p_amount NUMERIC,
  p_tx_type TEXT,
  p_tx_hash TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine RECORD;
  v_remaining NUMERIC := GREATEST(COALESCE(p_amount, 0), 0);
  v_paid NUMERIC := 0;
  v_credit NUMERIC;
BEGIN
  IF v_remaining = 0 THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_tx_hash));
  IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE tx_hash = p_tx_hash) THEN
    RETURN 0;
  END IF;

  FOR v_machine IN
    SELECT id, payout_limit_usd, accumulated_payout_usd
    FROM public.user_game_machines
    WHERE user_id = p_user_id
      AND accumulated_payout_usd < payout_limit_usd
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_credit := LEAST(v_remaining, v_machine.payout_limit_usd - v_machine.accumulated_payout_usd);
    IF v_credit > 0 THEN
      UPDATE public.user_game_machines
      SET accumulated_payout_usd = accumulated_payout_usd + v_credit
      WHERE id = v_machine.id;
      v_paid := v_paid + v_credit;
      v_remaining := v_remaining - v_credit;
    END IF;
  END LOOP;

  IF v_paid > 0 THEN
    INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
    VALUES (
      p_user_id,
      p_asset_id,
      v_paid,
      p_tx_type,
      'COMPLETED',
      p_tx_hash,
      p_details || jsonb_build_object('requested_amount', p_amount, 'paid_amount', v_paid)
    );

    INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
    VALUES (p_user_id, p_asset_id, v_paid, 0, NOW())
    ON CONFLICT (user_id, asset_id) DO UPDATE
      SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
          updated_at = NOW();
  END IF;

  RETURN v_paid;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_machine_purchase(p_machine_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine RECORD;
  v_usdt_asset_id INTEGER;
  v_mama_recommender UUID;
  v_mama_original UUID;
  v_referral_paid NUMERIC := 0;
  v_foster_paid NUMERIC := 0;
  v_mama_paid NUMERIC := 0;
BEGIN
  SELECT m.id, m.user_id, m.purchase_price, m.package_level, m.bonus_settled,
         u.recommender_id, u.sponsor_id
  INTO v_machine
  FROM public.user_game_machines m
  JOIN public.users u ON u.id = m.user_id
  WHERE m.id = p_machine_id
  FOR UPDATE OF m, u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game machine not found';
  END IF;
  IF v_machine.bonus_settled THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'already_settled');
  END IF;

  SELECT id INTO v_usdt_asset_id FROM public.assets WHERE symbol = 'USDT';
  IF v_usdt_asset_id IS NULL THEN
    RAISE EXCEPTION 'USDT asset is not configured';
  END IF;

  IF v_machine.recommender_id IS NOT NULL THEN
    v_referral_paid := public.credit_capped_bonus(
      v_machine.recommender_id,
      v_usdt_asset_id,
      v_machine.purchase_price * 0.20,
      'REFERRAL_BONUS',
      'REFERRAL-' || p_machine_id || '-' || v_machine.recommender_id,
      jsonb_build_object('machine_id', p_machine_id, 'source_user_id', v_machine.user_id)
    );

    UPDATE public.users
    SET accumulated_revenue = COALESCE(accumulated_revenue, 0) + v_machine.purchase_price,
        star_level = CASE
          WHEN COALESCE(accumulated_revenue, 0) + v_machine.purchase_price >= 1000000 THEN 7
          WHEN COALESCE(accumulated_revenue, 0) + v_machine.purchase_price >= 300000 THEN 6
          WHEN COALESCE(accumulated_revenue, 0) + v_machine.purchase_price >= 100000 THEN 5
          WHEN COALESCE(accumulated_revenue, 0) + v_machine.purchase_price >= 30000 THEN 4
          WHEN COALESCE(accumulated_revenue, 0) + v_machine.purchase_price >= 10000 THEN 3
          WHEN COALESCE(accumulated_revenue, 0) + v_machine.purchase_price >= 3000 THEN 2
          WHEN COALESCE(accumulated_revenue, 0) + v_machine.purchase_price >= 1000 THEN 1
          ELSE 0
        END
    WHERE id = v_machine.recommender_id;
  END IF;

  IF v_machine.sponsor_id IS NOT NULL THEN
    v_foster_paid := public.credit_capped_bonus(
      v_machine.sponsor_id,
      v_usdt_asset_id,
      v_machine.purchase_price * 0.10,
      'FOSTER_BONUS',
      'FOSTER-' || p_machine_id || '-' || v_machine.sponsor_id,
      jsonb_build_object('machine_id', p_machine_id, 'source_user_id', v_machine.user_id)
    );

    SELECT recommender_id, original_recommender_id
    INTO v_mama_recommender, v_mama_original
    FROM public.users
    WHERE id = v_machine.sponsor_id;

    IF v_mama_recommender IS NOT NULL THEN
      v_mama_paid := v_mama_paid + public.credit_capped_bonus(
        v_mama_recommender,
        v_usdt_asset_id,
        v_machine.purchase_price * 0.10,
        'MAMA_BONUS',
        'MAMA1-' || p_machine_id || '-' || v_mama_recommender,
        jsonb_build_object('machine_id', p_machine_id, 'source_user_id', v_machine.user_id)
      );
    END IF;

    IF v_mama_original IS NOT NULL AND v_mama_original IS DISTINCT FROM v_mama_recommender THEN
      v_mama_paid := v_mama_paid + public.credit_capped_bonus(
        v_mama_original,
        v_usdt_asset_id,
        v_machine.purchase_price * 0.10,
        'MAMA2-' || p_machine_id || '-' || v_mama_original,
        jsonb_build_object('machine_id', p_machine_id, 'source_user_id', v_machine.user_id)
      );
    END IF;
  END IF;

  UPDATE public.user_game_machines
  SET bonus_settled = TRUE,
      cheotan_tickets = CASE package_level WHEN 2 THEN 1 WHEN 3 THEN 3 ELSE 0 END
  WHERE id = p_machine_id;

  RETURN jsonb_build_object(
    'settled', true,
    'referral_paid', v_referral_paid,
    'foster_paid', v_foster_paid,
    'mama_paid', v_mama_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_capped_bonus(UUID, INTEGER, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_machine_purchase(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_user_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_parent_sponsor UUID;
BEGIN
  IF NEW.status = 'ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE' THEN
    NEW.recommender_id := COALESCE(NEW.recommender_id, NEW.parent_id);
    IF NEW.recommender_id IS NULL THEN
      NEW.sponsor_id := NULL;
      NEW.original_recommender_id := NULL;
      NEW.referral_seq := 0;
      RETURN NEW;
    END IF;

    PERFORM 1 FROM public.users WHERE id = NEW.recommender_id FOR UPDATE;
    SELECT COUNT(*) + 1 INTO v_seq
    FROM public.users
    WHERE recommender_id = NEW.recommender_id
      AND status = 'ACTIVE'
      AND id <> NEW.id;

    NEW.referral_seq := v_seq;
    IF MOD(v_seq, 3) = 0 THEN
      SELECT sponsor_id INTO v_parent_sponsor FROM public.users WHERE id = NEW.recommender_id;
      NEW.sponsor_id := COALESCE(v_parent_sponsor, NEW.recommender_id);
      NEW.original_recommender_id := CASE
        WHEN NEW.sponsor_id IS DISTINCT FROM NEW.recommender_id THEN NEW.recommender_id
        ELSE NULL
      END;
    ELSE
      NEW.sponsor_id := NEW.recommender_id;
      NEW.original_recommender_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_activation ON public.users;
CREATE TRIGGER trg_user_activation
  BEFORE UPDATE OF status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_activation();

-- Preserve historical payouts; only the controlled QA machines are settled retroactively.
UPDATE public.user_game_machines m
SET bonus_settled = TRUE,
    cheotan_tickets = CASE m.package_level WHEN 2 THEN 1 WHEN 3 THEN 3 ELSE 0 END
WHERE m.bonus_settled = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = m.user_id AND u.nickname LIKE 'QAANTZ%'
  );

-- Product entitlements are game entries, not the Jade bonus quantity.
UPDATE public.user_game_machines m
SET total_entry_limit = CASE m.package_level WHEN 1 THEN 10 WHEN 2 THEN 50 WHEN 3 THEN 100 END
WHERE EXISTS (
  SELECT 1 FROM public.users u
  WHERE u.id = m.user_id AND u.nickname LIKE 'QAANTZ%'
);

-- Activate the root first, then QA users in a deterministic 1..10 referral order.
UPDATE public.users
SET status = 'ACTIVE'
WHERE nickname = 'antz15'
  AND status = 'PENDING'
  AND EXISTS (SELECT 1 FROM public.user_game_machines m WHERE m.user_id = public.users.id);

DO $$
DECLARE
  v_user_id UUID;
  v_machine_id UUID;
BEGIN
  FOR v_user_id IN
    SELECT id
    FROM public.users
    WHERE nickname LIKE 'QAANTZ%'
      AND status = 'PENDING'
      AND EXISTS (SELECT 1 FROM public.user_game_machines m WHERE m.user_id = public.users.id)
    ORDER BY nickname
  LOOP
    UPDATE public.users SET status = 'ACTIVE' WHERE id = v_user_id;
  END LOOP;

  FOR v_machine_id IN
    SELECT m.id
    FROM public.user_game_machines m
    JOIN public.users u ON u.id = m.user_id
    WHERE u.nickname LIKE 'QAANTZ%'
      AND m.bonus_settled = FALSE
    ORDER BY u.nickname, m.created_at, m.id
  LOOP
    PERFORM public.settle_machine_purchase(v_machine_id);
  END LOOP;
END;
$$;
