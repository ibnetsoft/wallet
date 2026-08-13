-- Secrets are provisioned in Supabase Vault by the deployment procedure. Jobs
-- reference only secret names, so endpoint credentials never enter source code.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'hongbou_user_web_cron_url')
     OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'hongbou_user_web_cron_secret')
     OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'hongbou_admin_cron_url')
     OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'hongbou_admin_cron_secret') THEN
    RAISE EXCEPTION 'Hongbou cron secrets must be provisioned in Vault before scheduling jobs';
  END IF;
END;
$$;

DO $$
DECLARE
  job RECORD;
BEGIN
  FOR job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('hongbou-auto-bet', 'hongbou-auto-draw')
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'hongbou-auto-bet',
  '*/5 * * * *',
  $$
    WITH cron_request AS (
      SELECT
        floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS issued_at_ms,
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hongbou_user_web_cron_url') AS base_url,
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hongbou_user_web_cron_secret') AS cron_secret
    )
    SELECT net.http_get(
      url := base_url
        || '?cron_ts=' || issued_at_ms::text
        || '&cron_sig=' || encode(
          extensions.hmac(
            convert_to('/api/cron/auto-bet:' || issued_at_ms::text, 'UTF8'),
            convert_to(cron_secret, 'UTF8'),
            'sha256'
          ),
          'hex'
        ),
      timeout_milliseconds := 30000
    )
    FROM cron_request;
  $$
);

SELECT cron.schedule(
  'hongbou-auto-draw',
  '*/5 * * * *',
  $$
    WITH cron_request AS (
      SELECT
        floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS issued_at_ms,
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hongbou_admin_cron_url') AS base_url,
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'hongbou_admin_cron_secret') AS cron_secret
    )
    SELECT net.http_get(
      url := base_url
        || '?cron_ts=' || issued_at_ms::text
        || '&cron_sig=' || encode(
          extensions.hmac(
            convert_to('/api/cron/auto-draw:' || issued_at_ms::text, 'UTF8'),
            convert_to(cron_secret, 'UTF8'),
            'sha256'
          ),
          'hex'
        ),
      timeout_milliseconds := 30000
    )
    FROM cron_request;
  $$
);
