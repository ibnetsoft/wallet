# Standalone Admin BNB Transfer

This feature is available only at `Admin > BNB 송금`. It uses the same address and signing key as the existing master hot wallet, so a newly generated master wallet is automatically used as the BNB sender too.

## Required server-side environment variables

```dotenv
BNB_TRANSFER_ENABLED=true
BNB_TRANSFER_CHAIN_ID=56
BNB_TRANSFER_MAX_AMOUNT=0.5
BNB_TRANSFER_GAS_RESERVE=0.005
```

`BNB_TRANSFER_MAX_AMOUNT` is the maximum amount allowed in one request. `BNB_TRANSFER_GAS_RESERVE` is BNB that must remain after the transfer and the estimated network fee; the default is `0.005` if omitted.

Optionally narrow access to selected existing administrators and restrict destinations:

```dotenv
BNB_TRANSFER_ADMIN_EMAILS=admin1@example.com,admin2@example.com
BNB_TRANSFER_RECIPIENT_ALLOWLIST=0xRecipientOne,0xRecipientTwo
```

The BNB-specific administrator list can only narrow the existing `ADMIN_EMAILS` list. The recipient allowlist is optional; if set, every recipient must be in it.

The feature resolves its sender from `system_settings.master_hot_wallet_private_key`, falling back to the server-only `MASTER_HOT_WALLET_PRIVATE_KEY` setting. Its public address is derived from that key whenever the master wallet settings are saved. BSC RPC configuration is shared with the master wallet through `BSC_RPC_URL` or `NEXT_PUBLIC_BSC_RPC_URL`; the prior `BNB_TRANSFER_RPC_URL` setting remains accepted for compatibility.

The initial public fallback address is `0x781dcdb491d5d8596c9F8aB5270f6C9FBAe3B9A4`. The BNB page always reads the BSC on-chain balance for the current master address, including while transfers are disabled. If the saved public address and signing key disagree, transfers are blocked rather than using a different wallet.

## Database migration

Apply [20260814090000_create_admin_bnb_transfer_audit.sql](../supabase/migrations/20260814090000_create_admin_bnb_transfer_audit.sql) and [20260814103000_protect_system_settings_secrets.sql](../supabase/migrations/20260814103000_protect_system_settings_secrets.sql) in Supabase SQL Editor before enabling the feature. The latter prevents the Data API from exposing server-only wallet settings.

## Operating procedure

1. Configure the existing master hot wallet's matching private key in System Settings or `MASTER_HOT_WALLET_PRIVATE_KEY`.
2. Open `Admin > BNB 송금`.
3. Confirm the source wallet, balance, maximum amount, recipient, and BSC network.
4. Enter an audit note and type `SEND BNB` exactly.
5. Confirm the browser prompt and wait for one BSC block. Use the BscScan transaction link in the audit log to verify the result.

The API rejects a transfer when the amount exceeds the configured maximum or the source balance cannot cover the amount, estimated fee, and retained gas reserve. Never use a non-BSC recipient network.

If the RPC response is interrupted after a transaction is signed, the isolated audit table temporarily retains that exact signed transaction only to retry the same hash. It never stores a private key, it is not returned by the API, and it is cleared after BSC confirms or rejects the transaction.
