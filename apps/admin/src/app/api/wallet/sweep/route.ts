import { NextResponse } from "next/server";
import { Pool, type PoolClient } from "pg";
import {
  Contract,
  HDNodeWallet,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  getAddress,
  parseEther,
  parseUnits,
} from "ethers";
import { getBscRpcUrl } from "@/lib/chain-config";
import { resolveMasterHotWallet } from "@/lib/master-hot-wallet";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const provider = new JsonRpcProvider(getBscRpcUrl());
const GAS_FUND_AMOUNT = parseEther("0.0005");
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

interface SweepRow {
  balance_id: string;
  user_id: string;
  email: string | null;
  available_balance: string;
  address: string;
  derivation_index: number;
}

interface SweepPlanEntry {
  balanceId: string;
  userId: string;
  email: string;
  derivedAddress: string;
  storedAddress: string;
  derivationIndex: number;
  dbAmountText: string;
  onChainAmountText: string;
  sweepAmountText: string;
  dbAmountUnits: bigint;
  onChainAmountUnits: bigint;
  sweepAmountUnits: bigint;
  status: "ready" | "skip" | "success" | "failed";
  reason?: string;
  gasFundingTxHash?: string;
  transferTxHash?: string;
}

interface SweepSummary {
  dryRun: boolean;
  requestId: number | null;
  targetWallet: string;
  tokenDecimals: number;
  totalUsersScanned: number;
  actionableUsers: number;
  attemptedUsers: number;
  sweptUsers: number;
  skippedUsers: number;
  failedUsers: number;
  requiredGasBnb: string;
  feeWalletBalanceBnb: string;
  totalDbAmount: string;
  totalOnChainAmount: string;
  totalSweepAmount: string;
  issues: string[];
  users: Array<{
    userId: string;
    email: string;
    storedAddress: string;
    derivedAddress: string;
    dbAmount: string;
    onChainAmount: string;
    sweepAmount: string;
    status: SweepPlanEntry["status"];
    reason?: string;
    gasFundingTxHash?: string;
    transferTxHash?: string;
  }>;
}

function toDisplayAmount(value: bigint, decimals: number) {
  return formatUnits(value, decimals);
}

function summarizeUsers(entries: SweepPlanEntry[]) {
  return entries.map((entry) => ({
    userId: entry.userId,
    email: entry.email,
    storedAddress: entry.storedAddress,
    derivedAddress: entry.derivedAddress,
    dbAmount: entry.dbAmountText,
    onChainAmount: entry.onChainAmountText,
    sweepAmount: entry.sweepAmountText,
    status: entry.status,
    reason: entry.reason,
    gasFundingTxHash: entry.gasFundingTxHash,
    transferTxHash: entry.transferTxHash,
  }));
}

async function insertSweepRequest(
  client: PoolClient,
  params: {
    totalAmount: string;
    targetWallet: string;
    status: string;
    requestedBy: string;
    dryRun: boolean;
    actionableUsers: number;
    attemptedUsers: number;
    sweptUsers: number;
    skippedUsers: number;
    failedUsers: number;
    totalDbAmount: string;
    totalOnChainAmount: string;
    summary: SweepSummary;
  },
) {
  const result = await client.query<{ id: number }>(
    `INSERT INTO public.sweep_requests (
       total_amount,
       target_wallet,
       status,
       requested_by,
       dry_run,
       attempted_count,
       swept_count,
       skipped_count,
       failed_count,
       total_db_amount,
       total_onchain_amount,
       summary
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     RETURNING id`,
    [
      params.totalAmount,
      params.targetWallet,
      params.status,
      params.requestedBy,
      params.dryRun,
      params.attemptedUsers,
      params.sweptUsers,
      params.skippedUsers,
      params.failedUsers,
      params.totalDbAmount,
      params.totalOnChainAmount,
      JSON.stringify(params.summary),
    ],
  );
  return result.rows[0]?.id ?? null;
}

async function updateSweepRequest(
  client: PoolClient,
  requestId: number,
  params: {
    totalAmount: string;
    status: string;
    attemptedUsers: number;
    sweptUsers: number;
    skippedUsers: number;
    failedUsers: number;
    totalDbAmount: string;
    totalOnChainAmount: string;
    summary: SweepSummary;
  },
) {
  await client.query(
    `UPDATE public.sweep_requests
     SET total_amount = $2,
         status = $3,
         attempted_count = $4,
         swept_count = $5,
         skipped_count = $6,
         failed_count = $7,
         total_db_amount = $8,
         total_onchain_amount = $9,
         summary = $10::jsonb,
         updated_at = timezone('utc'::text, now())
     WHERE id = $1`,
    [
      requestId,
      params.totalAmount,
      params.status,
      params.attemptedUsers,
      params.sweptUsers,
      params.skippedUsers,
      params.failedUsers,
      params.totalDbAmount,
      params.totalOnChainAmount,
      JSON.stringify(params.summary),
    ],
  );
}

export async function POST(request: Request) {
  const client = await pool.connect();
  let requestId: number | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    const resolvedMasterWallet = await resolveMasterHotWallet(client);
    if (
      !resolvedMasterWallet.address
      || !resolvedMasterWallet.signer
      || resolvedMasterWallet.issues.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: resolvedMasterWallet.issues.join(" ") || "Master hot wallet is not configured.",
        },
        { status: 503 },
      );
    }

    const masterHotWallet = resolvedMasterWallet.address;
    const mnemonic = process.env.WALLET_MASTER_MNEMONIC?.trim();
    if (!mnemonic) {
      return NextResponse.json(
        { success: false, error: "WALLET_MASTER_MNEMONIC is not configured." },
        { status: 500 },
      );
    }

    const masterFeeWallet = resolvedMasterWallet.signer.connect(provider);
    const [assetRes, queryRes, feeWalletBalance] = await Promise.all([
      client.query<{ contract_address: string | null; decimals: number }>(
        "SELECT contract_address, decimals FROM public.assets WHERE id = 2",
      ),
      client.query<SweepRow>(
        `SELECT
           ub.id AS balance_id,
           ub.user_id,
           ub.available_balance,
           u.email,
           uw.address,
           uw.derivation_index
         FROM public.user_balances ub
         JOIN public.user_wallets uw ON ub.user_id = uw.user_id
         JOIN public.users u ON u.id = ub.user_id
         WHERE ub.asset_id = 2 AND ub.available_balance > 0
         ORDER BY ub.available_balance DESC, ub.user_id ASC`,
      ),
      provider.getBalance(masterHotWallet),
    ]);

    if (assetRes.rows.length === 0 || !assetRes.rows[0].contract_address) {
      return NextResponse.json(
        { success: false, error: "USDT contract address is not configured." },
        { status: 500 },
      );
    }

    const tokenDecimals = Number(assetRes.rows[0].decimals ?? 18);
    const usdtContractAddress = assetRes.rows[0].contract_address;
    const users = queryRes.rows;

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, error: "No user wallets with sweepable USDT were found in the database." },
        { status: 400 },
      );
    }

    const issues: string[] = [];
    const plans: SweepPlanEntry[] = [];
    let totalDbAmountUnits = BigInt(0);
    let totalOnChainAmountUnits = BigInt(0);
    let totalSweepAmountUnits = BigInt(0);

    for (const user of users) {
      const storedAddress = getAddress(user.address);
      const userNode = HDNodeWallet.fromPhrase(mnemonic, "", `m/44'/60'/0'/0/${user.derivation_index}`);
      const derivedAddress = userNode.address;
      const entry: SweepPlanEntry = {
        balanceId: user.balance_id,
        userId: user.user_id,
        email: user.email ?? user.user_id,
        derivedAddress,
        storedAddress,
        derivationIndex: user.derivation_index,
        dbAmountText: "0",
        onChainAmountText: "0",
        sweepAmountText: "0",
        dbAmountUnits: BigInt(0),
        onChainAmountUnits: BigInt(0),
        sweepAmountUnits: BigInt(0),
        status: "skip",
      };

      if (storedAddress.toLowerCase() !== derivedAddress.toLowerCase()) {
        entry.reason = "Stored wallet address does not match the derived address for the saved derivation index.";
        issues.push(`${entry.email}: ${entry.reason}`);
        plans.push(entry);
        continue;
      }

      const dbAmountUnits = parseUnits(String(user.available_balance), tokenDecimals);
      const userWallet = new Wallet(userNode.privateKey, provider);
      const usdtContract = new Contract(usdtContractAddress, ERC20_ABI, userWallet);
      const onChainAmountUnits = await usdtContract.balanceOf(userWallet.address);
      const sweepAmountUnits = dbAmountUnits < onChainAmountUnits ? dbAmountUnits : onChainAmountUnits;

      entry.dbAmountUnits = dbAmountUnits;
      entry.onChainAmountUnits = onChainAmountUnits;
      entry.sweepAmountUnits = sweepAmountUnits;
      entry.dbAmountText = toDisplayAmount(dbAmountUnits, tokenDecimals);
      entry.onChainAmountText = toDisplayAmount(onChainAmountUnits, tokenDecimals);
      entry.sweepAmountText = toDisplayAmount(sweepAmountUnits, tokenDecimals);

      totalDbAmountUnits += dbAmountUnits;
      totalOnChainAmountUnits += onChainAmountUnits;

      if (dbAmountUnits === BigInt(0)) {
        entry.reason = "Database balance is already zero.";
      } else if (onChainAmountUnits === BigInt(0)) {
        entry.reason = "On-chain USDT balance is zero.";
      } else if (sweepAmountUnits === BigInt(0)) {
        entry.reason = "No sweepable overlap between the database and on-chain balance.";
      } else {
        entry.status = "ready";
        if (onChainAmountUnits < dbAmountUnits) {
          entry.reason = "On-chain balance is lower than the database balance, so the sweep is capped to the on-chain amount.";
          issues.push(`${entry.email}: ${entry.reason}`);
        }
        if (onChainAmountUnits > dbAmountUnits) {
          entry.reason = "On-chain balance is higher than the database balance, so the sweep is capped to the database balance.";
          issues.push(`${entry.email}: ${entry.reason}`);
        }
        totalSweepAmountUnits += sweepAmountUnits;
      }

      plans.push(entry);
    }

    const actionablePlans = plans.filter((plan) => plan.status === "ready");
    const requiredGasAmount = GAS_FUND_AMOUNT * BigInt(actionablePlans.length);
    if (actionablePlans.length === 0) {
      const summary: SweepSummary = {
        dryRun,
        requestId: null,
        targetWallet: masterHotWallet,
        tokenDecimals,
        totalUsersScanned: plans.length,
        actionableUsers: 0,
        attemptedUsers: 0,
        sweptUsers: 0,
        skippedUsers: plans.length,
        failedUsers: 0,
        requiredGasBnb: formatUnits(requiredGasAmount, 18),
        feeWalletBalanceBnb: formatUnits(feeWalletBalance, 18),
        totalDbAmount: toDisplayAmount(totalDbAmountUnits, tokenDecimals),
        totalOnChainAmount: toDisplayAmount(totalOnChainAmountUnits, tokenDecimals),
        totalSweepAmount: "0",
        issues,
        users: summarizeUsers(plans),
      };

      return NextResponse.json(
        {
          success: false,
          error: "No sweepable wallets passed preflight checks.",
          dryRun,
          summary,
        },
        { status: 400 },
      );
    }

    if (feeWalletBalance < requiredGasAmount) {
      issues.push("Master hot wallet BNB balance is too low to fund every planned sweep wallet.");
      const summary: SweepSummary = {
        dryRun,
        requestId: null,
        targetWallet: masterHotWallet,
        tokenDecimals,
        totalUsersScanned: plans.length,
        actionableUsers: actionablePlans.length,
        attemptedUsers: 0,
        sweptUsers: 0,
        skippedUsers: plans.length - actionablePlans.length,
        failedUsers: 0,
        requiredGasBnb: formatUnits(requiredGasAmount, 18),
        feeWalletBalanceBnb: formatUnits(feeWalletBalance, 18),
        totalDbAmount: toDisplayAmount(totalDbAmountUnits, tokenDecimals),
        totalOnChainAmount: toDisplayAmount(totalOnChainAmountUnits, tokenDecimals),
        totalSweepAmount: toDisplayAmount(totalSweepAmountUnits, tokenDecimals),
        issues,
        users: summarizeUsers(plans),
      };

      return NextResponse.json(
        {
          success: false,
          error: "Insufficient BNB balance for the planned sweep gas funding.",
          dryRun,
          summary,
        },
        { status: 400 },
      );
    }

    const requestedBy = dryRun ? "admin:dry-run" : "admin";
    const preflightSummary: SweepSummary = {
      dryRun,
      requestId: null,
      targetWallet: masterHotWallet,
      tokenDecimals,
      totalUsersScanned: plans.length,
      actionableUsers: actionablePlans.length,
      attemptedUsers: 0,
      sweptUsers: 0,
      skippedUsers: plans.length - actionablePlans.length,
      failedUsers: 0,
      requiredGasBnb: formatUnits(requiredGasAmount, 18),
      feeWalletBalanceBnb: formatUnits(feeWalletBalance, 18),
      totalDbAmount: toDisplayAmount(totalDbAmountUnits, tokenDecimals),
      totalOnChainAmount: toDisplayAmount(totalOnChainAmountUnits, tokenDecimals),
      totalSweepAmount: toDisplayAmount(totalSweepAmountUnits, tokenDecimals),
      issues,
      users: summarizeUsers(plans),
    };

    requestId = await insertSweepRequest(client, {
      totalAmount: preflightSummary.totalSweepAmount,
      targetWallet: masterHotWallet,
      status: dryRun ? "dry_run" : "processing",
      requestedBy,
      dryRun,
      actionableUsers: actionablePlans.length,
      attemptedUsers: 0,
      sweptUsers: 0,
      skippedUsers: plans.length - actionablePlans.length,
      failedUsers: 0,
      totalDbAmount: preflightSummary.totalDbAmount,
      totalOnChainAmount: preflightSummary.totalOnChainAmount,
      summary: preflightSummary,
    });
    preflightSummary.requestId = requestId;

    if (dryRun) {
      if (requestId) {
        await updateSweepRequest(client, requestId, {
          totalAmount: preflightSummary.totalSweepAmount,
          status: "dry_run",
          attemptedUsers: 0,
          sweptUsers: 0,
          skippedUsers: preflightSummary.skippedUsers,
          failedUsers: 0,
          totalDbAmount: preflightSummary.totalDbAmount,
          totalOnChainAmount: preflightSummary.totalOnChainAmount,
          summary: preflightSummary,
        });
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: "Sweep dry-run completed. No blockchain transaction was sent.",
        summary: preflightSummary,
      });
    }

    let attemptedUsers = 0;
    let sweptUsers = 0;
    let failedUsers = 0;
    let totalSweptUnits = BigInt(0);

    for (const plan of actionablePlans) {
      attemptedUsers += 1;

      try {
        const userNode = HDNodeWallet.fromPhrase(mnemonic, "", `m/44'/60'/0'/0/${plan.derivationIndex}`);
        const userWallet = new Wallet(userNode.privateKey, provider);
        const usdtContract = new Contract(usdtContractAddress, ERC20_ABI, userWallet);

        const gasFundingTx = await masterFeeWallet.sendTransaction({
          to: userWallet.address,
          value: GAS_FUND_AMOUNT,
        });
        await gasFundingTx.wait();

        const transferTx = await usdtContract.transfer(masterHotWallet, plan.sweepAmountUnits);
        await transferTx.wait();

        await client.query("BEGIN");
        try {
          await client.query(
            `UPDATE public.user_balances
             SET available_balance = GREATEST(available_balance - $2::numeric, 0),
                 updated_at = timezone('utc'::text, now())
             WHERE id = $1`,
            [plan.balanceId, plan.sweepAmountText],
          );
          await client.query(
            `INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
             VALUES ($1, 2, $2::numeric, 'WITHDRAW', 'COMPLETED', $3, $4::jsonb)`,
            [
              plan.userId,
              `-${plan.sweepAmountText}`,
              transferTx.hash,
              JSON.stringify({
                source: "admin_sweep",
                target_wallet: masterHotWallet,
                gas_funding_tx_hash: gasFundingTx.hash,
                stored_address: plan.storedAddress,
                derived_address: plan.derivedAddress,
                derivation_index: plan.derivationIndex,
                db_amount: plan.dbAmountText,
                onchain_amount: plan.onChainAmountText,
                swept_amount: plan.sweepAmountText,
              }),
            ],
          );
          await client.query("COMMIT");
        } catch (dbError) {
          await client.query("ROLLBACK");
          throw dbError;
        }

        plan.status = "success";
        plan.gasFundingTxHash = gasFundingTx.hash;
        plan.transferTxHash = transferTx.hash;
        sweptUsers += 1;
        totalSweptUnits += plan.sweepAmountUnits;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        plan.status = "failed";
        plan.reason = message;
        failedUsers += 1;
        issues.push(`${plan.email}: ${message}`);
      }
    }

    const masterUsdtContract = new Contract(usdtContractAddress, ERC20_ABI, provider);
    const refreshedMasterUsdtBalance = await masterUsdtContract.balanceOf(masterHotWallet);
    await client.query(
      `INSERT INTO public.system_settings (key, value)
       VALUES ('hot_balance_usdt', $1)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value`,
      [toDisplayAmount(refreshedMasterUsdtBalance, tokenDecimals)],
    );

    const finalSummary: SweepSummary = {
      dryRun: false,
      requestId,
      targetWallet: masterHotWallet,
      tokenDecimals,
      totalUsersScanned: plans.length,
      actionableUsers: actionablePlans.length,
      attemptedUsers,
      sweptUsers,
      skippedUsers: plans.filter((plan) => plan.status === "skip").length,
      failedUsers,
      requiredGasBnb: formatUnits(requiredGasAmount, 18),
      feeWalletBalanceBnb: formatUnits(feeWalletBalance, 18),
      totalDbAmount: toDisplayAmount(totalDbAmountUnits, tokenDecimals),
      totalOnChainAmount: toDisplayAmount(totalOnChainAmountUnits, tokenDecimals),
      totalSweepAmount: toDisplayAmount(totalSweptUnits, tokenDecimals),
      issues,
      users: summarizeUsers(plans),
    };

    if (requestId) {
      await updateSweepRequest(client, requestId, {
        totalAmount: finalSummary.totalSweepAmount,
        status: failedUsers > 0 ? "completed_with_errors" : "completed",
        attemptedUsers,
        sweptUsers,
        skippedUsers: finalSummary.skippedUsers,
        failedUsers,
        totalDbAmount: finalSummary.totalDbAmount,
        totalOnChainAmount: finalSummary.totalOnChainAmount,
        summary: finalSummary,
      });
    }

    return NextResponse.json({
      success: sweptUsers > 0,
      dryRun: false,
      sweptAmount: Number(finalSummary.totalSweepAmount),
      message: failedUsers > 0
        ? "Sweep finished with partial failures. Review the per-wallet summary before retrying."
        : "Sweep completed successfully.",
      summary: finalSummary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await client.query("ROLLBACK").catch(() => undefined);

    if (requestId) {
      const failedSummary: SweepSummary = {
        dryRun: false,
        requestId,
        targetWallet: "",
        tokenDecimals: 18,
        totalUsersScanned: 0,
        actionableUsers: 0,
        attemptedUsers: 0,
        sweptUsers: 0,
        skippedUsers: 0,
        failedUsers: 1,
        requiredGasBnb: "0",
        feeWalletBalanceBnb: "0",
        totalDbAmount: "0",
        totalOnChainAmount: "0",
        totalSweepAmount: "0",
        issues: [message],
        users: [],
      };
      await updateSweepRequest(client, requestId, {
        totalAmount: "0",
        status: "failed",
        attemptedUsers: 0,
        sweptUsers: 0,
        skippedUsers: 0,
        failedUsers: 1,
        totalDbAmount: "0",
        totalOnChainAmount: "0",
        summary: failedSummary,
      }).catch(() => undefined);
    }

    console.error("wallet/sweep route error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
