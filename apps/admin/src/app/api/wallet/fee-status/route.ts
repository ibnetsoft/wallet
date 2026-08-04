import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";

export const dynamic = "force-dynamic";

const BSC_RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const provider = new JsonRpcProvider(BSC_RPC_URL);

export async function GET() {
  try {
    const feeWalletPk = process.env.MASTER_FEE_WALLET_PRIVATE_KEY;
    
    if (!feeWalletPk) {
      return NextResponse.json({ success: false, error: "MASTER_FEE_WALLET_PRIVATE_KEY is not configured" }, { status: 500 });
    }

    const feeWallet = new Wallet(feeWalletPk, provider);
    const balanceWei = await provider.getBalance(feeWallet.address);
    const balanceBnb = formatEther(balanceWei);

    return NextResponse.json({
      success: true,
      address: feeWallet.address,
      balance: parseFloat(balanceBnb)
    });
  } catch (err: any) {
    console.error("GET api/wallet/fee-status error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
