import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";
import {
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  formatEther,
  getAddress,
  isAddress,
  keccak256,
  parseEther,
} from "ethers";
import { getVerifiedAdmin } from "@/lib/admin-auth";
import {
  failMasterHotWalletLock,
  getMasterHotWalletLock,
  markMasterHotWalletTransactionBroadcast,
  releaseMasterHotWalletLock,
  tryAcquireMasterHotWalletLock,
} from "@/lib/master-wallet-lock";
import { getBscChainId, getBscExplorerBaseUrl, getBscRpcUrl } from "@/lib/chain-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BSC_MAINNET_CHAIN_ID = 56;
const CONFIRMATION_PHRASE = "SEND BNB";

function getArmingIssues() {
  const issues: string[] = [];
  if (process.env.EXTERNAL_BNB_TRANSFERS_ENABLED !== "true") {
    issues.push("EXTERNAL_BNB_TRANSFERS_ENABLED=true is required.");
  }
  if (process.env.BSC_CHAIN_ID !== String(BSC_MAINNET_CHAIN_ID) || getBscChainId() !== BSC_MAINNET_CHAIN_ID) {
    issues.push("BSC_CHAIN_ID=56 mainnet configuration is required.");
  }
  if (!process.env.BSC_RPC_URL) {
    issues.push("A server-side BSC_RPC_URL is required.");
  }
  return issues;
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function sanitizeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown BNB transfer error";
}

function isValidAmount(value: string) {
  return /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value);
}

function isValidIdempotencyKey(value: string) {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

function transferResponse(row: Record<string, unknown>, idempotent = false) {
  const txHash = typeof row.tx_hash === "string" ? row.tx_hash : null;
  return {
    success: true,
    idempotent,
    transfer: {
      id: row.id,
      amount: Number(row.amount),
      asset: row.asset,
      toAddress: row.cold_vault_address,
      sourceAddress: row.source_address,
      status: row.status,
      txHash,
      explorerUrl: txHash ? `${getBscExplorerBaseUrl()}/tx/${txHash}` : null,
      confirmedAt: row.confirmed_at,
      failureReason: row.failure_reason,
    },
  };
}

function existingTransferResponse(row: Record<string, unknown>) {
  if (row.status === "PROCESSING" || row.status === "FAILED") {
    return NextResponse.json(
      {
        ...transferResponse(row, true),
        success: false,
        error: row.status === "PROCESSING"
          ? "The earlier BNB transfer attempt is still processing. Do not submit another request."
          : "The earlier BNB transfer attempt failed. Submit a new request after reviewing the failure.",
      },
      { status: 409 }
    );
  }
  return NextResponse.json(transferResponse(row, true));
}

async function reconcileMasterWalletLock(client: PoolClient, provider: JsonRpcProvider) {
  const lock = await getMasterHotWalletLock(client);
  if (!lock || lock.state !== "BROADCAST" || !lock.txHash) {
    return lock;
  }

  const receipt = await provider.getTransactionReceipt(lock.txHash);
  if (!receipt) {
    return lock;
  }

  if (lock.operation === "external-transfer") {
    await client.query(
      `UPDATE public.vault_transfers
       SET status = $2,
           confirmed_at = NOW(),
           failure_reason = $3,
           updated_at = NOW()
       WHERE tx_hash = $1 AND status = 'BROADCAST'`,
      [
        lock.txHash,
        receipt.status === 1 ? "CONFIRMED" : "FAILED",
        receipt.status === 1 ? null : "The BSC transaction was mined but reverted.",
      ]
    );
  } else if (lock.operation === "withdrawal") {
    await client.query(
      `UPDATE public.ledger_entries
       SET status = $2
       WHERE tx_hash = $1
         AND tx_type = 'WITHDRAW'
         AND status = 'PROCESSING'`,
      [lock.txHash, receipt.status === 1 ? "COMPLETED" : "FAILED"]
    );
  } else if (lock.operation !== "sweep") {
    return lock;
  }

  await releaseMasterHotWalletLock(client, lock.token);
  return null;
}

export async function GET() {
  const admin = await getVerifiedAdmin("WALLET_TRANSFER_ADMIN_EMAILS");
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  let sourceAddress: string | null = null;
  try {
    if (process.env.MASTER_HOT_WALLET_PRIVATE_KEY) {
      sourceAddress = new Wallet(process.env.MASTER_HOT_WALLET_PRIVATE_KEY).address;
    }
  } catch {
    // The key never leaves the server.
  }

  const armingIssues = getArmingIssues();
  if (!sourceAddress) {
    armingIssues.push("A valid MASTER_HOT_WALLET_PRIVATE_KEY server setting is required.");
  }

  return NextResponse.json({
    success: true,
    enabled: armingIssues.length === 0,
    sourceAddress,
    confirmationPhrase: CONFIRMATION_PHRASE,
    chainId: getBscChainId(),
    network: "BSC",
    armingIssues,
  });
}

export async function POST(request: Request) {
  const admin = await getVerifiedAdmin("WALLET_TRANSFER_ADMIN_EMAILS");
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }

  const armingIssues = getArmingIssues();
  if (armingIssues.length > 0) {
    return errorResponse(armingIssues.join(" "), 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON request body");
  }

  const rawAddress = typeof body.toAddress === "string" ? body.toAddress.trim() : "";
  const amountText = typeof body.amount === "string" ? body.amount.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

  if (!isAddress(rawAddress)) {
    return errorResponse("A valid BSC (0x...) recipient address is required.");
  }
  if (!isValidAmount(amountText)) {
    return errorResponse("Enter a positive BNB amount with up to 18 decimal places.");
  }
  if (note.length > 500) {
    return errorResponse("Transfer note must be 500 characters or fewer.");
  }
  if (!isValidIdempotencyKey(idempotencyKey)) {
    return errorResponse("A valid idempotency key is required.");
  }
  if (confirmation !== CONFIRMATION_PHRASE) {
    return errorResponse(`Type ${CONFIRMATION_PHRASE} to confirm this irreversible transfer.`);
  }

  let amount: bigint;
  try {
    amount = parseEther(amountText);
  } catch {
    return errorResponse("Invalid BNB amount.");
  }
  if (amount <= BigInt(0)) {
    return errorResponse("Transfer amount must be greater than zero.");
  }

  const privateKey = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    return errorResponse("MASTER_HOT_WALLET_PRIVATE_KEY is not configured on the server.", 503);
  }

  let unsignedWallet: Wallet;
  try {
    unsignedWallet = new Wallet(privateKey);
  } catch {
    return errorResponse("MASTER_HOT_WALLET_PRIVATE_KEY is invalid.", 503);
  }

  const destination = getAddress(rawAddress);
  const sourceAddress = unsignedWallet.address;
  if (destination === ZeroAddress || destination.toLowerCase() === sourceAddress.toLowerCase()) {
    return errorResponse("The recipient must be a different non-zero wallet address.");
  }

  const provider = new JsonRpcProvider(getBscRpcUrl());
  const wallet = unsignedWallet.connect(provider);
  const client = await pool.connect();
  let masterWalletLockToken: string | null = null;
  let transferId: number | null = null;

  try {
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(BSC_MAINNET_CHAIN_ID)) {
      return errorResponse("Configured RPC is not connected to BSC mainnet.", 503);
    }

    // Reuse the external-transfer operation label so the existing USDT,
    // withdrawal, and sweep routes can reconcile a confirmed BNB transfer.
    masterWalletLockToken = await tryAcquireMasterHotWalletLock(client, "external-transfer");
    if (!masterWalletLockToken) {
      try {
        const unresolvedLock = await reconcileMasterWalletLock(client, provider);
        if (!unresolvedLock) {
          masterWalletLockToken = await tryAcquireMasterHotWalletLock(client, "external-transfer");
        }
      } catch (reconciliationError) {
        console.error("wallet/bnb-transfers lock reconciliation error:", sanitizeError(reconciliationError));
      }
    }
    if (!masterWalletLockToken) {
      return errorResponse(
        "Another master wallet transaction is still in progress. Wait for it to settle before retrying.",
        409
      );
    }

    const existing = await client.query(
      `SELECT id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason
       FROM public.vault_transfers
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (existing.rows[0]) {
      return existingTransferResponse(existing.rows[0]);
    }

    await client.query(
      `UPDATE public.vault_transfers
       SET status = 'FAILED',
           failure_reason = 'Recovered interrupted request before transaction broadcast.',
           updated_at = NOW()
       WHERE source_address = $1
         AND asset = 'BNB'
         AND status = 'PROCESSING'
         AND tx_hash IS NULL`,
      [sourceAddress]
    );

    const [nonce, bnbBalance] = await Promise.all([
      provider.getTransactionCount(sourceAddress, "pending"),
      provider.getBalance(sourceAddress),
    ]);
    if (amount >= bnbBalance) {
      return errorResponse(
        `Insufficient BNB. Available: ${formatEther(bnbBalance)} BNB; reserve BNB for the network fee.`
      );
    }

    const transferRequest = {
      to: destination,
      value: amount,
      nonce,
    };
    const estimatedGas = await provider.estimateGas({ ...transferRequest, from: sourceAddress });
    const gasLimit = (estimatedGas * BigInt(12)) / BigInt(10) + BigInt(1000);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    if (!gasPrice) {
      return errorResponse("Unable to determine the current BNB gas price. Try again shortly.", 503);
    }
    const estimatedGasCost = gasLimit * gasPrice;
    if (amount + estimatedGasCost > bnbBalance) {
      return errorResponse(
        `Insufficient BNB. Available: ${formatEther(bnbBalance)} BNB; estimated gas: ${formatEther(estimatedGasCost)} BNB.`
      );
    }

    const inserted = await client.query(
      `INSERT INTO public.vault_transfers (
         from_label, to_label, amount, asset, cold_vault_address, note,
         status, tx_hash, requested_by, idempotency_key, network,
         transfer_kind, source_address, transaction_nonce
       )
       VALUES ($1, $2, $3, 'BNB', $4, $5, 'PROCESSING', NULL, $6, $7, 'BSC', 'EXTERNAL', $8, $9)
       RETURNING id`,
      [
        `Master hot wallet (${sourceAddress.slice(0, 8)}...)`,
        "External BSC wallet",
        amountText,
        destination,
        note || "Admin external BNB transfer",
        admin.email,
        idempotencyKey,
        sourceAddress,
        nonce,
      ]
    );
    transferId = Number(inserted.rows[0].id);

    let txHash: string | null = null;
    let broadcastAttempted = false;
    try {
      const populated = await wallet.populateTransaction({
        ...transferRequest,
        nonce,
        gasLimit,
        gasPrice,
      });
      const signedTransaction = await wallet.signTransaction(populated);
      txHash = keccak256(signedTransaction);
      await client.query(
        `UPDATE public.vault_transfers
         SET status = 'BROADCAST', tx_hash = $2, transaction_nonce = $3, updated_at = NOW()
         WHERE id = $1`,
        [transferId, txHash, nonce]
      );
      const broadcastLockRecorded = await markMasterHotWalletTransactionBroadcast(
        client,
        masterWalletLockToken,
        txHash
      );
      if (!broadcastLockRecorded) {
        throw new Error("Unable to persist the master wallet broadcast lock.");
      }

      broadcastAttempted = true;
      const tx = await provider.broadcastTransaction(signedTransaction);
      try {
        const receipt = await tx.wait(1);
        if (!receipt) {
          throw new Error("The BSC transaction confirmation is still pending.");
        }
        if (receipt.status !== 1) {
          const failed = await client.query(
            `UPDATE public.vault_transfers
             SET status = 'FAILED', failure_reason = $2, confirmed_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
            [transferId, "The BSC transaction was mined but reverted."]
          );
          await releaseMasterHotWalletLock(client, masterWalletLockToken);
          masterWalletLockToken = null;
          return NextResponse.json({
            ...transferResponse(failed.rows[0]),
            success: false,
            error: "The BSC transaction was mined but reverted.",
          }, { status: 502 });
        }

        const confirmed = await client.query(
          `UPDATE public.vault_transfers
           SET status = 'CONFIRMED', confirmed_at = NOW(), failure_reason = NULL, updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
          [transferId]
        );
        await releaseMasterHotWalletLock(client, masterWalletLockToken);
        masterWalletLockToken = null;
        return NextResponse.json(transferResponse(confirmed.rows[0]));
      } catch (confirmationError) {
        const broadcast = await client.query(
          `UPDATE public.vault_transfers
           SET status = 'BROADCAST', failure_reason = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
          [transferId, `Confirmation pending: ${sanitizeError(confirmationError)}`]
        );
        return NextResponse.json({
          ...transferResponse(broadcast.rows[0]),
          message: "Transaction was broadcast but is still awaiting confirmation. Check the BSCScan link before retrying.",
        }, { status: 202 });
      }
    } catch (broadcastError) {
      const reason = sanitizeError(broadcastError);
      if (!broadcastAttempted) {
        const failed = await client.query(
          `UPDATE public.vault_transfers
           SET status = 'FAILED', failure_reason = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
          [transferId, `Pre-broadcast failure: ${reason}`]
        );
        await releaseMasterHotWalletLock(client, masterWalletLockToken);
        masterWalletLockToken = null;
        return NextResponse.json(
          { ...transferResponse(failed.rows[0]), success: false, error: `Blockchain transaction was not broadcast: ${reason}` },
          { status: 502 }
        );
      }
      if (txHash) {
        const uncertain = await client.query(
          `UPDATE public.vault_transfers
           SET status = 'BROADCAST', failure_reason = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
          [transferId, `Broadcast outcome unknown: ${reason}`]
        );
        return NextResponse.json({
          ...transferResponse(uncertain.rows[0]),
          message: "The signed transaction may be on the network. Check the BSCScan link before taking any further action.",
        }, { status: 202 });
      }
      throw broadcastError;
    }
  } catch (error: any) {
    if (error?.code === "23505") {
      const existing = await client.query(
        `SELECT id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason
         FROM public.vault_transfers
         WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows[0]) {
        return existingTransferResponse(existing.rows[0]);
      }
    }

    const message = sanitizeError(error);
    if (masterWalletLockToken) {
      try {
        await failMasterHotWalletLock(client, masterWalletLockToken, message);
      } catch (lockError) {
        console.error("wallet/bnb-transfers lock failure marker error:", lockError);
      }
    }
    console.error("wallet/bnb-transfers route error:", message);
    return errorResponse(
      error?.code === "42703" || error?.code === "42P01"
        ? "Wallet transfer database migration is required before this feature can be used."
        : message,
      500
    );
  } finally {
    if (masterWalletLockToken) {
      try {
        const currentLock = await getMasterHotWalletLock(client);
        if (currentLock?.token === masterWalletLockToken && currentLock.state === "LOCKED") {
          await releaseMasterHotWalletLock(client, masterWalletLockToken);
        }
      } catch (unlockError) {
        console.error("wallet/bnb-transfers lock release error:", unlockError);
      }
    }
    client.release();
  }
}
