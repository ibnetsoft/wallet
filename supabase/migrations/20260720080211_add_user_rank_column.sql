-- Alter users table to add rank and commission info
-- NOTE: This migration was applied manually via Supabase SQL editor.
-- Columns star_level and accumulated_revenue are confirmed to exist.
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS star_level INT DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS accumulated_revenue NUMERIC(20, 4) DEFAULT 0 NOT NULL;

