import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, formatEther, formatUnits } from "ethers";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";
import { getBscRpcUrl, getBscUsdtContract } from "@/lib/chain-config";
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
    if (!masterHotWallet.address || masterHotWallet.issues.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: masterHotWallet.issues.join(" ") || "Master hot wallet is not configured.",
        },
        { status: 503 }
      );
    }

    const provider = new JsonRpcProvider(getBscRpcUrl());
    const [balanceWei, usdtRaw] = await Promise.all([
      provider.getBalance(masterHotWallet.address),
      new Contract(getBscUsdtContract(), ERC20_ABI, provider).balanceOf(masterHotWallet.address),
    ]);

    return NextResponse.json({
      success: true,
      address: masterHotWallet.address,
      balance: parseFloat(formatEther(balanceWei)),
      usdtBalance: parseFloat(formatUnits(usdtRaw, 18)),
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
