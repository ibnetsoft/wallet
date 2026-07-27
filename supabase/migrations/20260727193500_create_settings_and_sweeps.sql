-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.system_settings IS '플랫폼 글로벌 시스템 설정 값';

-- Create sweep_requests table
CREATE TABLE IF NOT EXISTS public.sweep_requests (
    id SERIAL PRIMARY KEY,
    total_amount NUMERIC(36, 18) NOT NULL,
    target_wallet TEXT NOT NULL,
    status TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.sweep_requests IS '유저 지갑 자산 모으기(Sweep) 요청 기록';

-- Create vault_transfers table
CREATE TABLE IF NOT EXISTS public.vault_transfers (
    id SERIAL PRIMARY KEY,
    from_label TEXT NOT NULL,
    to_label TEXT NOT NULL,
    amount NUMERIC(36, 18) NOT NULL,
    asset TEXT NOT NULL,
    cold_vault_address TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.vault_transfers IS '핫 지갑 -> 콜드 금고 자산 이체 내역';

-- Seed default settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
('daily_rate', '1.2', '일일 수익률 (%)'),
('min_withdraw', '10.00', '최소 출금 가능 금액 (USDT)'),
('withdrawal_fee_rate', '3', '출금 수수료 (%)'),
('master_hot_wallet', '', '마스터 핫 지갑 주소 (수신처)'),
('hot_balance_usdt', '0', '마스터 핫 지갑 USDT 잔액'),
('cold_balance_usdt', '0', '마스터 핫 지갑 URC 잔액')
ON CONFLICT (key) DO NOTHING;
