import { NextResponse } from "next/server";
import { Pool } from "pg";
import { parseEther, formatUnits, Wallet, HDNodeWallet, JsonRpcProvider, Contract } from "ethers";
import { getBscRpcUrl } from "@/lib/chain-config";
import { resolveMasterHotWallet } from "@/lib/master-hot-wallet";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BSC_RPC_URL = getBscRpcUrl();
const provider = new JsonRpcProvider(BSC_RPC_URL);

// ERC20 ABI (transfer and balanceOf)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (admin?.role !== 'SUPER_ADMIN') return NextResponse.json({ success:false,error:'최고 관리자 권한이 필요합니다.' },{status:403});
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({success:false,error:'요청 출처가 일치하지 않습니다.'},{status:403});
  const client = await pool.connect();
  try {
    await request.json();
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
        { status: 503 }
      );
    }

    const masterHotWallet = resolvedMasterWallet.address;

    const mnemonic = process.env.WALLET_MASTER_MNEMONIC;

    if (!mnemonic) {
      return NextResponse.json({ success: false, error: "마스터 지갑 개인키(DB설정/환경변수) 또는 니모닉 환경변수가 누락되었습니다." }, { status: 500 });
    }

    // 2. Instantiate Master Fee Wallet (using master hot wallet private key)
    const masterFeeWallet = resolvedMasterWallet.signer.connect(provider);

    if ((await provider.getNetwork()).chainId !== BigInt(56)) throw new Error('BSC mainnet is required.');
    // Custody assets are independent of members' spendable ledger balances.
    // Never derive an EVM signer for a TRON address.
    const queryRes = await client.query(`
      SELECT uw.user_id,uw.address,uw.derivation_index
      FROM public.user_wallets uw WHERE uw.chain_type = 'BSC'
    `);

    const users = queryRes.rows;

    if (users.length === 0) {
      return NextResponse.json({ success: false, error: "모으기 가능한 유저 USDT 잔액이 없습니다." }, { status: 400 });
    }

    // Get USDT contract address
    const assetRes = await client.query("SELECT contract_address FROM public.assets WHERE symbol = 'USDT' AND is_active = true LIMIT 1");
    if (assetRes.rows.length === 0 || !assetRes.rows[0].contract_address) {
      return NextResponse.json({ success: false, error: "USDT 컨트랙트 주소를 찾을 수 없습니다." }, { status: 500 });
    }
    const usdtContractAddress = assetRes.rows[0].contract_address;

    let totalSwept = BigInt(0);

    // Process each user sequentially
    for (const user of users) {
      const derivationIndex = user.derivation_index;
      
      // Derive user wallet
      const userNode = HDNodeWallet.fromPhrase(mnemonic, "", `m/44'/60'/0'/0/${derivationIndex}`);
      const userWallet = new Wallet(userNode.privateKey, provider);
      if (userWallet.address.toLowerCase() !== user.address.toLowerCase()) throw new Error('Stored BSC wallet does not match its derivation path.');
      if (userWallet.address.toLowerCase() === masterHotWallet.toLowerCase()) continue;
      
      const usdtContract = new Contract(usdtContractAddress, ERC20_ABI, userWallet);
      
      // Check on-chain balance
      const onChainUsdtBalance = await usdtContract.balanceOf(userWallet.address);

      if (onChainUsdtBalance === BigInt(0)) {
        continue;
      }

      const amountToSweep = onChainUsdtBalance;

      // 4. Send ~0.0005 BNB from Master Fee Wallet to the user's wallet for gas. Wait for confirmation.
      const gasFundTx = await masterFeeWallet.sendTransaction({
        to: userWallet.address,
        value: parseEther("0.0005")
      });
      await gasFundTx.wait();

      // 5. Use the user's derived wallet to sign and send their USDT balance to Master Hot Wallet
      const transferTx = await usdtContract.transfer(masterHotWallet, amountToSweep);
      await transferTx.wait();

      totalSwept += amountToSweep;

      // Collection changes custody location, not the member's claim on funds.
      // Record the confirmed custody move separately from withdrawal ledgers.
      await client.query(`INSERT INTO public.sweep_requests(total_amount,target_wallet,status,requested_by)
        VALUES($1,$2,'completed',$3)`,[formatUnits(amountToSweep,18),masterHotWallet,admin.id]);
    }

    if (totalSwept === BigInt(0)) {
      return NextResponse.json({ success: false, error: "실제 온체인 잔고가 있는 유저가 없습니다." }, { status: 400 });
    }

    const sweptAmountFormatted = formatUnits(totalSwept, 18); // assuming USDT on BSC has 18 decimals

    await client.query("BEGIN");
    
    // Update master hot wallet balance in system_settings
    await client.query(`
      INSERT INTO public.system_settings (key, value)
      VALUES ('hot_balance_usdt', $1)
      ON CONFLICT (key) 
      DO UPDATE SET value = (COALESCE(public.system_settings.value::numeric, 0) + $2)::text
    `, [sweptAmountFormatted, parseFloat(sweptAmountFormatted)]);

    await client.query("COMMIT");

    return NextResponse.json({ success: true, sweptAmount: parseFloat(sweptAmountFormatted) });

  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("BSC sweep could not complete", err instanceof Error ? err.name : "UnknownError");
    return NextResponse.json({ success: false, error: "BSC 모으기 결과를 확인하지 못했습니다. 온체인 내역을 확인한 뒤 다시 진행하세요." }, { status: 500 });
  } finally {
    client.release();
  }
}
