-- Create game_rounds table to store dynamic daily game sessions
CREATE TABLE IF NOT EXISTS public.game_rounds (
    id SERIAL PRIMARY KEY,
    round_number INT UNIQUE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    draw_time TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.game_rounds IS '일일 URD 게임 회차 시간 설정';
COMMENT ON COLUMN public.game_rounds.round_number IS '게임 회차 번호 (1, 2, 3...)';
COMMENT ON COLUMN public.game_rounds.start_time IS '회차 시작 시간';
COMMENT ON COLUMN public.game_rounds.end_time IS '회차 종료/마감 시간';
COMMENT ON COLUMN public.game_rounds.draw_time IS 'AI 당첨 결과 발표 시간 (자동으로 종료 시간 + 30분)';

-- Insert default 3 rounds
INSERT INTO public.game_rounds (round_number, start_time, end_time, draw_time)
VALUES 
(1, '11:00:00', '12:00:00', '12:30:00'),
(2, '14:00:00', '15:00:00', '15:30:00'),
(3, '17:00:00', '18:00:00', '18:30:00')
ON CONFLICT (round_number) DO NOTHING;
