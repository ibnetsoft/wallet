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

  IF v_machine.recommender_id IS NOT NULL THEN
    v_referral_paid := public.credit_capped_bonus(
      v_machine.recommender_id,
      v_usdt_asset_id,
      v_machine.purchase_price * 0.30,
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
