-- 1. BAO and JADE assets insertion
INSERT INTO public.assets (symbol, contract_address, decimals, is_active)
VALUES 
    ('BAO', NULL, 18, true),
    ('JADE', NULL, 0, true)
ON CONFLICT (symbol) DO NOTHING;

-- 2. Game Participants Table
CREATE TABLE IF NOT EXISTS public.game_participants (
    id SERIAL PRIMARY KEY,
    round_id INT REFERENCES public.game_rounds(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    tickets_count INT NOT NULL CHECK (tickets_count > 0),
    status TEXT DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'REFUNDED')),
    won_tickets INT DEFAULT 0,
    lost_tickets INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_round UNIQUE (round_id, user_id)
);

COMMENT ON TABLE public.game_participants IS '유저의 게임 회차별 참여(티켓) 내역';
COMMENT ON COLUMN public.game_participants.tickets_count IS '해당 회차에 구매한 총 티켓(배팅) 수';
COMMENT ON COLUMN public.game_participants.status IS '상태: PENDING(대기), COMPLETED(추첨완료), REFUNDED(환불됨)';

-- 3. Game Round Status Column
ALTER TABLE public.game_rounds ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELED'));
