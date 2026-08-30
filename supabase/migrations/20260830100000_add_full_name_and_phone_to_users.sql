ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

COMMENT ON COLUMN public.users.full_name IS '회원 실명';
COMMENT ON COLUMN public.users.phone_number IS '회원 휴대폰번호';
