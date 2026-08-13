import { NextResponse } from "next/server";
import { JsonRpcProvider, Wallet, formatEther, formatUnits, Contract } from "ethers";
import { getBscRpcUrl, getBscUsdtContract } from "@/lib/chain-config";
import { getVerifiedAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const BSC_RPC_URL = getBscRpcUrl();
const USDT_CONTRACT = getBscUsdtContract();
const provider = new JsonRpcProvider(BSC_RPC_URL);

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)"
];

export async function GET() {
  try {
    const admin = await getVerifiedAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const feeWalletPk = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;
    if (!feeWalletPk) {
      return NextResponse.json({ success: false, error: "MASTER_HOT_WALLET_PRIVATE_KEY server environment variable is missing." }, { status: 500 });
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
  }
}
