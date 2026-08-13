-- system_settings can contain server-only wallet signing material. Keep it
-- inaccessible through Supabase's public Data API; admin route handlers use
-- the direct server database connection instead.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.system_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.system_settings FROM anon, authenticated;
