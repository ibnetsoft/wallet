import { NextResponse } from "next/server";
import { Pool } from "pg";
import {
  Contract,
  JsonRpcProvider,
  TransactionReceipt,
  ZeroAddress,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
} from "ethers";
import { getAdminUser } from "@/lib/admin-auth";
import { getBscRpcUrl, getBscUsdtContract } from "@/lib/chain-config";
import { resolveMasterHotWallet } from "@/lib/master-hot-wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SUPPORTED_ASSETS = new Set(["USDT", "BNB"]);
const BSC_MAINNET_CHAIN_ID = 56;
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];
const RECEIPT_POLL_DELAYS_MS = [3000, 5000, 8000, 12000];

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function sanitizeError(error: unknown) {
  void error;
  return "The cold vault transfer could not be completed.";
}

function isRateLimitError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("request limit reached")
    || error.message.includes("rate limit")
    || error.message.includes("too many requests");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReceiptWithBackoff(
  provider: JsonRpcProvider,
  txHash: string,
): Promise<TransactionReceipt> {
  let lastError: unknown;

  for (const delay of RECEIPT_POLL_DELAYS_MS) {
    await sleep(delay);

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Timed out while waiting for the BSC transaction receipt.");
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

function parseAmount(asset: string, amountText: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amountText)) {
    return null;
  }

  try {
    return asset === "BNB" ? parseEther(amountText) : parseUnits(amountText, 18);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return errorResponse("Unauthorized", 401);
  }
  if (!isSameOriginRequest(request)) {
    return errorResponse("Invalid request origin.", 403);
  }

  let body: { amount?: unknown; asset?: unknown; coldVaultAddress?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid request body.");
  }

  const amountText = typeof body.amount === "number"
    ? String(body.amount)
    : typeof body.amount === "string"
      ? body.amount.trim()
      : "";
  const asset = typeof body.asset === "string" ? body.asset.trim().toUpperCase() : "";
  const rawRecipient = typeof body.coldVaultAddress === "string" ? body.coldVaultAddress.trim() : "";

  if (!SUPPORTED_ASSETS.has(asset)) {
    return errorResponse("Only USDT and BNB transfers are supported.");
  }
  if (!isAddress(rawRecipient)) {
    return errorResponse("A valid BSC cold vault address is required.");
  }

  const amountUnits = parseAmount(asset, amountText);
  if (!amountUnits || amountUnits <= BigInt(0)) {
    return errorResponse(`Enter a positive ${asset} amount with up to 18 decimal places.`);
  }

  const recipientAddress = getAddress(rawRecipient);
  const provider = new JsonRpcProvider(getBscRpcUrl());
  const client = await pool.connect();

  try {
    const masterHotWallet = await resolveMasterHotWallet(client);
    if (!masterHotWallet.address || !masterHotWallet.signer || masterHotWallet.issues.length > 0) {
      return errorResponse(
        masterHotWallet.issues.join(" ") || "Master hot wallet is not configured.",
        503,
      );
    }

    if (
      recipientAddress === ZeroAddress
      || recipientAddress.toLowerCase() === masterHotWallet.address.toLowerCase()
    ) {
      return errorResponse("The cold vault recipient must be a different non-zero BSC address.");
    }

    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(BSC_MAINNET_CHAIN_ID)) {
      return errorResponse("The configured BSC RPC URL is not connected to BSC mainnet.", 503);
    }

    const signer = masterHotWallet.signer.connect(provider);
    const sourceAddress = masterHotWallet.address;

    let txHash = "";
    let explorerUrl = "";

    if (asset === "BNB") {
      const balanceWei = await provider.getBalance(sourceAddress);
      if (amountUnits >= balanceWei) {
        return errorResponse(
          `Insufficient BNB balance. Available: ${formatEther(balanceWei)} BNB.`,
          400,
        );
      }

      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: amountUnits,
      });
      txHash = tx.hash;
      const receipt = await waitForReceiptWithBackoff(provider, txHash);
      if (receipt.status !== 1) {
        throw new Error("The BNB transfer transaction was mined but reverted.");
      }
      explorerUrl = `https://bscscan.com/tx/${txHash}`;
    } else {
      const usdtContract = new Contract(getBscUsdtContract(), ERC20_ABI, signer);
      const usdtBalance = await usdtContract.balanceOf(sourceAddress) as bigint;
      if (amountUnits > usdtBalance) {
        return errorResponse(
          `Insufficient USDT balance. Available: ${formatUnits(usdtBalance, 18)} USDT.`,
          400,
        );
      }

      const tx = await usdtContract.transfer(recipientAddress, amountUnits);
      txHash = tx.hash;
      const receipt = await waitForReceiptWithBackoff(provider, txHash);
      if (receipt.status !== 1) {
        throw new Error("The USDT transfer transaction was mined but reverted.");
      }
      explorerUrl = `https://bscscan.com/tx/${txHash}`;
    }

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO public.vault_transfers
        (from_label, to_label, amount, asset, cold_vault_address, note)
       VALUES ($1, 'Offline cold vault', $2, $3, $4, $5)`,
      [
        `Master hot wallet (${sourceAddress.slice(0, 8)}...)`,
        amountText,
        asset,
        recipientAddress,
        `On-chain transfer by ${admin.email} | txHash=${txHash}`,
      ],
    );
    await client.query(
      `INSERT INTO public.system_settings (key, value)
       VALUES ('cold_vault_address', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [recipientAddress],
    );
    if (asset === "USDT") {
      await client.query(
        `INSERT INTO public.system_settings (key, value, description)
         VALUES ('cold_balance_usdt', $1, 'Cumulative logged cold vault USDT amount')
         ON CONFLICT (key) DO UPDATE
           SET value = (
             COALESCE(NULLIF(BTRIM(public.system_settings.value), ''), '0')::numeric
             + EXCLUDED.value::numeric
           )::text`,
        [amountText],
      );
    }
    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback failures when no transaction was started.
    }
    console.error("cold-vault-log route error:", sanitizeError(error), error);
    return errorResponse(sanitizeError(error), 500);
  } finally {
    client.release();
  }
}
