import { NextResponse } from "next/server";
import { Pool } from "pg";
import { ethers } from "ethers";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. GET: Fetch pending withdrawals for administrative audit
export async function GET() {
  try {
    const query = `
      SELECT 
        l.id,
        l.user_id,
        l.asset_id,
        l.amount,
        l.status,
        l.tx_hash,
        l.created_at,
        l.details,
        u.email,
        u.nickname
      FROM public.ledger_entries l
      JOIN public.users u ON l.user_id = u.id
      WHERE l.tx_type = 'WITHDRAW' AND l.status = 'PENDING'
      ORDER BY l.created_at DESC
    `;
    const res = await pool.query(query);

    return NextResponse.json({
      success: true,
      withdrawals: res.rows.map((w: any) => ({
        id: w.id,
        userId: w.user_id,
        email: w.email || "unknown@user.com",
        nickname: w.nickname || "-",
        amount: Math.abs(Number(w.amount)), // Withdraw amount is negative in double-entry ledger
        fee: Math.abs(Number(w.amount)) * 0.03, // Calculate 3% default fee
        asset: "USDT",
        txHash: w.tx_hash || "—",
        address: typeof w.details === 'string' ? JSON.parse(w.details)?.address : w.details?.address,
        status: w.status,
        time: new Date(w.created_at).toLocaleTimeString()
      }))
    });

  } catch (err: any) {
    console.error("GET api/withdrawals error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 2. POST: Approve or Reject a specific withdrawal
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { withdrawalId, action, reason } = await request.json();

    if (!withdrawalId || !action) {
      return NextResponse.json(
        { success: false, error: "withdrawalId and action ('APPROVE' | 'REJECT') are required" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // Fetch the target ledger entry to audit
    const entryRes = await client.query(`
      SELECT * FROM public.ledger_entries WHERE id = $1
    `, [withdrawalId]);
    const entry = entryRes.rows[0];

    if (!entry) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "Withdrawal ledger entry not found" },
        { status: 404 }
      );
    }

    if (entry.status !== "PENDING") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: `Withdrawal is already in ${entry.status} status` },
        { status: 400 }
      );
    }

    if (action === "APPROVE") {
      let address = "";
      if (typeof entry.details === 'string') {
        try {
          address = JSON.parse(entry.details).address;
        } catch (e) {}
      } else if (entry.details) {
        address = entry.details.address;
      }

      if (!address) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, error: "Withdrawal address not found in details" },
          { status: 400 }
        );
      }

      const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL;
      let privateKey = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;
      
      const pkRes = await client.query("SELECT value FROM public.system_settings WHERE key = 'master_hot_wallet_private_key'");
      if (pkRes.rows.length > 0 && pkRes.rows[0].value) {
        privateKey = pkRes.rows[0].value;
      }
      
      if (!rpcUrl || !privateKey) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, error: "RPC URL 또는 마스터 개인키(DB설정/환경변수)가 누락되었습니다." },
          { status: 500 }
        );
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      // USDT Contract on BSC: 0x55d398326f99059fF775485246999027B3197955
      const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
      const abi = ["function transfer(address to, uint256 amount) returns (bool)"];
      const usdtContract = new ethers.Contract(usdtAddress, abi, wallet);

      const amountToWithdraw = Math.abs(Number(entry.amount)) * 0.97; // 3% fee deduction
      const parsedAmount = ethers.parseUnits(amountToWithdraw.toString(), 18);

      let txHash = "";
      try {
        const tx = await usdtContract.transfer(address, parsedAmount);
        // Wait for confirmation to ensure it's mined, though optional depending on UX
        // await tx.wait(); 
        txHash = tx.hash;
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Blockchain TX error:", err);
        return NextResponse.json(
          { success: false, error: "Blockchain transaction failed: " + err.message },
          { status: 500 }
        );
      }

      // Approve withdrawal: update status to COMPLETED and save tx_hash
      await client.query(`
        UPDATE public.ledger_entries SET status = 'COMPLETED', tx_hash = $2 WHERE id = $1
      `, [withdrawalId, txHash]);

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        message: "Withdrawal approved successfully and tx sent.",
        txHash
      });

    } else if (action === "REJECT") {
      // Reject withdrawal: refund the locked amount to user's balance and mark ledger entry as FAILED.
      const amountToRefund = Math.abs(Number(entry.amount));

      // Update entry status to FAILED
      await client.query(`
        UPDATE public.ledger_entries SET status = 'FAILED' WHERE id = $1
      `, [withdrawalId]);

      // Add a refund entry in ledger
      await client.query(`
        INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
        VALUES ($1, $2, $3, 'REFUND', 'COMPLETED', $4, $5)
      `, [
        entry.user_id, 
        entry.asset_id, 
        amountToRefund, 
        `Refund-${withdrawalId.substring(0, 8)}`, 
        JSON.stringify({ description: reason || "Withdrawal rejected by Admin" })
      ]);

      // Restore user balance
      await client.query(`
        INSERT INTO public.user_balances (user_id, asset_id, available_balance)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, asset_id) 
        DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance
      `, [entry.user_id, entry.asset_id, amountToRefund]);

      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        message: "Withdrawal rejected. locked funds refunded to user."
      });
    }

    await client.query("ROLLBACK");
    return NextResponse.json(
      { success: false, error: "Invalid action type" },
      { status: 400 }
    );

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("POST api/withdrawals error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
