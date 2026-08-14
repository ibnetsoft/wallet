-- Reuse the existing protected admin cron URL and secret. This schedule is
-- optional: when the scheduler has not been provisioned, admins can still run
-- the protected sync manually from the transactions page.
DO $migration$
DECLARE
  v_job RECORD;
BEGIN
  IF to_regnamespace('cron') IS NULL
     OR to_regnamespace('vault') IS NULL THEN
    RAISE EXCEPTION 'BSC USDT deposit sync requires pg_cron and Supabase Vault.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'hongbou_admin_cron_url')
     OR NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'hongbou_admin_cron_secret') THEN
    RAISE EXCEPTION 'BSC USDT deposit sync requires the existing hongbou admin cron Vault secrets.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'hongbou_admin_cron_url'
      AND decrypted_secret ~ '/api/cron/auto-draw/?$'
  ) THEN
    RAISE EXCEPTION 'hongbou_admin_cron_url must end with /api/cron/auto-draw before scheduling BSC USDT deposit sync';
  END IF;

  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'hongbou-bsc-usdt-deposit-sync'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'hongbou-bsc-usdt-deposit-sync',
    '*/5 * * * *',
    $schedule$
      WITH cron_request AS (
        SELECT
          floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS issued_at_ms,
          regexp_replace(
            (
              SELECT decrypted_secret
              FROM vault.decrypted_secrets
              WHERE name = 'hongbou_admin_cron_url'
            ),
            '/api/cron/auto-draw/?$',
            '/api/cron/bsc-usdt-deposit-sync'
          ) AS base_url,
          (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'hongbou_admin_cron_secret'
          ) AS cron_secret
      )
      SELECT net.http_get(
        url := base_url
          || '?cron_ts=' || issued_at_ms::text
          || '&cron_sig=' || encode(
            extensions.hmac(
              convert_to('/api/cron/bsc-usdt-deposit-sync:' || issued_at_ms::text, 'UTF8'),
              convert_to(cron_secret, 'UTF8'),
              'sha256'
            ),
            'hex'
          ),
        timeout_milliseconds := 30000
      )
      FROM cron_request;
    $schedule$
  );
END;
$migration$;
