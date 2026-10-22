# TRON (TRC20) USDT deposits

The repository includes the recovered September 16 production source for the
user app and admin app, plus the October 22 deposit-sync repair. Deploy from
these tracked sources; the recovery snapshots and operation logs are local
artifacts and are not required to build either app.

## Setup

1. Install each app's dependencies with `npm ci` in `apps/user-web` and
   `apps/admin`. Both lockfiles include `tronweb`.
2. Configure the existing server-only `DATABASE_URL`, `WALLET_MASTER_MNEMONIC`
   and Supabase settings. Configure `CRON_SECRET` on the admin deployment.
   Never commit actual environment values or wallet keys.
3. Apply the repository's existing migrations in order, including:
   - `20260916023409_add_trc20_usdt_deposit_support.sql`
   - `20260916024831_schedule_trc20_usdt_deposit_sync.sql`
   - `20260916031037_add_trc20_sweep_wallet_settings.sql`
   - `20261022041704_fix_trc20_deposit_sync_admin_path.sql`
4. Deploy the user app from `apps/user-web` and the admin app from `apps/admin`.
   The admin app's default base path is `/admin`.

The scheduler migrations require the existing Supabase Vault entries
`hongbou_admin_cron_url` (the admin auto-draw URL) and
`hongbou_admin_cron_secret`. The latter must match the admin's `CRON_SECRET`.
The repair accepts the auto-draw URL with or without `/admin` and changes only
the TRC20 job command, preserving its five-minute schedule and active state.
Do not overwrite the shared Vault URL to repair just one job.

## Deposit flow

- `wallet-generation.ts` allocates TRON addresses using BIP-44 coin type 195,
  independently of BSC addresses. The wallet API accepts `{ "network": "TRON" }`.
- Only the official mainnet USDT contract
  `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` is supported.
- The indexer queries confirmed incoming transfers for registered `TRON`
  addresses. Requests are spaced by 1.1 seconds to avoid anonymous-provider
  bursts. An optional server-only `TRONGRID_API_KEY` is supported.
- `trc20_rpc_urls` can configure providers that expose the TronGrid-compatible
  `/v1/accounts/{address}/transactions/trc20` API. A generic JSON-RPC endpoint
  is not sufficient. The public TronGrid endpoint is the fallback.
- The `(contract_address, tx_hash, event_index)` unique constraint and one DB
  transaction protect the deposit row, USDT balance, and ledger entry from
  repeated credit. A transfer's recipient must match the registered address.
- Current indexing reads up to 200 transfers per address per run. Large
  histories need a separate pagination/backfill improvement.

## Scheduler URL and authentication

For the standard `/admin` deployment, these paths intentionally differ:

| Purpose | Path |
| --- | --- |
| Public HTTP endpoint | `/admin/api/cron/trc20-usdt-deposit-sync` |
| Path in the HMAC message | `/api/cron/trc20-usdt-deposit-sync` |

Next.js removes the admin base path before the handler validates its request
URL. The HMAC message is the second path followed by `:` and the millisecond
timestamp. An authenticated HEAD request validates credentials without
processing deposits. An authenticated GET processes deposits.

The route allows 60 seconds; the scheduler waits up to 90 seconds. Responses
include `checkedWallets`, `credited`, `duplicates`, and `failedWallets`.
Any failed wallet produces HTTP 503 with `success: false`; partial progress
remains committed and the next run can safely retry.

`cron.job_run_details.status = 'succeeded'` only confirms that SQL queued the
HTTP request. Inspect the matching `net._http_response` row as well. A healthy
run has HTTP 200, `success: true`, and `failedWallets: 0`.

## Validation of the October 22 repair

The production check credited the previously missing 201 USDT transfer once.
The next scheduled run returned `credited: 0`, `duplicates: 1`, and
`failedWallets: 0`. The member balance remained 201 USDT, with one deposit row
and one completed ledger entry. No manual balance adjustment was used.
