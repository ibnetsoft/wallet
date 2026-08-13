import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
} from "ethers";
import { getVerifiedAdmin } from "@/lib/admin-auth";
import {
  failMasterHotWalletLock,
  getMasterHotWalletLock,
  markMasterHotWalletTransactionBroadcast,
  releaseMasterHotWalletLock,
  tryAcquireMasterHotWalletLock,
} from "@/lib/master-wallet-lock";
import {
  DEFAULT_BSC_MAINNET_USDT_CONTRACT,
  getBscChainId,
  getBscExplorerBaseUrl,
  getBscRpcUrl,
  getBscUsdtContract,
} from "@/lib/chain-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const USDT_DECIMALS = 18;
const CONFIRMATION_PHRASE = "SEND USDT";
const BSC_MAINNET_CHAIN_ID = 56;
const BSC_MAINNET_USDT_CONTRACT = getAddress(DEFAULT_BSC_MAINNET_USDT_CONTRACT);
const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

function getConfiguredUsdtAddress() {
  const configured = getBscUsdtContract();
  return isAddress(configured) ? getAddress(configured) : null;
}

function getArmingIssues() {
  const issues: string[] = [];
  if (process.env.EXTERNAL_USDT_TRANSFERS_ENABLED !== "true") {
    issues.push("EXTERNAL_USDT_TRANSFERS_ENABLED=true 설정이 필요합니다.");
  }
  if (process.env.BSC_CHAIN_ID !== String(BSC_MAINNET_CHAIN_ID) || getBscChainId() !== BSC_MAINNET_CHAIN_ID) {
    issues.push("BSC_CHAIN_ID=56 메인넷 설정이 필요합니다.");
  }
  if (!process.env.BSC_RPC_URL) {
    issues.push("서버 BSC_RPC_URL 설정이 필요합니다.");
  }
  if (getConfiguredUsdtAddress() !== BSC_MAINNET_USDT_CONTRACT) {
    issues.push(`USDT_CONTRACT_ADDRESS는 ${BSC_MAINNET_USDT_CONTRACT} 이어야 합니다.`);
  }
  return issues;
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return "Unknown wallet transfer error";
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
  if (row.status === "PROCESSING") {
    return NextResponse.json(
      {
        ...transferResponse(row, true),
        success: false,
        error: "The earlier transfer attempt is still processing. Do not submit another request until it has been reviewed.",
      },
      { status: 409 }
    );
  }
  if (row.status === "FAILED") {
    return NextResponse.json(
      {
        ...transferResponse(row, true),
        success: false,
        error: "The earlier transfer attempt failed. Submit a new transfer request after reviewing the failure.",
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
  } else {
    // A sweep lock tracks the master wallet's BNB gas-funding transaction.
    // The receipt itself is enough to release the shared nonce guard.
  }
  await releaseMasterHotWalletLock(client, lock.token);
  return null;
}

// Exposes only non-sensitive configuration so the UI can clearly show whether
// the deployment is armed for real transfers.
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
    // Keep the key invalid/missing details on the server; POST returns a safe error.
  }

  const armingIssues = getArmingIssues();
  if (!sourceAddress) {
    armingIssues.push("유효한 MASTER_HOT_WALLET_PRIVATE_KEY 서버 설정이 필요합니다.");
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
    return errorResponse("Enter a positive USDT amount with up to 18 decimal places.");
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
    amount = parseUnits(amountText, USDT_DECIMALS);
  } catch {
    return errorResponse("Invalid USDT amount.");
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

  const configuredUsdtAddress = getConfiguredUsdtAddress();
  if (configuredUsdtAddress !== BSC_MAINNET_USDT_CONTRACT) {
    return errorResponse("The configured USDT contract is not the supported BSC mainnet USDT contract.", 503);
  }

  const provider = new JsonRpcProvider(getBscRpcUrl());
  const wallet = unsignedWallet.connect(provider);
  const contract = new Contract(configuredUsdtAddress, ERC20_ABI, wallet);
  const client = await pool.connect();
  let masterWalletLockToken: string | null = null;
  let transferId: number | null = null;

  try {
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(getBscChainId())) {
      return errorResponse("Configured RPC is not connected to the expected BSC network.", 503);
    }

    // Serialize every master-wallet spend, including withdrawals and sweeps,
    // so independent routes cannot allocate competing nonces.
    masterWalletLockToken = await tryAcquireMasterHotWalletLock(client, "external-transfer");
    if (!masterWalletLockToken) {
      try {
        const unresolvedLock = await reconcileMasterWalletLock(client, provider);
        if (!unresolvedLock) {
          masterWalletLockToken = await tryAcquireMasterHotWalletLock(client, "external-transfer");
        }
      } catch (reconciliationError) {
        console.error("wallet/transfers lock reconciliation error:", sanitizeError(reconciliationError));
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

    // If an earlier request stopped before signing, it could not have reached
    // the chain. The lock ownership proves it is no longer active, so mark it
    // failed before allowing a fresh request with a new idempotency key.
    await client.query(
      `UPDATE public.vault_transfers
       SET status = 'FAILED',
           failure_reason = 'Recovered interrupted request before transaction broadcast.',
           updated_at = NOW()
       WHERE source_address = $1
         AND status = 'PROCESSING'
         AND tx_hash IS NULL`,
      [sourceAddress]
    );

    const [usdtBalance, bnbBalance, nonce] = await Promise.all([
      contract.balanceOf(sourceAddress) as Promise<bigint>,
      provider.getBalance(sourceAddress),
      provider.getTransactionCount(sourceAddress, "pending"),
    ]);
    if (amount > usdtBalance) {
      return errorResponse(
        `Insufficient USDT balance. Available: ${formatUnits(usdtBalance, USDT_DECIMALS)} USDT.`
      );
    }

    const transferRequest = await contract.transfer.populateTransaction(destination, amount);
    const estimatedGas = await provider.estimateGas({ ...transferRequest, from: sourceAddress });
    const gasLimit =
      (estimatedGas * BigInt(12)) / BigInt(10) + BigInt(1000);
    const feeData = await provider.getFeeData();
    const feePerGas = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (!feePerGas) {
      return errorResponse("Unable to determine the current BNB gas price. Try again shortly.", 503);
    }
    const estimatedGasCost = gasLimit * feePerGas;
    if (bnbBalance < estimatedGasCost) {
      return errorResponse(
        `Insufficient BNB for gas. Estimated requirement: ${formatEther(estimatedGasCost)} BNB.`
      );
    }

    const inserted = await client.query(
      `INSERT INTO public.vault_transfers (
         from_label, to_label, amount, asset, cold_vault_address, note,
         status, tx_hash, requested_by, idempotency_key, network,
         transfer_kind, source_address, transaction_nonce
       )
       VALUES ($1, $2, $3, 'USDT', $4, $5, 'PROCESSING', NULL, $6, $7, 'BSC', 'EXTERNAL', $8, $9)
       RETURNING id`,
      [
        `Master hot wallet (${sourceAddress.slice(0, 8)}...)`,
        "External BSC wallet",
        amountText,
        destination,
        note || "Admin external USDT transfer",
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
      // Sign before broadcasting so an ambiguous RPC response can still be
      // reconciled by the deterministic transaction hash instead of retrying a
      // potentially already-broadcast transfer.
      const populated = await wallet.populateTransaction({
        ...transferRequest,
        nonce,
        gasLimit,
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
        const confirmationMessage = sanitizeError(confirmationError);
        const broadcast = await client.query(
          `UPDATE public.vault_transfers
           SET status = 'BROADCAST', failure_reason = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
          [transferId, `Confirmation pending: ${confirmationMessage}`]
        );
        return NextResponse.json(
          {
            ...transferResponse(broadcast.rows[0]),
            message: "Transaction was broadcast but is still awaiting confirmation. Check the BSCScan link before retrying.",
          },
          { status: 202 }
        );
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
        // The signed transaction hash was persisted before the RPC call. A
        // timeout or transport error here does not prove the network rejected
        // it, so keep it non-retryable until an operator checks BSCScan.
        const uncertain = await client.query(
          `UPDATE public.vault_transfers
           SET status = 'BROADCAST', failure_reason = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
          [transferId, `Broadcast outcome unknown: ${reason}`]
        );
        return NextResponse.json(
          {
            ...transferResponse(uncertain.rows[0]),
            message: "The signed transaction may be on the network. Check the BSCScan link before taking any further action.",
          },
          { status: 202 }
        );
      }

      const failed = await client.query(
        `UPDATE public.vault_transfers
         SET status = 'FAILED', failure_reason = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, amount, asset, cold_vault_address, source_address, status, tx_hash, confirmed_at, failure_reason`,
        [transferId, reason]
      );
      await releaseMasterHotWalletLock(client, masterWalletLockToken);
      masterWalletLockToken = null;
      return NextResponse.json(
        { ...transferResponse(failed.rows[0]), success: false, error: `Blockchain transaction failed: ${reason}` },
        { status: 502 }
      );
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
        console.error("wallet/transfers lock failure marker error:", lockError);
      }
    }
    console.error("wallet/transfers route error:", message);
    return errorResponse(
      error?.code === "42703"
      || error?.code === "42P01"
        ? "Wallet transfer database migration is required before this feature can be used."
        : message,
      500
    );
  } finally {
    if (masterWalletLockToken) {
      try {
        const currentLock = await getMasterHotWalletLock(client);
        // A hash-bearing lock represents a signed transaction whose network
        // outcome may still be unknown. Only a later receipt reconciliation
        // may release it; otherwise a retry could spend the next nonce.
        if (currentLock?.token === masterWalletLockToken && currentLock.state === "LOCKED") {
          await releaseMasterHotWalletLock(client, masterWalletLockToken);
        }
      } catch (unlockError) {
        console.error("wallet/transfers lock release error:", unlockError);
      }
    }
    client.release();
  }
}
