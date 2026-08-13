import { NextResponse } from "next/server";
import { Pool } from "pg";
import { parseEther, formatUnits, keccak256, Wallet, HDNodeWallet, JsonRpcProvider, Contract } from "ethers";
import { getBscRpcUrl } from "@/lib/chain-config";
import { getVerifiedAdmin } from "@/lib/admin-auth";
import {
  refreshMasterHotWalletLock,
  getMasterHotWalletLock,
  markMasterHotWalletTransactionBroadcast,
  releaseMasterHotWalletLock,
  resumeMasterHotWalletLock,
  tryAcquireMasterHotWalletLock,
} from "@/lib/master-wallet-lock";

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

async function reconcileMasterWalletLock(client: import("pg").PoolClient) {
  const lock = await getMasterHotWalletLock(client);
  if (!lock || lock.state !== "BROADCAST" || !lock.txHash) {
    return lock;
  }

  const receipt = await provider.getTransactionReceipt(lock.txHash);
  if (!receipt) {
    return lock;
  }

  if (lock.operation === "external-transfer") {
    await client.query(
      `UPDATE public.vault_transfers
       SET status = $2,
           confirmed_at = NOW(),
           failure_reason = $3,
           updated_at = NOW()
       WHERE tx_hash = $1 AND status = 'BROADCAST'`,
      [
        lock.txHash,
        receipt.status === 1 ? "CONFIRMED" : "FAILED",
        receipt.status === 1 ? null : "The BSC transaction was mined but reverted.",
      ]
    );
  } else if (lock.operation === "withdrawal") {
    await client.query(
      `UPDATE public.ledger_entries
       SET status = $2
       WHERE tx_hash = $1
         AND tx_type = 'WITHDRAW'
         AND status = 'PROCESSING'`,
      [lock.txHash, receipt.status === 1 ? "COMPLETED" : "FAILED"]
    );
  } else if (lock.operation !== "sweep") {
    return lock;
  }

  await releaseMasterHotWalletLock(client, lock.token);
  return null;
}

export async function POST(request: Request) {
  const client = await pool.connect();
  let masterWalletLockToken: string | null = null;
  try {
    const admin = await getVerifiedAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await request.json().catch(() => ({}));

    const feeWalletPk = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;

    const mnemonic = process.env.WALLET_MASTER_MNEMONIC;

    if (!feeWalletPk || !mnemonic) {
      return NextResponse.json({ success: false, error: "서버 환경변수 MASTER_HOT_WALLET_PRIVATE_KEY 또는 WALLET_MASTER_MNEMONIC이 누락되었습니다." }, { status: 500 });
    }

    // The signer-derived address is the only safe sweep destination. A stored
    // display address must never redirect operational funds elsewhere.
    const masterFeeWallet = new Wallet(feeWalletPk, provider);
    const masterHotWallet = masterFeeWallet.address;

    masterWalletLockToken = await tryAcquireMasterHotWalletLock(client, "sweep");
    if (!masterWalletLockToken) {
      const unresolvedLock = await reconcileMasterWalletLock(client);
      if (!unresolvedLock) {
        masterWalletLockToken = await tryAcquireMasterHotWalletLock(client, "sweep");
      }
    }
    if (!masterWalletLockToken) {
      return NextResponse.json(
        { success: false, error: "다른 마스터 지갑 온체인 거래가 진행 중입니다. 확정 후 다시 시도하세요." },
        { status: 409 }
      );
    }

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
      if (!(await refreshMasterHotWalletLock(client, masterWalletLockToken))) {
        throw new Error("마스터 지갑 잠금이 만료되었습니다. 온체인 상태를 확인한 뒤 다시 시도하세요.");
      }

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
      const gasFundingRequest = await masterFeeWallet.populateTransaction({
        to: userWallet.address,
        value: parseEther("0.0005")
      });
      const signedGasFundingTransaction = await masterFeeWallet.signTransaction(gasFundingRequest);
      const gasFundingTxHash = keccak256(signedGasFundingTransaction);
      const lockRecorded = await markMasterHotWalletTransactionBroadcast(
        client,
        masterWalletLockToken,
        gasFundingTxHash
      );
      if (!lockRecorded) {
        throw new Error("마스터 지갑 가스비 전송 잠금을 기록하지 못했습니다.");
      }
      const gasFundTx = await provider.broadcastTransaction(signedGasFundingTransaction);
      const gasFundReceipt = await gasFundTx.wait(1);
      if (!gasFundReceipt || gasFundReceipt.status !== 1) {
        throw new Error("유저 지갑 가스비 전송이 확정되지 않았습니다.");
      }
      if (!(await resumeMasterHotWalletLock(client, masterWalletLockToken))) {
        throw new Error("마스터 지갑 잠금을 재개하지 못했습니다.");
      }

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
      INSERT INTO public.system_settings (key, value)
      VALUES ('hot_balance_usdt', $1)
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
    if (masterWalletLockToken) {
      try {
        const currentLock = await getMasterHotWalletLock(client);
        if (currentLock?.token === masterWalletLockToken && currentLock.state === "LOCKED") {
          await releaseMasterHotWalletLock(client, masterWalletLockToken);
        }
      } catch (unlockError) {
        console.error("wallet/sweep lock release error:", unlockError);
      }
    }
    client.release();
  }
}
