-- Operator-approved requests are durable; the browser is not their executor.
ALTER TABLE public.trc20_sweep_requests
  ADD COLUMN IF NOT EXISTS auto_attempt_count BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auto_attempt_at TIMESTAMPTZ;

INSERT INTO public.system_settings(key,value) VALUES ('tron_sweep_gas_fund_trx','25')
ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;

-- Preserve tron_sweep_enabled and the operator's minimum company reserve.
DO $migration$
DECLARE
  v_admin_url TEXT;
  v_origin TEXT;
  v_command TEXT;
BEGIN
  SELECT decrypted_secret INTO STRICT v_admin_url FROM vault.decrypted_secrets
  WHERE name='hongbou_admin_cron_url';
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='hongbou_admin_cron_secret' AND length(decrypted_secret)>0) THEN
    RAISE EXCEPTION 'Missing admin cron authentication secret';
  END IF;
  v_origin := regexp_replace(v_admin_url, '/(admin/)?api/cron/auto-draw/?$', '');
  IF v_origin=v_admin_url OR v_origin !~ '^https://[^/[:space:]]+$' THEN
    RAISE EXCEPTION 'Expected an HTTPS admin auto-draw URL';
  END IF;
  v_command := format($command$
    WITH cron_request AS (
      SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS issued_at_ms,
        %L::text AS base_url,
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='hongbou_admin_cron_secret') AS cron_secret
    )
    SELECT net.http_get(
      url := base_url || '?cron_ts=' || issued_at_ms::text || '&cron_sig=' || encode(extensions.hmac(
        convert_to('/api/cron/trc20-usdt-sweep:' || issued_at_ms::text,'UTF8'),
        convert_to(cron_secret,'UTF8'),'sha256'),'hex'),
      timeout_milliseconds := 90000
    ) FROM cron_request
    WHERE EXISTS(SELECT 1 FROM public.trc20_sweep_requests WHERE status IN ('PENDING','GAS_FUNDED','SWEEPING'))
      AND EXISTS(SELECT 1 FROM public.system_settings WHERE key='tron_sweep_enabled' AND value='true');
  $command$,v_origin || '/admin/api/cron/trc20-usdt-sweep');
  PERFORM cron.schedule('hongbou-trc20-usdt-sweep','15 seconds',v_command);
END;
$migration$;
