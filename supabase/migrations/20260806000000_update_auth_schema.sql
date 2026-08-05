-- Drop the unique constraint on email
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- Make nickname unique and not null
ALTER TABLE public.users ALTER COLUMN nickname SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_nickname_key UNIQUE (nickname);
