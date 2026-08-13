# Standalone Admin BNB Transfer

This feature is available only at `Admin > BNB 송금`. It uses a dedicated BNB sender wallet and does not change the existing wallet, sweep, withdrawal, or ledger flows.

## Required server-side environment variables

```dotenv
BNB_TRANSFER_ENABLED=true
BNB_TRANSFER_CHAIN_ID=56
BNB_TRANSFER_RPC_URL=https://<trusted-bsc-mainnet-rpc>
BNB_TRANSFER_PRIVATE_KEY=0x<dedicated-bnb-sender-private-key>
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

Do not reuse `WALLET_MASTER_MNEMONIC` or `MASTER_FEE_WALLET_PRIVATE_KEY` for this feature. `BNB_TRANSFER_PRIVATE_KEY` must belong to a separate, BSC-mainnet-only sender wallet.

## Database migration

Apply [20260814090000_create_admin_bnb_transfer_audit.sql](../supabase/migrations/20260814090000_create_admin_bnb_transfer_audit.sql) in Supabase SQL Editor before enabling the feature. It creates only the isolated BNB audit and lock tables.

## Operating procedure

1. Fund the dedicated `BNB_TRANSFER_PRIVATE_KEY` wallet with BSC mainnet BNB.
2. Open `Admin > BNB 송금`.
3. Confirm the source wallet, balance, maximum amount, recipient, and BSC network.
4. Enter an audit note and type `SEND BNB` exactly.
5. Confirm the browser prompt and wait for one BSC block. Use the BscScan transaction link in the audit log to verify the result.

The API rejects a transfer when the amount exceeds the configured maximum or the source balance cannot cover the amount, estimated fee, and retained gas reserve. Never use a non-BSC recipient network.

If the RPC response is interrupted after a transaction is signed, the isolated audit table temporarily retains that exact signed transaction only to retry the same hash. It never stores a private key, it is not returned by the API, and it is cleared after BSC confirms or rejects the transaction.
