# Admin External USDT and BNB Transfer

The admin wallet page can send real USDT or native BNB from the master hot wallet to an external BSC address.

## Required deployment settings

Set these server-side environment variables for the `apps/admin` deployment. Never place the private key in `NEXT_PUBLIC_*`, the database, source control, or browser storage.

```dotenv
MASTER_HOT_WALLET_PRIVATE_KEY=0x<master-hot-wallet-private-key>
ADMIN_EMAILS=admin1@example.com,admin2@example.com
EXTERNAL_USDT_TRANSFERS_ENABLED=true
EXTERNAL_BNB_TRANSFERS_ENABLED=true
WALLET_TRANSFER_ADMIN_EMAILS=admin1@example.com,admin2@example.com
BSC_RPC_URL=https://<trusted-bsc-mainnet-rpc>
BSC_CHAIN_ID=56
USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
```

`WALLET_TRANSFER_ADMIN_EMAILS` is optional. If it is omitted, `ADMIN_EMAILS` is used. Each asset is deliberately disabled unless every condition below is met:

- `EXTERNAL_USDT_TRANSFERS_ENABLED` is exactly `true`.
- `EXTERNAL_BNB_TRANSFERS_ENABLED` is exactly `true` before native BNB transfers are enabled.
- The deployment uses BSC mainnet (`BSC_CHAIN_ID=56`).
- `USDT_CONTRACT_ADDRESS`, if set, matches the supported BSC mainnet USDT contract shown above.
- `MASTER_HOT_WALLET_PRIVATE_KEY` is valid and present only on the server.
- The signed-in administrator is included in `ADMIN_EMAILS`.
- The signed-in administrator is included in the transfer-specific allow list.

The master wallet must hold enough BEP-20 USDT and BNB for the BSC network fee. A BNB transfer is rejected if its amount plus the estimated network fee exceeds the wallet's BNB balance.

## Admin operation

1. Open `Admin > Wallet`.
2. Enter the recipient's BSC `0x...` address and select the matching USDT or native BNB transfer panel.
3. Add an audit note, then type `SEND USDT` or `SEND BNB` exactly.
4. Review the browser confirmation dialog and approve it.
5. Wait for one BSC block confirmation. The audit log saves the status and transaction hash; open the BSCScan link to independently verify it.

Never use an ERC-20, TRC-20, or other non-BSC network for this form. Do not attempt to send the full BNB balance; network gas must remain in the master wallet.

## Safeguards

- The transfer is executed only by the server route, never by the browser.
- The route verifies the Supabase session and administrator email again, rather than trusting UI access control.
- Recipient address, amount, current USDT or BNB balance, BNB gas balance, configured chain ID, and transaction outcome are checked.
- A shared PostgreSQL lock lease serializes external transfers, withdrawals, and sweeps from the master wallet to avoid nonce races, including through a transaction pooler.
- An idempotency key prevents a retry or double click from broadcasting a second transaction.
- A hash-bearing master-wallet transaction blocks subsequent sends until its BSC receipt is reconciled.
- Every request is recorded in `public.vault_transfers` as `PROCESSING`, `BROADCAST`, `CONFIRMED`, or `FAILED` with its transaction hash when available.

## Database migration

Apply [20260813170000_add_external_wallet_transfer_audit.sql](../supabase/migrations/20260813170000_add_external_wallet_transfer_audit.sql) before enabling the environment flag. The migration retains historical transfer records and revokes browser-table access to the audit log.

## Existing DB private key cleanup

Older deployments may contain `master_hot_wallet_private_key` or `hot_wallet_history` in `public.system_settings`. The application now ignores and never returns these settings. After confirming the environment variable works in production, remove the legacy secrets manually in Supabase SQL Editor:

```sql
DELETE FROM public.system_settings
WHERE key IN ('master_hot_wallet_private_key', 'hot_wallet_history');
```

Do not run this cleanup before `MASTER_HOT_WALLET_PRIVATE_KEY` has been securely configured in the deployment environment.
