# TRC20 USDT collection

Admin > 지갑 & 모으기 관리 includes an independent TRC20 collection panel. It
continues to load even when the existing BSC RPC cannot be reached.

## Setup and operator flow

Apply `20261022043049_implement_trc20_custody_sweep.sql` after the existing
TRC20 migrations. It extends the private `trc20_sweep_requests` table and does
not activate collection. Deploy `apps/admin` with the existing server-only
`DATABASE_URL`, `WALLET_MASTER_MNEMONIC`, Supabase settings, and `CRON_SECRET`.
`TRONGRID_API_KEY` is optional. Signing uses the mainnet TronGrid host only.

1. Register or import the company's TRON wallet in System Settings. The saved
   public address must match its private key. Activate and fund that company
   address with TRX before attempting collection.
2. In the TRC20 panel, set the maximum TRX top-up per request and minimum
   company TRX reserve. Explicitly enable collection. No automatic sweeps or
   configuration changes happen merely by applying the migration.
3. Review a funded wallet row (or all listed wallets), including the on-chain USDT balance, company recipient,
   source/company TRX balances, maximum top-up, and contract energy fee limit.
   This preview cannot sign or broadcast a transaction. Each review expires
   after five minutes and is authenticated by a server HMAC.
4. Confirm the reviewed collection. The request first tops up an owned member
   address if necessary, then waits for a solid TRX receipt before sending
   USDT. The server worker automatically advances the same approved request
   through every phase; the browser can be closed.
5. Completion requires a solid receipt and the exact official USDT Transfer
   event (contract, sender, recipient, amount). A broadcast acknowledgement
   alone is not completion. Transaction links appear in the request history.

The source wallet must match its TRON BIP-44 derivation from the server
mnemonic, and the recipient always comes from server settings. No recipient,
private key, or unsigned transaction supplied by a browser is accepted.
Only a `SUPER_ADMIN` session may view or execute these endpoints; POST also
requires the same Origin.

## Accounting and retries

Collection is custody movement, not a customer withdrawal. Neither the Tron
collector nor the corrected BSC collector reduces `user_balances` or writes
a negative WITHDRAW entry. Customer spendable balances therefore remain
unchanged after coins reach the company wallet.

The private DB outbox persists each signed transaction and TX ID **before**
broadcast. A repeated idempotency key returns the same request; unique active
source/target indexes serialize collection, and a 90-second lease prevents
overlapping handlers. An uncertain broadcast may only retransmit those same
signed bytes. A missing receipt or expired transaction leaves the request
active for investigation; it must not trigger another gas payment or fresh
USDT transaction automatically. Inspect the recorded TX IDs before operator
or DBA recovery of an unresolved request. Signed bytes are excluded from all
browser responses and erased after successful completion.

Resource costs are simulated from the official contract's exact Transfer
event and current energy price, with an energy buffer and bandwidth reserve.
The legacy USDT return word can be zero even when the simulation succeeds;
the event is validated instead. A quote over the configured top-up cap is
blocked. TRX remaining on a member address after execution is not collected.

## Verification

`npm run test:trc20-sweep` in `apps/admin` runs offline tests for amount
precision, substituted transactions, receipt matching, read-only previews,
gas limits, disabled execution, lost-response recovery, idempotency, and
occupied leases. No test broadcasts funds. Real gas funding and USDT transfer
still require operator execution and on-chain confirmation.
## Funded wallet list

The TRC20 section lists only member TRON addresses whose mainnet USDT balance
is greater than zero. `/api/wallet/trc20-sweep?balances=1` reads the official
USDT contract through the throttled TRON adapter, independently of the member's
unified application balance. The list includes the full address, member and
actual token quantity; the summary totals only successful positive lookups.
Lookup failures and addresses not reached within the scan time budget are
reported as unknown, not zero. Refresh to check them again.

Operators can review one listed wallet or all funded wallets. Each review still
requires its own confirmed execution. The existing durable request, signed quote,
idempotency and one-active-company-request protections remain in place. Once a
request is pending, the server automatically advances it until confirmed before
collecting the next wallet. No page load, balance refresh or review broadcasts a transaction.

Company TRON wallet generation stores the private key only in the server database
setting and returns the public address. Generation refuses to replace an existing
company wallet. A newly generated address must be activated and funded with TRX
before gas sponsorship and collection can execute. Generation does not enable
sweeping or transfer funds.

## Automatic server processing

Apply `20261022142427_enable_automatic_trc20_sweep_worker.sql` with the updated
admin deployment. It sets the requested per-wallet TRX top-up cap to **25 TRX**,
adds attempt timestamps/counters, and schedules `hongbou-trc20-usdt-sweep` every
15 seconds using Supabase pg_cron and pg_net. It preserves the existing
`tron_sweep_enabled` flag and company TRX reserve (currently 50 TRX).

The SQL scheduler dispatches authenticated HTTP only when an approved active
request exists and sweeping is enabled. The transport path includes `/admin`;
the HMAC signs `/api/cron/trc20-usdt-sweep`, matching Next's stripped handler path.
The shared secret is read from Vault and never returned to the browser.

Each worker invocation advances at most one existing approved request. A global
Postgres advisory lock prevents overlapping workers and the existing request
lease prevents overlap with the initial execution or administrative recovery.
No worker scans wallets to create new sweep requests. The UI refreshes progress
every five seconds; it does not perform the transaction transitions.

Temporary RPC errors remain retryable. Signed transaction bytes are persisted
before broadcasting and reused on retry; no replacement gas funding or USDT
transaction is created after an uncertain response. Once a signed transaction's
broadcast validity has expired, automatic processing only checks its existing TX
for a solid receipt. It never rebroadcasts expired bytes or silently issues a new
transaction. An unresolved expired TX may require operator investigation.

Turning sweeping off pauses further worker activity. Turning it back on resumes
approved active requests. The initial operator confirmation still authorizes a
specific source, target, USDT quantity and maximum gas funding. Collection never
changes member application balances.

Offline tests cover the complete worker-driven lifecycle without a browser,
occupied/disabled workers, lock release on failure, transient pre-signing RPC
errors, and expired-transaction confirmation without duplicate broadcasts.
Production probes must use no active requests and must not execute a real sweep
merely to verify deployment.
