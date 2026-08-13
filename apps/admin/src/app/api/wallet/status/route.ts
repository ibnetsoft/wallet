import { NextResponse } from "next/server";
import { Pool } from "pg";
import { Contract, JsonRpcProvider, Wallet, formatEther, formatUnits } from "ethers";
import { getBscRpcUrl, getBscUsdtContract } from "@/lib/chain-config";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BSC_RPC_URL = getBscRpcUrl();
const USDT_CONTRACT = getBscUsdtContract();
const ERC20_ABI = ["function balanceOf(address account) view returns (uint256)"];

export async function GET() {
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
      const settingsRes = await client.query("SELECT key, value FROM public.system_settings");
      const settings = settingsRes.rows;
      const settingsMap = Object.fromEntries(settings.map((row) => [row.key, row.value]));

      let walletSnapshot: {
        address: string;
        bnbBalance: number;
        usdtBalance: number;
      } | null = null;

      try {
        const walletPk =
          settingsMap["master_hot_wallet_private_key"] || process.env.MASTER_HOT_WALLET_PRIVATE_KEY;

        if (walletPk) {
          const provider = new JsonRpcProvider(BSC_RPC_URL);
          const wallet = new Wallet(walletPk, provider);
          const [bnbRaw, usdtRaw] = await Promise.all([
            provider.getBalance(wallet.address),
            new Contract(USDT_CONTRACT, ERC20_ABI, provider).balanceOf(wallet.address),
          ]);

          walletSnapshot = {
            address: wallet.address,
            bnbBalance: parseFloat(formatEther(bnbRaw)),
            usdtBalance: parseFloat(formatUnits(usdtRaw, 18)),
          };

          settingsMap["master_hot_wallet"] = wallet.address;
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
