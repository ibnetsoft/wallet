-- ==========================================
-- 📄 Supabase / PostgreSQL Schema v1.1 Migration
-- 369 게임보상플랜 및 중앙화 지갑 원장 데이터 모델 정의
-- ==========================================

-- 1. 사용자 테이블 (Supabase Auth 연동)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nickname TEXT,
    parent_id UUID REFERENCES public.users(id), -- 추천인 (조직도 구현용)
    status TEXT DEFAULT 'PENDING' NOT NULL, -- PENDING: 미구매(조직도 제외), ACTIVE: 구매완료(조직도 노출/수당 개시)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_user_status CHECK (status IN ('PENDING', 'ACTIVE'))
);

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" 
    ON public.users FOR SELECT 
    USING (auth.uid() = id);

-- ==========================================
-- 2. 유저별 블록체인 입금 주소 매핑 테이블
-- ==========================================
CREATE TABLE public.user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    chain_type TEXT DEFAULT 'BSC' NOT NULL,
    address TEXT UNIQUE NOT NULL, -- 유저 고유 입금용 주소
    derivation_index INT UNIQUE NOT NULL, -- HD 지갑 인덱스 번호
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet addresses" 
    ON public.user_wallets FOR SELECT 
    USING (auth.uid() = user_id);

-- ==========================================
-- 3. 자산 종류 마스터 데이터 (USDT, URC 등)
-- ==========================================
CREATE TABLE public.assets (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    symbol TEXT UNIQUE NOT NULL, -- 'USDT', 'URC', 'BNB'
    contract_address TEXT, -- USDT/URC contract 주소 (BNB일 경우 NULL)
    decimals INT DEFAULT 18 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assets information is public" 
    ON public.assets FOR SELECT 
    USING (true);

-- ==========================================
-- 4. 내부 잔고 테이블 (중앙 장부식 관리)
-- ==========================================
CREATE TABLE public.user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    asset_id INT REFERENCES public.assets(id) NOT NULL,
    available_balance NUMERIC(36, 18) DEFAULT 0 NOT NULL, -- 출금/스왑 가능한 잔고
    locked_balance NUMERIC(36, 18) DEFAULT 0 NOT NULL,    -- 출금 대기 중인 묶인 잔고
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_asset UNIQUE (user_id, asset_id),
    CONSTRAINT positive_available CHECK (available_balance >= 0),
    CONSTRAINT positive_locked CHECK (locked_balance >= 0)
);

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own balances" 
    ON public.user_balances FOR SELECT 
    USING (auth.uid() = user_id);

-- ==========================================
-- 5. 통합 거래 원장 테이블 (Ledger)
-- ==========================================
CREATE TABLE public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) NOT NULL,
    asset_id INT REFERENCES public.assets(id) NOT NULL,
    amount NUMERIC(36, 18) NOT NULL, -- 입금은 (+), 출금/스왑은 (-)
    tx_type TEXT NOT NULL, -- 'DEPOSIT', 'WITHDRAW', 'SWAP_IN', 'SWAP_OUT', 'REFERRAL_BONUS', 'RANK_BONUS', 'CHOITAN_BONUS'
    status TEXT DEFAULT 'PENDING' NOT NULL, -- 'PENDING', 'COMPLETED', 'FAILED'
    tx_hash TEXT UNIQUE, -- 중복 입금 방지 UNIQUE 제약
    details JSONB, -- 추가 데이터 (추천인 대상 유저 ID 등)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_tx_type CHECK (tx_type IN ('DEPOSIT', 'WITHDRAW', 'SWAP_IN', 'SWAP_OUT', 'REFERRAL_BONUS', 'RANK_BONUS', 'CHOITAN_BONUS'))
);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ledger entries" 
    ON public.ledger_entries FOR SELECT 
    USING (auth.uid() = user_id);

-- ==========================================
-- 6. 유저별 게임기 구매 및 입장 관리 테이블
-- ==========================================
CREATE TABLE public.user_game_machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    package_level INT NOT NULL, -- 1 ($100), 2 ($500), 3 ($1,000)
    purchase_price NUMERIC(10, 2) NOT NULL,
    total_entry_limit INT NOT NULL, -- 제공된 총 입장 횟수 (10, 50, 100)
    used_entries INT DEFAULT 0 NOT NULL,
    payout_limit_usd NUMERIC(10, 2) NOT NULL, -- 200%, 250%, 300% 지급율 한도액
    accumulated_payout_usd NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT check_package_level CHECK (package_level IN (1, 2, 3)),
    CONSTRAINT check_used_entries CHECK (used_entries <= total_entry_limit)
);

ALTER TABLE public.user_game_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own game machines" 
    ON public.user_game_machines FOR SELECT 
    USING (auth.uid() = user_id);

-- ==========================================
-- 7. 잔여 게임기 입장 횟수 계산용 데이터베이스 뷰 (View)
-- ==========================================
CREATE OR REPLACE VIEW public.v_user_game_allowance AS
SELECT 
    u.id AS user_id,
    COALESCE(SUM(gm.total_entry_limit), 0) AS total_purchased_entries,
    COALESCE(SUM(gm.used_entries), 0) AS total_used_entries,
    (COALESCE(SUM(gm.total_entry_limit), 0) - COALESCE(SUM(gm.used_entries), 0)) AS remaining_entries
FROM public.users u
LEFT JOIN public.user_game_machines gm ON u.id = gm.user_id
GROUP BY u.id;

-- ==========================================
-- 8. 기초 데이터 시드 (Seed Data)
-- ==========================================
INSERT INTO public.assets (symbol, contract_address, decimals, is_active) VALUES
('BNB', NULL, 18, true),
('USDT', '0x55d398326f99059fF775485246999027B3197955', 18, true), -- BSC Mainnet USDT 컨트랙트
('URC', '0x0000000000000000000000000000000000000000', 18, true); -- URC 코인 컨트랙트 (추후 실 배포 주소 매핑)
