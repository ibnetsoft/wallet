# Member USDT transfers

The wallet's **회원 이체 / Transfer / 会员转账** action accepts another member's
BSC (BEP20) or TRON (TRC20) deposit address. The selected network identifies
the recipient; it does not select a separate balance. Both networks fund the
same member USDT balance. This feature charges no fee, broadcasts no blockchain
transaction and does not change on-chain custody balances. External withdrawals
remain a separate feature.

1. Select the recipient address network, paste their address and enter an amount.
2. Verify the recipient nickname, member code, full address and amount.
3. Confirm. Both members receive a completed internal-transfer history entry.

## Integrity and access

- `POST /api/transfers/preview` and `POST /api/transfers` require a verified
  Supabase session, same-origin JSON requests and valid network addresses.
  The sender is always the authenticated user, never a supplied ID.
- Only registered member addresses are accepted; self transfers are rejected.
  The submit endpoint rechecks that the address still belongs to the previewed member.
- Amounts are decimal strings with up to six decimal places. PostgreSQL numeric
  arithmetic performs the debit and credit without floating-point rounding.
- Both balance rows are locked in stable UUID order, with an additional
  conditional debit to prevent overspending against concurrent wallet activity.
- The transfer record, two balance changes and paired `TRANSFER_OUT` /
  `TRANSFER_IN` ledger records commit atomically or all roll back.
- A unique `(sender_user_id, request_id)` prevents duplicate transfers across
  concurrent requests and uncertain-response retries. Reusing a request ID with
  different details is rejected. The browser saves the pending request in session
  storage before sending and reuses it after reload or retry.
- `member_usdt_transfers` has RLS enabled and no privileges for `PUBLIC`, `anon`
  or `authenticated`; only the server's database connection writes it.
- Internal transfers are never classified as chain deposits or withdrawal
  requests, so neither the deposit indexer nor withdrawal approval processes
  should process them.

## Installation and validation

Apply `supabase/migrations/20261022053037_add_member_usdt_transfers.sql` before
deploying the updated user app. It preserves existing ledger transaction types
and adds the two internal-transfer types. Deploy the admin app as well for the
localized ledger labels. No additional application environment variables are needed.

Run `npm run test:member-transfer` in `apps/user-web` for amount/address validation.
For the real PostgreSQL integration suite, set `MEMBER_TRANSFER_TEST_DATABASE_URL`
to a disposable Supabase-compatible test database with schema-create privileges
and the standard `anon`/`authenticated` roles. The suite creates and removes a
uniquely named `test_member_transfer_*` schema; it does not use real member data.
It covers exact micro-USDT transfers, duplicate concurrent requests, changed
payload rejection, concurrent overspending, opposite-direction BSC/TRON sends,
rollback on insufficient funds and an injected ledger failure, plus RLS privileges.

Verify production authentication failures and recipient preview without executing
a transfer from a customer's account. A real transfer is a user financial action,
not a deployment smoke test.
