import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, formatEther, formatUnits, Contract } from "ethers";

export const dynamic = "force-dynamic";

const BSC_RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const USDT_CONTRACT = process.env.NEXT_PUBLIC_USDT_CONTRACT || "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
const provider = new JsonRpcProvider(BSC_RPC_URL);

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  const dbClient = await pool.connect();
  try {
    // DB에서 마스터 개인키 조회 시도
    let feeWalletPk = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;
    
    const pkRes = await dbClient.query("SELECT value FROM public.system_settings WHERE key = 'master_hot_wallet_private_key'");
    if (pkRes.rows.length > 0 && pkRes.rows[0].value) {
      feeWalletPk = pkRes.rows[0].value;
    }
    
    if (!feeWalletPk) {
      return NextResponse.json({ success: false, error: "MASTER_HOT_WALLET_PRIVATE_KEY가 DB설정 및 환경변수 둘 다 누락되었습니다." }, { status: 500 });
    }

    const feeWallet = new Wallet(feeWalletPk, provider);
    const balanceWei = await provider.getBalance(feeWallet.address);
    const balanceBnb = formatEther(balanceWei);

    // USDT 잔액 조회
    let usdtBalance = 0;
    try {
      const usdtContract = new Contract(USDT_CONTRACT, ERC20_ABI, provider);
      const usdtRaw = await usdtContract.balanceOf(feeWallet.address);
      usdtBalance = parseFloat(formatUnits(usdtRaw, 18));
    } catch (e) {
      console.error("USDT balance query failed:", e);
    }

    return NextResponse.json({
      success: true,
      address: feeWallet.address,
      balance: parseFloat(balanceBnb),
      usdtBalance
    });
  } catch (err: any) {
    console.error("GET api/wallet/fee-status error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    dbClient.release();
  }
}
