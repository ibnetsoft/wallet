-- Keep the direct-referral tree and the sponsor-placement tree independent.
-- A member's 3rd, 6th, 9th, ... direct referrals move one additional sponsor
-- generation upward for every multiple of three, while recommender_id remains
-- unchanged for referral and mama-bonus eligibility.

CREATE OR REPLACE FUNCTION public.resolve_recommender_ancestor(
  p_user_id UUID,
  p_generation INTEGER
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH RECURSIVE ancestors AS (
    SELECT
      u.recommender_id AS id,
      1 AS generation,
      ARRAY[p_user_id, u.recommender_id]::UUID[] AS path
    FROM public.users AS u
    WHERE u.id = p_user_id
      AND u.recommender_id IS NOT NULL
      AND u.recommender_id IS DISTINCT FROM p_user_id

    UNION ALL

    SELECT
      parent.recommender_id AS id,
      ancestors.generation + 1 AS generation,
      ancestors.path || parent.recommender_id
    FROM ancestors
    JOIN public.users AS parent ON parent.id = ancestors.id
    WHERE ancestors.generation < p_generation
      AND parent.recommender_id IS NOT NULL
      AND NOT (parent.recommender_id = ANY(ancestors.path))
  )
-- If the requested upper generation does not exist, retain the highest
-- available recommender instead of sending the member back to the direct sponsor.
  SELECT id
  FROM ancestors
  ORDER BY generation DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_recommender_ancestor(UUID, INTEGER) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_user_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_seq INTEGER;
  v_rollup_generation INTEGER;
  v_sponsor UUID;
BEGIN
  IF NEW.status = 'ACTIVE' AND OLD.status IS DISTINCT FROM 'ACTIVE' THEN
    NEW.recommender_id := COALESCE(NEW.recommender_id, NEW.parent_id);

    IF NEW.recommender_id IS NULL THEN
      NEW.sponsor_id := NULL;
      NEW.original_recommender_id := NULL;
      NEW.referral_seq := 0;
      RETURN NEW;
    END IF;

    -- Serialise activations for one recommender so referral_seq is stable.
    PERFORM 1
    FROM public.users
    WHERE id = NEW.recommender_id
    FOR UPDATE;

    SELECT COUNT(*) + 1
    INTO v_seq
    FROM public.users
    WHERE recommender_id = NEW.recommender_id
      AND status = 'ACTIVE'
      AND id <> NEW.id;

    NEW.referral_seq := v_seq;

    IF MOD(v_seq, 3) = 0 THEN
      -- #3 climbs 1 recommender generation, #6 climbs 2, #9 climbs 3, and so on.
      v_rollup_generation := v_seq / 3;
      v_sponsor := public.resolve_recommender_ancestor(
        NEW.recommender_id,
        v_rollup_generation
      );

      NEW.sponsor_id := COALESCE(v_sponsor, NEW.recommender_id);
      NEW.original_recommender_id := CASE
        WHEN NEW.sponsor_id IS DISTINCT FROM NEW.recommender_id
          THEN NEW.recommender_id
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

REVOKE ALL ON FUNCTION public.handle_user_activation() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.settle_machine_purchase(p_machine_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine RECORD;
  v_usdt_asset_id INTEGER;
  v_mama_recipient UUID;
  v_referral_paid NUMERIC := 0;
  v_foster_paid NUMERIC := 0;
  v_mama_paid NUMERIC := 0;
BEGIN
  SELECT
    m.id,
    m.user_id,
    m.purchase_price,
    m.package_level,
    m.bonus_settled,
    u.recommender_id,
    u.sponsor_id
  INTO v_machine
  FROM public.user_game_machines AS m
  JOIN public.users AS u ON u.id = m.user_id
  WHERE m.id = p_machine_id
  FOR UPDATE OF m, u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game machine not found';
  END IF;

  IF v_machine.bonus_settled THEN
    RETURN jsonb_build_object('settled', false, 'reason', 'already_settled');
  END IF;

  SELECT id
  INTO v_usdt_asset_id
  FROM public.assets
  WHERE symbol = 'USDT';

  IF v_usdt_asset_id IS NULL THEN
    RAISE EXCEPTION 'USDT asset is not configured';
  END IF;

  -- Direct-referral bonus always follows recommender_id, including 3/6/9 roll-ups.
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

  -- Foster bonus follows the sponsor-placement tree.
  IF v_machine.sponsor_id IS NOT NULL THEN
    v_foster_paid := public.credit_capped_bonus(
      v_machine.sponsor_id,
      v_usdt_asset_id,
      v_machine.purchase_price * 0.10,
      'FOSTER_BONUS',
      'FOSTER-' || p_machine_id || '-' || v_machine.sponsor_id,
      jsonb_build_object('machine_id', p_machine_id, 'source_user_id', v_machine.user_id)
    );

    -- One mama-bonus match: the foster recipient's direct recommender receives
    -- exactly the foster amount actually paid after the payout cap is applied.
    IF v_foster_paid > 0 THEN
      SELECT recommender_id
      INTO v_mama_recipient
      FROM public.users
      WHERE id = v_machine.sponsor_id;

      IF v_mama_recipient IS NOT NULL
        AND v_mama_recipient IS DISTINCT FROM v_machine.sponsor_id THEN
        v_mama_paid := public.credit_capped_bonus(
          v_mama_recipient,
          v_usdt_asset_id,
          v_foster_paid,
          'MAMA_BONUS',
          'MAMA-' || p_machine_id || '-' || v_mama_recipient,
          jsonb_build_object(
            'machine_id', p_machine_id,
            'source_user_id', v_machine.user_id,
            'foster_recipient_id', v_machine.sponsor_id,
            'foster_paid', v_foster_paid
          )
        );
      END IF;
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

REVOKE ALL ON FUNCTION public.settle_machine_purchase(UUID) FROM PUBLIC;

-- Rebuild placement for existing ACTIVE users without changing direct
-- recommenders or historical ledger entries. This remains callable after a
-- controlled QA hierarchy change.
CREATE OR REPLACE FUNCTION public.rebuild_sponsor_placements(
  p_root_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_recommender_id UUID;
  v_referral_seq INTEGER;
  v_rollup_generation INTEGER;
  v_sponsor_id UUID;
BEGIN
  LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;

  IF p_root_user_id IS NULL THEN
    UPDATE public.users
    SET recommender_id = parent_id
    WHERE recommender_id IS NULL
      AND parent_id IS NOT NULL;
  END IF;

  -- When a root is supplied, rebuild only that member and their direct
  -- referral descendants. Otherwise rebuild the whole active network.
  FOR v_user_id IN
    WITH RECURSIVE target_tree AS (
      SELECT u.id, ARRAY[u.id]::UUID[] AS path
      FROM public.users AS u
      WHERE u.id = p_root_user_id

      UNION ALL

      SELECT child.id, target_tree.path || child.id
      FROM target_tree
      JOIN public.users AS child ON child.recommender_id = target_tree.id
      WHERE NOT (child.id = ANY(target_tree.path))
    )
    SELECT u.id
    FROM public.users AS u
    WHERE u.status = 'ACTIVE'
      AND (
        p_root_user_id IS NULL
        OR u.id IN (SELECT id FROM target_tree)
      )
    ORDER BY u.created_at ASC, u.id ASC
  LOOP
    SELECT recommender_id
    INTO v_recommender_id
    FROM public.users
    WHERE id = v_user_id;

    IF v_recommender_id IS NULL THEN
      UPDATE public.users
      SET sponsor_id = NULL,
          original_recommender_id = NULL,
          referral_seq = 0
      WHERE id = v_user_id;
      CONTINUE;
    END IF;

    SELECT COUNT(*)
    INTO v_referral_seq
    FROM public.users AS sibling
    JOIN public.users AS current_member ON current_member.id = v_user_id
    WHERE sibling.recommender_id = v_recommender_id
      AND sibling.status = 'ACTIVE'
      AND (sibling.created_at, sibling.id) <= (current_member.created_at, current_member.id);

    IF MOD(v_referral_seq, 3) = 0 THEN
      v_rollup_generation := v_referral_seq / 3;
      v_sponsor_id := public.resolve_recommender_ancestor(
        v_recommender_id,
        v_rollup_generation
      );
      v_sponsor_id := COALESCE(v_sponsor_id, v_recommender_id);

      UPDATE public.users
      SET referral_seq = v_referral_seq,
          sponsor_id = v_sponsor_id,
          original_recommender_id = CASE
            WHEN v_sponsor_id IS DISTINCT FROM v_recommender_id
              THEN v_recommender_id
            ELSE NULL
          END
      WHERE id = v_user_id;
    ELSE
      UPDATE public.users
      SET referral_seq = v_referral_seq,
          sponsor_id = v_recommender_id,
          original_recommender_id = NULL
      WHERE id = v_user_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_sponsor_placements(UUID) FROM PUBLIC;
