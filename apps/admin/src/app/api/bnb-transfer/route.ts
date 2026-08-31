import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";
import {
  JsonRpcProvider,
  ZeroAddress,
  formatEther,
  getAddress,
  isAddress,
  keccak256,
  parseEther,
} from "ethers";
import { getBnbTransferAdmin } from "@/lib/bnb-transfer-admin";
import {
  createBscReadProviderFromUrl,
  getBscReadRpcUrls,
} from "@/lib/chain-config";
import {
  DEFAULT_MASTER_HOT_WALLET_ADDRESS,
  resolveMasterHotWallet,
} from "@/lib/master-hot-wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BSC_MAINNET_CHAIN_ID = 56;
const CONFIRMATION_PHRASE = "SEND BNB";
const LOCK_KEY = "isolated-admin-bnb-transfer";
const LOCK_LEASE_INTERVAL = "10 minutes";
const DEFAULT_GAS_RESERVE = "0.005";

type TransferStatus = "PROCESSING" | "BROADCAST" | "CONFIRMED" | "FAILED";

interface TransferSettings {
  issues: string[];
  rpcUrls: string[];
  maxAmountWei: bigint | null;
  gasReserveWei: bigint | null;
  recipientAllowlist: Set<string>;
}

interface TransferLock {
  token: string;
  state: "LOCKED" | "BROADCAST";
  txHash: string | null;
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function sanitizeError(error: unknown) {
  // RPC libraries can include provider URLs or signed transaction payloads in
  // thrown messages. Neither belongs in a browser response or audit record.
  void error;
  return "The BNB transfer operation could not be completed.";
}

function isValidAmount(value: string) {
  return /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value);
}

function isValidIdempotencyKey(value: string) {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

function parsePositiveBnb(value: string | undefined) {
  if (!value || !isValidAmount(value)) {
    return null;
  }

  try {
    const amount = parseEther(value);
    return amount > BigInt(0) ? amount : null;
  } catch {
    return null;
  }
}

function parseRecipientAllowlist(value: string | undefined) {
  const entries = (value ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  return {
    addresses: new Set(entries.filter(isAddress).map((address) => getAddress(address).toLowerCase())),
    hasInvalidEntry: entries.some((address) => !isAddress(address)),
  };
}

function getTransferSettings(): TransferSettings {
  const issues: string[] = [];
  const rpcUrls = getBscReadRpcUrls();
  const maxAmountWei = parsePositiveBnb(process.env.BNB_TRANSFER_MAX_AMOUNT);
  const gasReserveWei = parsePositiveBnb(
    process.env.BNB_TRANSFER_GAS_RESERVE ?? DEFAULT_GAS_RESERVE
  );
  const recipientAllowlist = parseRecipientAllowlist(process.env.BNB_TRANSFER_RECIPIENT_ALLOWLIST);

  if (process.env.BNB_TRANSFER_ENABLED !== "true") {
    issues.push("BNB_TRANSFER_ENABLED=true is required.");
  }
  if (process.env.BNB_TRANSFER_CHAIN_ID !== String(BSC_MAINNET_CHAIN_ID)) {
    issues.push("BNB_TRANSFER_CHAIN_ID=56 is required.");
  }
  if (rpcUrls.length === 0) {
    issues.push("A server-side BSC RPC URL is required.");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    issues.push("A server-side database connection is required.");
  }
  if (!maxAmountWei) {
    issues.push("A positive BNB_TRANSFER_MAX_AMOUNT is required.");
  }
  if (!gasReserveWei) {
    issues.push("BNB_TRANSFER_GAS_RESERVE must be a positive BNB amount.");
  }
  if (recipientAllowlist.hasInvalidEntry) {
    issues.push("BNB_TRANSFER_RECIPIENT_ALLOWLIST contains an invalid BSC address.");
  }

  return {
    issues,
    rpcUrls,
    maxAmountWei,
    gasReserveWei,
    recipientAllowlist: recipientAllowlist.addresses,
  };
}

async function resolveHealthyBscProvider(rpcUrls: string[]) {
  const rpcErrors: Array<{ rpcUrl: string; error: unknown }> = [];

  for (const rpcUrl of rpcUrls) {
    try {
      const provider = createBscReadProviderFromUrl(rpcUrl);
      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(BSC_MAINNET_CHAIN_ID)) {
        rpcErrors.push({
          rpcUrl,
          error: new Error("The configured BSC RPC URL is not connected to BSC mainnet."),
        });
        continue;
      }

      return { provider, rpcUrl };
    } catch (error) {
      rpcErrors.push({ rpcUrl, error });
    }
  }

  const fallbackError = new Error("All configured BSC transfer RPC endpoints failed.");
  (fallbackError as Error & { cause?: unknown }).cause = rpcErrors;
  throw fallbackError;
}

function transferResponse(row: Record<string, unknown>, idempotent = false) {
  const txHash = typeof row.tx_hash === "string" ? row.tx_hash : null;
  const explorerBaseUrl = (process.env.BNB_TRANSFER_EXPLORER_URL || "https://bscscan.com").replace(/\/$/, "");

  return {
    success: true,
    idempotent,
    transfer: {
      id: row.id,
      // PostgreSQL NUMERIC is returned as a string. Keep it that way so the
      // audit response never loses BNB decimal precision in JavaScript.
      amount: String(row.amount),
      recipientAddress: row.recipient_address,
      sourceAddress: row.source_address,
      status: row.status,
      txHash,
      explorerUrl: txHash ? `${explorerBaseUrl}/tx/${txHash}` : null,
      confirmedAt: row.confirmed_at,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
    },
  };
}

function existingTransferResponse(row: Record<string, unknown>) {
  if (row.status === "PROCESSING" || row.status === "BROADCAST") {
    return NextResponse.json(
      {
        ...transferResponse(row, true),
        success: false,
        error: "The earlier BNB transfer is still pending. Check its BscScan transaction before sending again.",
      },
      { status: 409 }
    );
  }

  if (row.status === "FAILED") {
    return NextResponse.json(
      {
        ...transferResponse(row, true),
        success: false,
        error: "The earlier BNB transfer failed. Review the audit log, then submit a new request.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(transferResponse(row, true));
}

async function getTransferLock(client: PoolClient): Promise<TransferLock | null> {
  const result = await client.query<{
    lock_token: string;
    lock_state: "LOCKED" | "BROADCAST";
    tx_hash: string | null;
  }>(
    `SELECT lock_token, lock_state, tx_hash
     FROM public.admin_bnb_transfer_locks
     WHERE lock_key = $1`,
    [LOCK_KEY]
  );
  const row = result.rows[0];
  return row
    ? { token: row.lock_token, state: row.lock_state, txHash: row.tx_hash }
    : null;
}

async function acquireTransferLock(client: PoolClient, lockedBy: string) {
  const token = randomUUID();
  const result = await client.query<{ lock_token: string }>(
    `INSERT INTO public.admin_bnb_transfer_locks (
       lock_key, lock_token, locked_by, lock_state, tx_hash, locked_until
     )
     VALUES ($1, $2, $3, 'LOCKED', NULL, NOW() + INTERVAL '${LOCK_LEASE_INTERVAL}')
     ON CONFLICT (lock_key) DO UPDATE
       SET lock_token = EXCLUDED.lock_token,
           locked_by = EXCLUDED.locked_by,
           lock_state = 'LOCKED',
           tx_hash = NULL,
           locked_until = EXCLUDED.locked_until,
           updated_at = NOW()
       WHERE public.admin_bnb_transfer_locks.lock_state = 'LOCKED'
         AND public.admin_bnb_transfer_locks.locked_until <= NOW()
     RETURNING lock_token`,
    [LOCK_KEY, token, lockedBy]
  );
  return result.rows[0]?.lock_token === token ? token : null;
}

async function markTransferBroadcast(client: PoolClient, token: string, txHash: string) {
  const result = await client.query(
    `UPDATE public.admin_bnb_transfer_locks
     SET lock_state = 'BROADCAST',
         tx_hash = $3,
         locked_until = 'infinity'::timestamptz,
         updated_at = NOW()
     WHERE lock_key = $1 AND lock_token = $2 AND lock_state = 'LOCKED'
     RETURNING lock_token`,
    [LOCK_KEY, token, txHash]
  );
  return result.rowCount === 1;
}

async function releaseTransferLock(client: PoolClient, token: string) {
  await client.query(
    `DELETE FROM public.admin_bnb_transfer_locks
     WHERE lock_key = $1 AND lock_token = $2`,
    [LOCK_KEY, token]
  );
}

async function failLockedTransfer(client: PoolClient, token: string, reason: string) {
  await client.query(
    `UPDATE public.admin_bnb_transfer_locks
     SET locked_by = $3,
         locked_until = NOW(),
         updated_at = NOW()
     WHERE lock_key = $1 AND lock_token = $2 AND lock_state = 'LOCKED'`,
    [LOCK_KEY, token, `failed:${reason.slice(0, 200)}`]
  );
}

async function rebroadcastIfMissing(client: PoolClient, provider: JsonRpcProvider, txHash: string) {
  const knownTransaction = await provider.getTransaction(txHash);
  if (knownTransaction) {
    return;
  }

  const result = await client.query<{ signed_transaction: string | null }>(
    `SELECT signed_transaction
     FROM public.admin_bnb_transfers
     WHERE tx_hash = $1 AND status = 'BROADCAST'
     LIMIT 1`,
    [txHash]
  );
  const signedTransaction = result.rows[0]?.signed_transaction;
  if (!signedTransaction) {
    return;
  }

  try {
    // This reuses the exact audited signature and nonce, so it cannot create a
    // second transfer. It only retries an interrupted broadcast to BSC.
    await provider.broadcastTransaction(signedTransaction);
  } catch {
    // "Already known" and temporary RPC failures are both safe here. The
    // lock remains until BSC returns a receipt for this transaction hash.
  }
}

async function reconcileBroadcastLock(client: PoolClient, provider: JsonRpcProvider) {
  const lock = await getTransferLock(client);
  if (!lock || lock.state !== "BROADCAST" || !lock.txHash) {
    return lock;
  }

  let receipt = await provider.getTransactionReceipt(lock.txHash);
  if (!receipt) {
    await rebroadcastIfMissing(client, provider, lock.txHash);
    receipt = await provider.getTransactionReceipt(lock.txHash);
  }
  if (!receipt) {
    return lock;
  }

  const status: TransferStatus = receipt.status === 1 ? "CONFIRMED" : "FAILED";
  await client.query(
    `UPDATE public.admin_bnb_transfers
     SET status = $2,
         confirmed_at = NOW(),
         failure_reason = $3,
         signed_transaction = NULL,
         updated_at = NOW()
     WHERE tx_hash = $1 AND status = 'BROADCAST'`,
    [
      lock.txHash,
      status,
      status === "CONFIRMED" ? null : "The BSC transaction was mined but reverted.",
    ]
  );
  await releaseTransferLock(client, lock.token);
  return null;
}

function isMigrationError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && ((error as { code?: string }).code === "42P01" || (error as { code?: string }).code === "42703");
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function GET() {
  const admin = await getBnbTransferAdmin();
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  const settings = getTransferSettings();
  // Always show the current master wallet address, even while a signing-key
  // configuration issue keeps transfers disabled.
  let sourceAddress: string | null = DEFAULT_MASTER_HOT_WALLET_ADDRESS;
  let sourceBalance: string | null = null;
  let logs: Record<string, unknown>[] = [];
  let provider: JsonRpcProvider | null = null;

  const hasDatabaseConnection = Boolean(process.env.DATABASE_URL?.trim());
  if (hasDatabaseConnection) {
    try {
      const client = await pool.connect();
      try {
        const masterHotWallet = await resolveMasterHotWallet(client);
        sourceAddress = masterHotWallet.address;
        settings.issues.push(...masterHotWallet.issues);
      } finally {
        client.release();
      }
    } catch {
      settings.issues.push("Unable to load the master hot wallet settings.");
    }
  }

  if (settings.rpcUrls.length > 0 && sourceAddress) {
    try {
      const resolved = await resolveHealthyBscProvider(settings.rpcUrls);
      provider = resolved.provider;
      sourceBalance = formatEther(await provider.getBalance(sourceAddress));
    } catch {
      settings.issues.push("Unable to read the BNB transfer wallet from the configured RPC.");
    }
  }

  if (provider && hasDatabaseConnection) {
    try {
      const client = await pool.connect();
      try {
        // A request can time out after broadcast but before its confirmation
        // arrives. Reconcile that isolated lock whenever the page refreshes.
        await reconcileBroadcastLock(client, provider);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("bnb-transfer GET reconciliation error:", sanitizeError(error));
    }
  }

  if (hasDatabaseConnection) {
    try {
      const result = await pool.query(
        `SELECT id, amount, recipient_address, source_address, status, tx_hash,
                failure_reason, confirmed_at, created_at
         FROM public.admin_bnb_transfers
         ORDER BY created_at DESC
         LIMIT 20`
      );
      logs = result.rows;
    } catch (error) {
      if (isMigrationError(error)) {
        settings.issues.push("The BNB transfer audit migration must be applied before this feature can be used.");
      } else {
        settings.issues.push("Unable to load the BNB transfer audit log.");
      }
    }
  }

  return NextResponse.json({
    success: true,
    enabled: settings.issues.length === 0,
    sourceAddress,
    sourceBalance,
    confirmationPhrase: CONFIRMATION_PHRASE,
    maxAmount: settings.maxAmountWei ? formatEther(settings.maxAmountWei) : null,
    gasReserve: settings.gasReserveWei ? formatEther(settings.gasReserveWei) : null,
    allowlistEnabled: settings.recipientAllowlist.size > 0,
    armingIssues: settings.issues,
    logs,
  });
}

export async function POST(request: Request) {
  const admin = await getBnbTransferAdmin();
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }
  if (!isSameOriginRequest(request)) {
    return errorResponse("Invalid request origin.", 403);
  }

  const settings = getTransferSettings();
  if (settings.issues.length > 0 || settings.rpcUrls.length === 0 || !settings.maxAmountWei || !settings.gasReserveWei) {
    return errorResponse(settings.issues.join(" "), 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON request body.");
  }

  const rawRecipient = typeof body.recipientAddress === "string" ? body.recipientAddress.trim() : "";
  const amountText = typeof body.amount === "string" ? body.amount.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

  if (!isAddress(rawRecipient)) {
    return errorResponse("A valid BSC recipient address is required.");
  }
  if (!isValidAmount(amountText)) {
    return errorResponse("Enter a positive BNB amount with up to 18 decimal places.");
  }
  if (note.length > 500) {
    return errorResponse("The audit note must be 500 characters or fewer.");
  }
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return errorResponse("A valid idempotency key is required.");
  }
  if (confirmation !== CONFIRMATION_PHRASE) {
    return errorResponse(`Type ${CONFIRMATION_PHRASE} to confirm this irreversible transfer.`);
  }

  let amountWei: bigint;
  try {
    amountWei = parseEther(amountText);
  } catch {
    return errorResponse("Invalid BNB amount.");
  }
  if (amountWei <= BigInt(0)) {
    return errorResponse("The transfer amount must be greater than zero.");
  }
  if (amountWei > settings.maxAmountWei) {
    return errorResponse(`The amount exceeds the configured ${formatEther(settings.maxAmountWei)} BNB transfer limit.`);
  }

  const recipientAddress = getAddress(rawRecipient);
  if (
    settings.recipientAllowlist.size > 0
    && !settings.recipientAllowlist.has(recipientAddress.toLowerCase())
  ) {
    return errorResponse("The recipient is not in BNB_TRANSFER_RECIPIENT_ALLOWLIST.", 403);
  }

  let provider: JsonRpcProvider;
  try {
    ({ provider } = await resolveHealthyBscProvider(settings.rpcUrls));
  } catch {
    return errorResponse("Unable to read the BNB transfer wallet from the configured RPC.", 503);
  }
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch {
    return errorResponse("Unable to connect to the BNB transfer audit database.", 503);
  }
  let lockToken: string | null = null;
  let transferId: string | null = null;

  try {
    const masterHotWallet = await resolveMasterHotWallet(client);
    if (
      masterHotWallet.issues.length > 0
      || !masterHotWallet.address
      || !masterHotWallet.signer
    ) {
      return errorResponse(
        masterHotWallet.issues.join(" ") || "The master hot wallet is not ready for BNB transfers.",
        503
      );
    }

    const sourceAddress = masterHotWallet.address;
    const wallet = masterHotWallet.signer.connect(provider);
    if (recipientAddress === ZeroAddress || recipientAddress.toLowerCase() === sourceAddress.toLowerCase()) {
      return errorResponse("The recipient must be a different non-zero BSC address.");
    }
    const existing = await client.query(
      `SELECT id, amount, recipient_address, source_address, status, tx_hash,
              failure_reason, confirmed_at, created_at
       FROM public.admin_bnb_transfers
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (existing.rows[0]) {
      return existingTransferResponse(existing.rows[0]);
    }

    lockToken = await acquireTransferLock(client, admin.email);
    if (!lockToken) {
      try {
        const unresolvedLock = await reconcileBroadcastLock(client, provider);
        if (!unresolvedLock) {
          lockToken = await acquireTransferLock(client, admin.email);
        }
      } catch (reconciliationError) {
        console.error("bnb-transfer lock reconciliation error:", sanitizeError(reconciliationError));
      }
    }
    if (!lockToken) {
      return errorResponse(
        "Another BNB transfer is still pending. Wait for it to settle before sending again.",
        409
      );
    }

    const secondExisting = await client.query(
      `SELECT id, amount, recipient_address, source_address, status, tx_hash,
              failure_reason, confirmed_at, created_at
       FROM public.admin_bnb_transfers
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (secondExisting.rows[0]) {
      return existingTransferResponse(secondExisting.rows[0]);
    }

    // An expired LOCKED lease never reached broadcast; clear only those stale
    // rows after taking ownership of the sender lock.
    await client.query(
      `UPDATE public.admin_bnb_transfers
       SET status = 'FAILED',
           failure_reason = 'Recovered interrupted request before transaction broadcast.',
           updated_at = NOW()
       WHERE source_address = $1
         AND status = 'PROCESSING'
         AND tx_hash IS NULL`,
      [sourceAddress]
    );

    const [nonce, balanceWei] = await Promise.all([
      provider.getTransactionCount(sourceAddress, "pending"),
      provider.getBalance(sourceAddress),
    ]);
    if (amountWei >= balanceWei) {
      return errorResponse(
        `Insufficient BNB. Available: ${formatEther(balanceWei)} BNB; reserve BNB for network fees.`
      );
    }

    const transactionRequest = {
      to: recipientAddress,
      value: amountWei,
      nonce,
    };
    const estimatedGas = await provider.estimateGas({ ...transactionRequest, from: sourceAddress });
    const gasLimit = (estimatedGas * BigInt(12)) / BigInt(10) + BigInt(1000);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    if (!gasPrice) {
      return errorResponse("Unable to determine the BSC gas price. Try again shortly.", 503);
    }
    const estimatedGasCost = gasLimit * gasPrice;
    const requiredBalance = amountWei + estimatedGasCost + settings.gasReserveWei;
    if (requiredBalance > balanceWei) {
      return errorResponse(
        `Insufficient BNB after reserving gas. Available: ${formatEther(balanceWei)} BNB; required: ${formatEther(requiredBalance)} BNB.`
      );
    }

    transferId = randomUUID();
    await client.query(
      `INSERT INTO public.admin_bnb_transfers (
         id, idempotency_key, requested_by, source_address, recipient_address,
         amount, chain_id, status, transaction_nonce, note
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROCESSING', $8, $9)`,
      [
        transferId,
        idempotencyKey,
        admin.email,
        sourceAddress,
        recipientAddress,
        amountText,
        BSC_MAINNET_CHAIN_ID,
        nonce,
        note || null,
      ]
    );

    let txHash: string | null = null;
    let broadcastAttempted = false;
    try {
      // Persist the deterministic signed hash before making the RPC request.
      // A timeout after this point must be treated as an unknown broadcast,
      // never as permission to submit another transaction.
      const populated = await wallet.populateTransaction({
        ...transactionRequest,
        gasLimit,
        gasPrice,
      });
      const signedTransaction = await wallet.signTransaction(populated);
      txHash = keccak256(signedTransaction);

      await client.query("BEGIN");
      try {
        await client.query(
          `UPDATE public.admin_bnb_transfers
           SET status = 'BROADCAST',
               tx_hash = $2,
               signed_transaction = $3,
               updated_at = NOW()
           WHERE id = $1`,
          [transferId, txHash, signedTransaction]
        );
        if (!(await markTransferBroadcast(client, lockToken, txHash))) {
          throw new Error("Unable to persist the BNB transfer broadcast lock.");
        }
        await client.query("COMMIT");
      } catch (lockPersistenceError) {
        await client.query("ROLLBACK");
        throw lockPersistenceError;
      }

      broadcastAttempted = true;
      const transaction = await provider.broadcastTransaction(signedTransaction);
      let receipt;
      try {
        receipt = await transaction.wait(1);
      } catch (confirmationError) {
        const broadcast = await client.query(
          `UPDATE public.admin_bnb_transfers
           SET status = 'BROADCAST',
               failure_reason = $2,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, recipient_address, source_address, status,
                     tx_hash, failure_reason, confirmed_at, created_at`,
          [transferId, `Confirmation pending: ${sanitizeError(confirmationError)}`]
        );
        return NextResponse.json(
          {
            ...transferResponse(broadcast.rows[0]),
            message: "Transaction broadcast successfully but is awaiting confirmation. Check BscScan before retrying.",
          },
          { status: 202 }
        );
      }

      if (!receipt) {
        const broadcast = await client.query(
          `UPDATE public.admin_bnb_transfers
           SET status = 'BROADCAST',
               failure_reason = $2,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, recipient_address, source_address, status,
                     tx_hash, failure_reason, confirmed_at, created_at`,
          [transferId, "Confirmation pending after BSC broadcast."]
        );
        return NextResponse.json(
          {
            ...transferResponse(broadcast.rows[0]),
            message: "Transaction broadcast successfully but is awaiting confirmation. Check BscScan before retrying.",
          },
          { status: 202 }
        );
      }

      if (receipt.status !== 1) {
        const failed = await client.query(
          `UPDATE public.admin_bnb_transfers
           SET status = 'FAILED',
               failure_reason = $2,
               signed_transaction = NULL,
               confirmed_at = NOW(),
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, recipient_address, source_address, status,
                     tx_hash, failure_reason, confirmed_at, created_at`,
          [transferId, "The BSC transaction was mined but reverted."]
        );
        if (lockToken) {
          try {
            await releaseTransferLock(client, lockToken);
            lockToken = null;
          } catch (releaseError) {
            console.error("bnb-transfer final lock release error:", sanitizeError(releaseError));
          }
        }
        return NextResponse.json(
          {
            ...transferResponse(failed.rows[0]),
            success: false,
            error: "The BSC transaction was mined but reverted.",
          },
          { status: 502 }
        );
      }

      const confirmed = await client.query(
        `UPDATE public.admin_bnb_transfers
         SET status = 'CONFIRMED',
             failure_reason = NULL,
             signed_transaction = NULL,
             confirmed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, amount, recipient_address, source_address, status,
                   tx_hash, failure_reason, confirmed_at, created_at`,
        [transferId]
      );
      try {
        if (lockToken) {
          await releaseTransferLock(client, lockToken);
          lockToken = null;
        }
      } catch (releaseError) {
        console.error("bnb-transfer final lock release error:", sanitizeError(releaseError));
      }
      return NextResponse.json(transferResponse(confirmed.rows[0]));
    } catch (broadcastError) {
      const reason = sanitizeError(broadcastError);
      if (!broadcastAttempted) {
        const failed = await client.query(
          `UPDATE public.admin_bnb_transfers
           SET status = 'FAILED', failure_reason = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, recipient_address, source_address, status,
                     tx_hash, failure_reason, confirmed_at, created_at`,
          [transferId, `Pre-broadcast failure: ${reason}`]
        );
        if (lockToken) {
          await releaseTransferLock(client, lockToken);
          lockToken = null;
        }
        return NextResponse.json(
          {
            ...transferResponse(failed.rows[0]),
            success: false,
            error: `Blockchain transaction was not broadcast: ${reason}`,
          },
          { status: 502 }
        );
      }

      const uncertain = await client.query(
        `UPDATE public.admin_bnb_transfers
         SET status = 'BROADCAST',
             failure_reason = $2,
             updated_at = NOW()
         WHERE id = $1 AND status = 'BROADCAST'
         RETURNING id, amount, recipient_address, source_address, status,
                   tx_hash, failure_reason, confirmed_at, created_at`,
        [transferId, `Broadcast outcome unknown: ${reason}`]
      );
      return NextResponse.json(
        {
          ...transferResponse(uncertain.rows[0]),
          message: "The signed BNB transaction may be on the network. Check BscScan before taking further action.",
        },
        { status: 202 }
      );
    }
  } catch (error: unknown) {
    const message = sanitizeError(error);
    if (lockToken) {
      try {
        await failLockedTransfer(client, lockToken, message);
      } catch (lockError) {
        console.error("bnb-transfer failure lock update error:", lockError);
      }
    }
    console.error("bnb-transfer route error:", message);
    return errorResponse(
      isMigrationError(error)
        ? "The BNB transfer audit migration must be applied before this feature can be used."
        : message,
      500
    );
  } finally {
    if (lockToken) {
      try {
        const lock = await getTransferLock(client);
        if (lock?.token === lockToken && lock.state === "LOCKED") {
          await releaseTransferLock(client, lockToken);
        }
      } catch (releaseError) {
        console.error("bnb-transfer lock release error:", releaseError);
      }
    }
    client.release();
  }
}
