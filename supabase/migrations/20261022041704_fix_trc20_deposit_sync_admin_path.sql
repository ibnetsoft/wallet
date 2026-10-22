-- Next.js serves the admin app under /admin, but its Request URL passed to
-- the cron handler has that base path removed. Keep transport and signed
-- paths separate. Do not change the shared URL used by other cron jobs.
DO $migration$
DECLARE
  v_job_id BIGINT;
  v_admin_url TEXT;
  v_origin TEXT;
  v_command TEXT;
BEGIN
  SELECT jobid INTO STRICT v_job_id
  FROM cron.job
  WHERE jobname = 'hongbou-trc20-usdt-deposit-sync';

  SELECT decrypted_secret INTO STRICT v_admin_url
  FROM vault.decrypted_secrets
  WHERE name = 'hongbou_admin_cron_url';

  v_origin := regexp_replace(v_admin_url, '/(admin/)?api/cron/auto-draw/?$', '');
  IF v_origin = v_admin_url OR v_origin !~ '^https://[^/[:space:]]+$' THEN
    RAISE EXCEPTION 'Expected an HTTPS admin auto-draw URL in hongbou_admin_cron_url';
  END IF;

  v_command := format($command$
    WITH cron_request AS (
      SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS issued_at_ms,
        %L::text AS base_url,
        (SELECT decrypted_secret FROM vault.decrypted_secrets
         WHERE name = 'hongbou_admin_cron_secret') AS cron_secret
    )
    SELECT net.http_get(
      url := base_url || '?cron_ts=' || issued_at_ms::text
        || '&cron_sig=' || encode(extensions.hmac(
          convert_to('/api/cron/trc20-usdt-deposit-sync:' || issued_at_ms::text, 'UTF8'),
          convert_to(cron_secret, 'UTF8'), 'sha256'), 'hex'),
      timeout_milliseconds := 90000
    ) FROM cron_request;
  $command$, v_origin || '/admin/api/cron/trc20-usdt-deposit-sync');

  PERFORM cron.alter_job(job_id := v_job_id, command := v_command);
END;
$migration$;
