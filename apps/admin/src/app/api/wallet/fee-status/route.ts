import { NextResponse } from "next/server";
import { Contract, formatEther, formatUnits } from "ethers";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";
import { getBscUsdtContract, withBscReadProviderFallback } from "@/lib/chain-config";
import { resolveMasterHotWallet } from "@/lib/master-hot-wallet";

export const dynamic = "force-dynamic";

const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const dbClient = await pool.connect();
  try {
    const masterHotWallet = await resolveMasterHotWallet(dbClient);
    if (!masterHotWallet.address) {
      return NextResponse.json(
        {
          success: false,
          error: "Master hot wallet is not configured.",
        },
        { status: 503 }
      );
    }
    const masterHotWalletAddress = masterHotWallet.address;

    let balance: number | null = null;
    let usdtBalance: number | null = null;
    let balanceLookupFailed = false;
    let balanceRpcUrl: string | null = null;

    try {
      const result = await withBscReadProviderFallback(async (provider, rpcUrl) => {
        const [balanceWei, usdtRaw] = await Promise.all([
          provider.getBalance(masterHotWalletAddress),
          new Contract(getBscUsdtContract(), ERC20_ABI, provider).balanceOf(masterHotWalletAddress),
        ]);

        return {
          balance: parseFloat(formatEther(balanceWei)),
          usdtBalance: parseFloat(formatUnits(usdtRaw, 18)),
          rpcUrl,
        };
      });

      balance = result.balance;
      usdtBalance = result.usdtBalance;
      balanceRpcUrl = result.rpcUrl;
    } catch (balanceError) {
      balanceLookupFailed = true;
      console.error("GET api/wallet/fee-status balance lookup error:", balanceError);
    }

    return NextResponse.json({
      success: true,
      address: masterHotWalletAddress,
      balance,
      usdtBalance,
      issues: masterHotWallet.issues,
      balanceLookupFailed,
      balanceRpcUrl,
    });
  } catch (err: unknown) {
    console.error("GET api/wallet/fee-status error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to load the master hot wallet balance." },
      { status: 500 }
    );
  } finally {
    dbClient.release();
  }
}
