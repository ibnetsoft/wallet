import { randomUUID } from "crypto";
import type { PoolClient } from "pg";

const MASTER_HOT_WALLET_LOCK_KEY = "master-hot-wallet-on-chain-send";
const LOCK_LEASE_INTERVAL = "30 minutes";
const LOCK_STATE_LOCKED = "LOCKED";
const LOCK_STATE_BROADCAST = "BROADCAST";

export interface MasterWalletLock {
  token: string;
  operation: string;
  state: "LOCKED" | "BROADCAST";
  txHash: string | null;
  lockedUntil: string;
}

/**
 * A persisted lease is safe with transaction-pooled Postgres connections,
 * unlike session advisory locks. Once a transaction hash is recorded the
 * lock remains until that exact transaction is reconciled or resolved.
 */
export async function tryAcquireMasterHotWalletLock(
  client: PoolClient,
  operation: string
) {
  const token = randomUUID();
  const result = await client.query<{ lock_token: string }>(
    `INSERT INTO public.master_wallet_operation_locks (
       lock_key, lock_token, locked_by, lock_state, tx_hash, locked_until
     )
     VALUES ($1, $2, $3, '${LOCK_STATE_LOCKED}', NULL, NOW() + INTERVAL '${LOCK_LEASE_INTERVAL}')
     ON CONFLICT (lock_key) DO UPDATE
       SET lock_token = EXCLUDED.lock_token,
           locked_by = EXCLUDED.locked_by,
           lock_state = '${LOCK_STATE_LOCKED}',
           tx_hash = NULL,
           locked_until = EXCLUDED.locked_until,
           updated_at = NOW()
       WHERE public.master_wallet_operation_locks.lock_state = '${LOCK_STATE_LOCKED}'
         AND public.master_wallet_operation_locks.locked_until <= NOW()
     RETURNING lock_token`,
    [MASTER_HOT_WALLET_LOCK_KEY, token, operation]
  );
  return result.rows[0]?.lock_token === token ? token : null;
}

export async function getMasterHotWalletLock(client: PoolClient): Promise<MasterWalletLock | null> {
  const result = await client.query<{
    lock_token: string;
    locked_by: string;
    lock_state: "LOCKED" | "BROADCAST";
    tx_hash: string | null;
    locked_until: string;
  }>(
    `SELECT lock_token, locked_by, lock_state, tx_hash, locked_until
     FROM public.master_wallet_operation_locks
     WHERE lock_key = $1`,
    [MASTER_HOT_WALLET_LOCK_KEY]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    token: row.lock_token,
    operation: row.locked_by,
    state: row.lock_state,
    txHash: row.tx_hash,
    lockedUntil: row.locked_until,
  };
}

export async function refreshMasterHotWalletLock(client: PoolClient, token: string) {
  const result = await client.query(
    `UPDATE public.master_wallet_operation_locks
     SET locked_until = NOW() + INTERVAL '${LOCK_LEASE_INTERVAL}',
         updated_at = NOW()
     WHERE lock_key = $1 AND lock_token = $2 AND lock_state = '${LOCK_STATE_LOCKED}'
     RETURNING lock_token`,
    [MASTER_HOT_WALLET_LOCK_KEY, token]
  );
  return result.rowCount === 1;
}

export async function markMasterHotWalletTransactionBroadcast(
  client: PoolClient,
  token: string,
  txHash: string
) {
  const result = await client.query(
    `UPDATE public.master_wallet_operation_locks
     SET lock_state = '${LOCK_STATE_BROADCAST}',
         tx_hash = $3,
         locked_until = 'infinity'::timestamptz,
         updated_at = NOW()
     WHERE lock_key = $1 AND lock_token = $2
     RETURNING lock_token`,
    [MASTER_HOT_WALLET_LOCK_KEY, token, txHash]
  );
  return result.rowCount === 1;
}

/**
 * Resumes an operation only after its hash has an on-chain receipt. Callers
 * use this between multi-step sweep transactions; never use it on an
 * uncertain broadcast.
 */
export async function resumeMasterHotWalletLock(client: PoolClient, token: string) {
  const result = await client.query(
    `UPDATE public.master_wallet_operation_locks
     SET lock_state = '${LOCK_STATE_LOCKED}',
         tx_hash = NULL,
         locked_until = NOW() + INTERVAL '${LOCK_LEASE_INTERVAL}',
         updated_at = NOW()
     WHERE lock_key = $1 AND lock_token = $2 AND lock_state = '${LOCK_STATE_BROADCAST}'
     RETURNING lock_token`,
    [MASTER_HOT_WALLET_LOCK_KEY, token]
  );
  return result.rowCount === 1;
}

/**
 * Marks a locked operation as failed before any transaction was signed. It is
 * intentionally limited to LOCKED so a hash-bearing transaction cannot be
 * accidentally released.
 */
export async function failMasterHotWalletLock(client: PoolClient, token: string, reason: string) {
  await client.query(
    `UPDATE public.master_wallet_operation_locks
     SET locked_by = $3,
         locked_until = NOW(),
         updated_at = NOW()
     WHERE lock_key = $1 AND lock_token = $2 AND lock_state = '${LOCK_STATE_LOCKED}'`,
    [MASTER_HOT_WALLET_LOCK_KEY, token, `failed:${reason.slice(0, 200)}`]
  );
}

export async function releaseMasterHotWalletLock(client: PoolClient, token: string) {
  await client.query(
    `DELETE FROM public.master_wallet_operation_locks
     WHERE lock_key = $1 AND lock_token = $2`,
    [MASTER_HOT_WALLET_LOCK_KEY, token]
  );
}
