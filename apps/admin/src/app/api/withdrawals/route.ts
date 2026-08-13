import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";
import { ethers } from "ethers";
import { getBscRpcUrl, getBscUsdtContract } from "@/lib/chain-config";
import { getVerifiedAdmin } from "@/lib/admin-auth";
import {
  failMasterHotWalletLock,
  getMasterHotWalletLock,
  markMasterHotWalletTransactionBroadcast,
  releaseMasterHotWalletLock,
  tryAcquireMasterHotWalletLock,
} from "@/lib/master-wallet-lock";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function parseAddress(details: unknown) {
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      return typeof parsed?.address === "string" ? parsed.address : "";
    } catch {
      return "";
    }
  }
  return details && typeof details === "object" && typeof (details as { address?: unknown }).address === "string"
    ? (details as { address: string }).address
    : "";
}

async function reconcileMasterWalletLock(client: PoolClient, provider: ethers.JsonRpcProvider) {
  const lock = await getMasterHotWalletLock(client);
  if (!lock || lock.state !== "BROADCAST" || !lock.txHash) {
    return lock;
  }

  const receipt = await provider.getTransactionReceipt(lock.txHash);
  if (!receipt) {
    return lock;
  }

  const status = receipt.status === 1 ? "COMPLETED" : "FAILED";
  if (lock.operation === "withdrawal") {
    await client.query(
      `UPDATE public.ledger_entries
       SET status = $2
       WHERE tx_hash = $1
         AND tx_type = 'WITHDRAW'
         AND status = 'PROCESSING'`,
      [lock.txHash, status]
    );
  } else if (lock.operation === "external-transfer") {
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
  } else if (lock.operation !== "sweep") {
    return lock;
  } else {
    // A sweep lock tracks a confirmed BNB gas-funding transaction.
  }

  await releaseMasterHotWalletLock(client, lock.token);
  return null;
}

async function acquireMasterWalletLock(client: PoolClient, provider: ethers.JsonRpcProvider) {
  const token = await tryAcquireMasterHotWalletLock(client, "withdrawal");
  if (token) {
    return token;
  }

  const unresolvedLock = await reconcileMasterWalletLock(client, provider);
  return unresolvedLock ? null : tryAcquireMasterHotWalletLock(client, "withdrawal");
}

// Fetch pending withdrawals for administrative audit.
export async function GET() {
  try {
    const admin = await getVerifiedAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const result = await pool.query(`
      SELECT
        l.id,
        l.user_id,
        l.asset_id,
        l.amount,
        l.status,
        l.tx_hash,
        l.created_at,
        l.details,
        u.email,
        u.nickname
      FROM public.ledger_entries l
      JOIN public.users u ON l.user_id = u.id
      WHERE l.tx_type = 'WITHDRAW' AND l.status IN ('PENDING', 'PROCESSING')
      ORDER BY l.created_at DESC
    `);

    return NextResponse.json({
      success: true,
      withdrawals: result.rows.map((withdrawal: Record<string, unknown>) => ({
        id: withdrawal.id,
        userId: withdrawal.user_id,
        email: withdrawal.email || "unknown@user.com",
        nickname: withdrawal.nickname || "-",
        amount: Math.abs(Number(withdrawal.amount)),
        fee: Math.abs(Number(withdrawal.amount)) * 0.03,
        asset: "USDT",
        txHash: withdrawal.tx_hash || "-",
        address: parseAddress(withdrawal.details),
        status: withdrawal.status,
        time: new Date(String(withdrawal.created_at)).toLocaleTimeString(),
      })),
    });
  } catch (error: unknown) {
    console.error("GET api/withdrawals error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  let masterWalletLockToken: string | null = null;
  let claimedWithdrawalId: string | null = null;
  let broadcastAttempted = false;
  let rejectionTransactionStarted = false;

  try {
    const admin = await getVerifiedAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { withdrawalId, action, reason } = await request.json();
    if (typeof withdrawalId !== "string" || (action !== "APPROVE" && action !== "REJECT")) {
      return NextResponse.json(
        { success: false, error: "withdrawalId and action ('APPROVE' | 'REJECT') are required" },
        { status: 400 }
      );
    }

    if (action === "REJECT") {
      await client.query("BEGIN");
      rejectionTransactionStarted = true;
      const entryResult = await client.query(
        "SELECT * FROM public.ledger_entries WHERE id = $1 FOR UPDATE",
        [withdrawalId]
      );
      const entry = entryResult.rows[0];
      if (!entry) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "Withdrawal ledger entry not found" }, { status: 404 });
      }
      if (entry.status !== "PENDING") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, error: `Withdrawal is already in ${entry.status} status` },
          { status: 409 }
        );
      }

      const amountToRefund = Math.abs(Number(entry.amount));
      await client.query("UPDATE public.ledger_entries SET status = 'FAILED' WHERE id = $1", [withdrawalId]);
      await client.query(
        `INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
         VALUES ($1, $2, $3, 'REFUND', 'COMPLETED', $4, $5)`,
        [
          entry.user_id,
          entry.asset_id,
          amountToRefund,
          `Refund-${withdrawalId.slice(0, 8)}`,
          JSON.stringify({ description: reason || "Withdrawal rejected by Admin" }),
        ]
      );
      await client.query(
        `INSERT INTO public.user_balances (user_id, asset_id, available_balance)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, asset_id)
         DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance`,
        [entry.user_id, entry.asset_id, amountToRefund]
      );
      await client.query("COMMIT");
      rejectionTransactionStarted = false;
      return NextResponse.json({ success: true, message: "Withdrawal rejected. Locked funds refunded to user." });
    }

    const privateKey = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { success: false, error: "MASTER_HOT_WALLET_PRIVATE_KEY server environment variable is missing." },
        { status: 503 }
      );
    }

    const provider = new ethers.JsonRpcProvider(getBscRpcUrl());
    const wallet = new ethers.Wallet(privateKey, provider);
    masterWalletLockToken = await acquireMasterWalletLock(client, provider);
    if (!masterWalletLockToken) {
      return NextResponse.json(
        { success: false, error: "Another master wallet transaction is still in progress. Retry after it settles." },
        { status: 409 }
      );
    }

    // Atomically remove the row from the approval queue before any signing.
    const claimed = await client.query(
      `UPDATE public.ledger_entries
       SET status = 'PROCESSING'
       WHERE id = $1 AND tx_type = 'WITHDRAW' AND status = 'PENDING'
       RETURNING id, amount, details`,
      [withdrawalId]
    );
    const entry = claimed.rows[0];
    if (!entry) {
      await releaseMasterHotWalletLock(client, masterWalletLockToken);
      masterWalletLockToken = null;
      return NextResponse.json(
        { success: false, error: "Withdrawal is no longer pending approval." },
        { status: 409 }
      );
    }
    claimedWithdrawalId = String(entry.id);

    const address = parseAddress(entry.details);
    if (!ethers.isAddress(address)) {
      throw new Error("Withdrawal address is invalid.");
    }

    const grossAmount = String(entry.amount).trim().replace(/^-/, "");
    const grossAmountUnits = ethers.parseUnits(grossAmount, 18);
    const parsedAmount = (grossAmountUnits * BigInt(97)) / BigInt(100);
    if (parsedAmount <= BigInt(0)) {
      throw new Error("Withdrawal amount is too small after the fee.");
    }
    const usdtContract = new ethers.Contract(
      getBscUsdtContract(),
      ["function transfer(address to, uint256 amount) returns (bool)"],
      wallet
    );

    const transferRequest = await usdtContract.transfer.populateTransaction(
      ethers.getAddress(address),
      parsedAmount
    );
    const nonce = await provider.getTransactionCount(wallet.address, "pending");
    const populatedTransaction = await wallet.populateTransaction({ ...transferRequest, nonce });
    const signedTransaction = await wallet.signTransaction(populatedTransaction);
    const txHash = ethers.keccak256(signedTransaction);

    await client.query(
      `UPDATE public.ledger_entries
       SET tx_hash = $2
       WHERE id = $1 AND status = 'PROCESSING'`,
      [withdrawalId, txHash]
    );
    const recorded = await markMasterHotWalletTransactionBroadcast(client, masterWalletLockToken, txHash);
    if (!recorded) {
      throw new Error("Unable to persist the master wallet broadcast lock.");
    }

    broadcastAttempted = true;
    const transaction = await provider.broadcastTransaction(signedTransaction);

    try {
      const receipt = await transaction.wait(1);
      if (!receipt) {
        throw new Error("Withdrawal transaction confirmation is still pending.");
      }
      if (receipt.status !== 1) {
        await client.query(
          "UPDATE public.ledger_entries SET status = 'FAILED' WHERE id = $1 AND status = 'PROCESSING'",
          [withdrawalId]
        );
        await releaseMasterHotWalletLock(client, masterWalletLockToken);
        masterWalletLockToken = null;
        return NextResponse.json(
          { success: false, error: "Withdrawal transaction was mined but reverted.", txHash },
          { status: 502 }
        );
      }

      await client.query(
        "UPDATE public.ledger_entries SET status = 'COMPLETED' WHERE id = $1 AND status = 'PROCESSING'",
        [withdrawalId]
      );
      await releaseMasterHotWalletLock(client, masterWalletLockToken);
      masterWalletLockToken = null;
      return NextResponse.json({ success: true, message: "Withdrawal approved and confirmed.", txHash });
    } catch (confirmationError) {
      return NextResponse.json(
        {
          success: false,
          pending: true,
          txHash,
          error: `Transaction may be pending: ${confirmationError instanceof Error ? confirmationError.message : "unknown error"}`,
        },
        { status: 202 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (rejectionTransactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("withdrawals rejection rollback error:", rollbackError);
      }
    }
    if (claimedWithdrawalId && !broadcastAttempted) {
      try {
        await client.query(
          `UPDATE public.ledger_entries
           SET status = 'PENDING', tx_hash = NULL
           WHERE id = $1 AND status = 'PROCESSING'`,
          [claimedWithdrawalId]
        );
      } catch (recoveryError) {
        console.error("withdrawals pre-broadcast recovery error:", recoveryError);
      }
    }
    if (masterWalletLockToken && !broadcastAttempted) {
      try {
        await failMasterHotWalletLock(client, masterWalletLockToken, message);
      } catch (lockError) {
        console.error("withdrawals lock failure marker error:", lockError);
      }
    }
    console.error("POST api/withdrawals error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (masterWalletLockToken) {
      try {
        const currentLock = await getMasterHotWalletLock(client);
        if (currentLock?.token === masterWalletLockToken && currentLock.state === "LOCKED") {
          await releaseMasterHotWalletLock(client, masterWalletLockToken);
        }
      } catch (lockError) {
        console.error("withdrawals lock release error:", lockError);
      }
    }
    client.release();
  }
}
