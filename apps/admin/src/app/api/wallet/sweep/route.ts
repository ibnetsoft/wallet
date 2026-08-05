import { NextResponse } from "next/server";
import { Pool } from "pg";
import { parseEther, formatUnits, Wallet, HDNodeWallet, JsonRpcProvider, Contract } from "ethers";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BSC_RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const provider = new JsonRpcProvider(BSC_RPC_URL);

// ERC20 ABI (transfer and balanceOf)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { target_wallet } = await request.json();

    // 1. Fetch Master Hot Wallet from system_settings or use target_wallet
    const hotWalletRes = await client.query("SELECT value FROM public.system_settings WHERE key = 'master_hot_wallet'");
    const masterHotWallet = (hotWalletRes.rows.length > 0 && hotWalletRes.rows[0].value) ? hotWalletRes.rows[0].value : target_wallet;

    if (!masterHotWallet) {
      return NextResponse.json({ success: false, error: "마스터 핫 지갑 주소가 설정되지 않았거나 target_wallet이 누락되었습니다." }, { status: 400 });
    }

    let feeWalletPk = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;
    const pkRes = await client.query("SELECT value FROM public.system_settings WHERE key = 'master_hot_wallet_private_key'");
    if (pkRes.rows.length > 0 && pkRes.rows[0].value) {
      feeWalletPk = pkRes.rows[0].value;
    }

    const mnemonic = process.env.WALLET_MASTER_MNEMONIC;

    if (!feeWalletPk || !mnemonic) {
      return NextResponse.json({ success: false, error: "마스터 지갑 개인키(DB설정/환경변수) 또는 니모닉 환경변수가 누락되었습니다." }, { status: 500 });
    }

    // 2. Instantiate Master Fee Wallet (using master hot wallet private key)
    const masterFeeWallet = new Wallet(feeWalletPk, provider);

    // 3. Fetch user wallets and balances where USDT (asset_id = 2) available_balance > 0
    const queryRes = await client.query(`
      SELECT 
        ub.id as balance_id,
        ub.user_id,
        ub.available_balance,
        uw.address,
        uw.derivation_index
      FROM public.user_balances ub
      JOIN public.user_wallets uw ON ub.user_id = uw.user_id
      WHERE ub.asset_id = 2 AND ub.available_balance > 0
    `);

    const users = queryRes.rows;

    if (users.length === 0) {
      return NextResponse.json({ success: false, error: "모으기 가능한 유저 USDT 잔액이 없습니다." }, { status: 400 });
    }

    // Get USDT contract address
    const assetRes = await client.query("SELECT contract_address FROM public.assets WHERE id = 2");
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

      // 6. Update the PostgreSQL DB ONLY AFTER the transactions are confirmed.
      await client.query("BEGIN");
      await client.query("UPDATE public.user_balances SET available_balance = 0 WHERE id = $1", [user.balance_id]);
      
      // Add ledger entry for the sweep out
      const amountFormatted = parseFloat(formatUnits(amountToSweep, 18));
      await client.query(`
        INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash)
        VALUES ($1, 2, $2, 'WITHDRAW', 'COMPLETED', $3)
      `, [user.user_id, -amountFormatted, transferTx.hash]);

      await client.query("COMMIT");
    }

    if (totalSwept === BigInt(0)) {
      return NextResponse.json({ success: false, error: "실제 온체인 잔고가 있는 유저가 없습니다." }, { status: 400 });
    }

    const sweptAmountFormatted = formatUnits(totalSwept, 18); // assuming USDT on BSC has 18 decimals

    await client.query("BEGIN");
    
    // Update master hot wallet balance in system_settings
    await client.query(`
      INSERT INTO public.system_settings (key, value, description)
      VALUES ('hot_balance_usdt', $1, '마스터 핫 지갑 USDT 잔액')
      ON CONFLICT (key) 
      DO UPDATE SET value = (COALESCE(public.system_settings.value::numeric, 0) + $2)::text
    `, [sweptAmountFormatted, parseFloat(sweptAmountFormatted)]);

    // Insert completed sweep request log
    await client.query(`
      INSERT INTO public.sweep_requests (total_amount, target_wallet, status, requested_by)
      VALUES ($1, $2, 'completed', 'admin')
    `, [parseFloat(sweptAmountFormatted), masterHotWallet]);

    await client.query("COMMIT");

    return NextResponse.json({ success: true, sweptAmount: parseFloat(sweptAmountFormatted) });

  } catch (err: any) {
    console.error("wallet/sweep route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
