-- ═══════════════════════════════════════════════════════════
-- 369 보상플랜 핵심 관계 컬럼 및 최탄 티켓 추가 마이그레이션
-- ═══════════════════════════════════════════════════════════

-- 1. users 테이블: 추천/후원 관계 컬럼 추가
DO $$
BEGIN
  -- recommender_id: 원래 직추천인 (절대 변하지 않음)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='recommender_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN recommender_id UUID REFERENCES public.users(id);
    COMMENT ON COLUMN public.users.recommender_id IS '원래 직추천인 UUID (변하지 않음)';
  END IF;

  -- sponsor_id: 369 롤업 후 최종 배속된 후원인 (롤업 시 상위 스폰서로 변경됨)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='sponsor_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN sponsor_id UUID REFERENCES public.users(id);
    COMMENT ON COLUMN public.users.sponsor_id IS '롤업 후 최종 배속된 후원인 UUID (3,6,9 롤업 시 상위 스폰서로 변경)';
  END IF;

  -- referral_seq: 추천인이 직접 추천한 N번째 순번 (롤업 판정 기준)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='referral_seq'
  ) THEN
    ALTER TABLE public.users ADD COLUMN referral_seq INT DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN public.users.referral_seq IS '추천인 기준 N번째 직추천 순번 (referral_seq % 3 == 0 이면 롤업 대상)';
  END IF;

  -- original_recommender_id: 롤업으로 sponsor가 바뀐 경우, 원래 추천인 보관
  -- 엄마보너스 케이스 2 발주에 사용
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='original_recommender_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN original_recommender_id UUID REFERENCES public.users(id);
    COMMENT ON COLUMN public.users.original_recommender_id IS '롤업 대상자의 원래 추천인 UUID (엄마보너스 케이스2 발주용). 롤업 비대상자는 NULL';
  END IF;
END
$$;

-- 2. user_game_machines 테이블: 최탄 티켓 수량 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_game_machines' AND column_name='cheotan_tickets'
  ) THEN
    ALTER TABLE public.user_game_machines
    ADD COLUMN cheotan_tickets INT DEFAULT 0 NOT NULL;
    COMMENT ON COLUMN public.user_game_machines.cheotan_tickets IS
      '최탄 티켓 수량: package_level 1($100)→0장, 2($500)→1장, 3($1,000)→3장';
  END IF;
END
$$;

-- 3. ledger_entries: 새 tx_type 값 허용 (FOSTER_BONUS, MAMA_BONUS, CHEOTAN_BONUS, RANK_STAR_BONUS)
--    기존 CHECK 제약을 새 값 포함하도록 교체
ALTER TABLE public.ledger_entries
  DROP CONSTRAINT IF EXISTS check_tx_type;

ALTER TABLE public.ledger_entries
  ADD CONSTRAINT check_tx_type CHECK (tx_type IN (
    'DEPOSIT',
    'WITHDRAW',
    'SWAP_IN',
    'SWAP_OUT',
    'REFERRAL_BONUS',   -- 추천보너스 20%
    'FOSTER_BONUS',     -- 육성보너스 10%
    'MAMA_BONUS',       -- 엄마보너스 100% 매칭
    'CHEOTAN_BONUS',    -- 최탄보너스 티켓 비율 분배
    'RANK_BONUS',       -- (구버전 호환)
    'RANK_STAR_BONUS',  -- 직급보너스 7-Pool
    'CHOITAN_BONUS'     -- (구버전 호환)
  ));

-- 4. 인덱스: 후원 관계 조회 최적화
CREATE INDEX IF NOT EXISTS idx_users_recommender ON public.users (recommender_id);
CREATE INDEX IF NOT EXISTS idx_users_sponsor     ON public.users (sponsor_id);
CREATE INDEX IF NOT EXISTS idx_users_star_level  ON public.users (star_level);
