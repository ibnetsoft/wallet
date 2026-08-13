-- The runtime deploy procedure stores the protected endpoint URLs and secrets
-- in Supabase Vault, then creates the two jobs below.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
