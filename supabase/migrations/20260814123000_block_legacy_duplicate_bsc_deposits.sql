-- The former rpc-watcher used the raw chain transaction hash as the ledger
-- key. The confirmed-block indexer uses one ledger row per Transfer log, so
-- stop an old watcher process from crediting an already-indexed deposit again.
CREATE OR REPLACE FUNCTION public.reject_duplicate_legacy_bsc_usdt_deposit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.tx_type = 'DEPOSIT'
     AND NEW.tx_hash ~* '^0x[0-9a-f]{64}$'
     AND NEW.details ->> 'source' = 'on_chain'
     AND NEW.details ->> 'chain' = 'BSC'
     AND EXISTS (
       SELECT 1
       FROM public.bsc_usdt_deposits AS deposit
       WHERE lower(deposit.tx_hash) = lower(NEW.tx_hash)
         AND deposit.user_id = NEW.user_id
         AND deposit.amount = NEW.amount
         AND lower(deposit.to_address) = lower(COALESCE(NEW.details ->> 'to_address', ''))
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'BSC USDT deposit was already credited by the confirmed-block indexer';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reject_duplicate_legacy_bsc_usdt_deposit ON public.ledger_entries;
CREATE TRIGGER trg_reject_duplicate_legacy_bsc_usdt_deposit
  BEFORE INSERT ON public.ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_duplicate_legacy_bsc_usdt_deposit();

REVOKE ALL ON FUNCTION public.reject_duplicate_legacy_bsc_usdt_deposit() FROM PUBLIC;
