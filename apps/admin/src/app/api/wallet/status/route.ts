import { NextResponse } from "next/server";
import { Pool } from "pg";
import { Contract, JsonRpcProvider, formatEther, formatUnits } from "ethers";
import { getBscRpcUrl, getBscUsdtContract } from "@/lib/chain-config";
import { getAdminUser } from "@/lib/admin-auth";
import { resolveMasterHotWallet } from "@/lib/master-hot-wallet";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BSC_RPC_URL = getBscRpcUrl();
const USDT_CONTRACT = getBscUsdtContract();
const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"];
const CLIENT_VISIBLE_SETTING_KEYS = [
  "swap_fee_rate",
  "withdrawal_fee_rate",
  "master_hot_wallet",
  "cold_vault_address",
  "hot_balance_usdt",
  "cold_balance_usdt",
  "hot_wallet_history",
];

function sanitizeWalletHistory(value: unknown) {
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return "[]";

    return JSON.stringify(
      parsed
        .filter((entry) => typeof entry?.address === "string" && typeof entry?.date === "string")
        .map((entry) => ({ address: entry.address, date: entry.date }))
        .slice(0, 5)
    );
  } catch {
    return "[]";
  }
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await pool.connect();
    try {
      // 1. Get users with balances
      // Since it's a joined query, we write a SQL query to fetch what we need.
      const usersRes = await client.query(`
        SELECT 
          u.id, 
          u.email, 
          COALESCE(
            json_agg(json_build_object('address', uw.address)) FILTER (WHERE uw.address IS NOT NULL), 
            '[]'
          ) as user_wallets,
          COALESCE(
            json_agg(json_build_object('available_balance', ub.available_balance, 'asset_id', ub.asset_id)) FILTER (WHERE ub.asset_id IS NOT NULL), 
            '[]'
          ) as user_balances
        FROM public.users u
        LEFT JOIN public.user_wallets uw ON u.id = uw.user_id
        LEFT JOIN public.user_balances ub ON u.id = ub.user_id
        GROUP BY u.id, u.email
        LIMIT 100
      `);
      
      const usersWithBalances = usersRes.rows;

      // 2. Get system settings
      const settingsRes = await client.query(
        `SELECT key, value
         FROM public.system_settings
         WHERE key = ANY($1::text[])`,
        [CLIENT_VISIBLE_SETTING_KEYS]
      );
      const settings = settingsRes.rows.map((row) => (
        row.key === "hot_wallet_history"
          ? { ...row, value: sanitizeWalletHistory(row.value) }
          : row
      ));
      const settingsMap = Object.fromEntries(settings.map((row) => [row.key, row.value]));

      let walletSnapshot: {
        address: string;
        bnbBalance: number;
        usdtBalance: number;
      } | null = null;

      try {
        const masterHotWallet = await resolveMasterHotWallet(client);
        if (masterHotWallet.address) {
          settingsMap["master_hot_wallet"] = masterHotWallet.address;
        }

        if (masterHotWallet.address) {
          const provider = new JsonRpcProvider(BSC_RPC_URL);
          const [bnbRaw, usdtRaw] = await Promise.all([
            provider.getBalance(masterHotWallet.address),
            new Contract(USDT_CONTRACT, ERC20_ABI, provider).balanceOf(masterHotWallet.address),
          ]);

          walletSnapshot = {
            address: masterHotWallet.address,
            bnbBalance: parseFloat(formatEther(bnbRaw)),
            usdtBalance: parseFloat(formatUnits(usdtRaw, 18)),
          };

          settingsMap["hot_balance_usdt"] = walletSnapshot.usdtBalance.toString();
        }
      } catch (walletErr) {
        console.error("wallet/status on-chain snapshot error:", walletErr);
      }

      const mergedSettings = Object.entries(settingsMap).map(([key, value]) => ({ key, value }));

      // 3. Get vault transfer logs
      const logsRes = await client.query("SELECT * FROM public.vault_transfers ORDER BY created_at DESC LIMIT 30");
      const logs = logsRes.rows;

      return NextResponse.json({
        success: true,
        usersWithBalances,
        settings: mergedSettings,
        logs,
        walletSnapshot,
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("wallet/status API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
