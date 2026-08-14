# BSC USDT Deposit Sync

The admin application indexes confirmed BSC mainnet USDT `Transfer` logs sent to addresses in `public.user_wallets`. Each confirmed event is credited once to `user_balances` and written to `ledger_entries`, so it appears in both the user wallet history and **Admin > 전체 거래 내역**.

## Deployment

1. Apply [20260814120000_create_bsc_usdt_deposit_indexer.sql](../supabase/migrations/20260814120000_create_bsc_usdt_deposit_indexer.sql), [20260814121000_schedule_bsc_usdt_deposit_sync.sql](../supabase/migrations/20260814121000_schedule_bsc_usdt_deposit_sync.sql), [20260814122000_add_bsc_usdt_sync_lock.sql](../supabase/migrations/20260814122000_add_bsc_usdt_sync_lock.sql), and [20260814123000_block_legacy_duplicate_bsc_deposits.sql](../supabase/migrations/20260814123000_block_legacy_duplicate_bsc_deposits.sql), in that order.
2. Deploy `apps/admin`.
3. Configure these server-only Vercel environment variables for the admin project:

```dotenv
BSC_RPC_URL=https://bsc-dataseed.binance.org
USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
BSC_DEPOSIT_CONFIRMATIONS=12
BSC_DEPOSIT_SCAN_BLOCK_RANGE=5
BSC_DEPOSIT_MAX_RANGES_PER_RUN=50
BSC_DEPOSIT_RPC_MIN_INTERVAL_MS=150
BSC_DEPOSIT_LIVE_LOOKBACK_BLOCKS=300
```

`BSC_DEPOSIT_RPC_URL` may be set instead of `BSC_RPC_URL` when deposit indexing needs a dedicated RPC endpoint. Either value must be BSC **mainnet** (chain ID `56`). The indexer intentionally ignores `NEXT_PUBLIC_BSC_RPC_URL`, so a browser testnet setting cannot be used for live deposits.

`BSC_DEPOSIT_RPC_MIN_INTERVAL_MS` spaces requests to a shared RPC provider. Keep the default `150` ms when using the current QuickNode endpoint, which has a 15-request-per-second limit. Its Discover plan also restricts `eth_getLogs` to a five-block window, so keep `BSC_DEPOSIT_SCAN_BLOCK_RANGE=5` unless the provider plan changes.

While the historical cursor is behind, a separate recent-block cursor scans the latest `BSC_DEPOSIT_LIVE_LOOKBACK_BLOCKS` (300 by default). That means a new deposit is credited promptly even when an older backfill is still running; the on-chain event key prevents the later backfill from crediting it again.

The existing Supabase internal scheduler reuses `hongbou_admin_cron_url` and `hongbou_admin_cron_secret`. Applying the second migration schedules `/api/cron/bsc-usdt-deposit-sync` every five minutes. This avoids adding a Vercel Cron plan dependency.

## Historical Deposits

On the first run, the indexer starts near the earliest saved BSC user-wallet timestamp and moves forward in durable block ranges. For a controlled backfill, set this only before the first sync:

```dotenv
BSC_DEPOSIT_START_BLOCK=<earlier BSC mainnet block>
```

After the cursor has caught up, remove `BSC_DEPOSIT_START_BLOCK`; it is ignored once the durable cursor exists.

## Operations

- Use **BSC USDT 동기화** in Admin > 전체 거래 내역 to run the same protected sync immediately.
- An incoming transfer is credited after `BSC_DEPOSIT_CONFIRMATIONS` blocks, twelve by default.
- The raw BSC transaction hash is stored in ledger details as `chain_tx_hash`; the screen links that hash to BscScan.
- The event key is `(chain_id, contract_address, tx_hash, log_index)`, so retries and overlapping scheduler/manual requests cannot add balance twice.
- If the old `workers/rpc-watcher` service is still deployed, stop or redeploy its USDT listener before enabling this indexer. The confirmed-block indexer is the authoritative USDT credit path; the database also rejects a legacy credit after that event has already been indexed.

Verify the internal job after applying the migrations:

```sql
SELECT jobname, schedule
FROM cron.job
WHERE jobname = 'hongbou-bsc-usdt-deposit-sync';
```
