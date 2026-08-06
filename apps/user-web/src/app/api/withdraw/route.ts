import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const { userId, amount, address } = await request.json();

    if (!userId || !amount || parseFloat(amount) < 30 || !address) {
      return NextResponse.json({ success: false, error: "Invalid parameters. Minimum withdrawal is 30 USDT." }, { status: 400 });
    }

    const withdrawAmount = parseFloat(amount);

    await client.query("BEGIN");

    // 1. Check if user has sufficient available balance (asset_id = 2 for USDT)
    const balRes = await client.query(
      "SELECT available_balance FROM public.user_balances WHERE user_id = $1 AND asset_id = 2 FOR UPDATE",
      [userId]
    );

    if (balRes.rows.length === 0 || parseFloat(balRes.rows[0].available_balance) < withdrawAmount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "잔액이 부족합니다." }, { status: 400 });
    }

    // 2. Deduct from available_balance
    await client.query(
      "UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW() WHERE user_id = $2 AND asset_id = 2",
      [withdrawAmount, userId]
    );

    // 3. Insert negative entry into ledger_entries (tx_type = 'WITHDRAW', status = 'PENDING')
    await client.query(`
      INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, details)
      VALUES ($1, 2, $2, 'WITHDRAW', 'PENDING', $3)
    `, [userId, -withdrawAmount, JSON.stringify({ address, description: "유저 USDT 출금 신청" })]);

    await client.query("COMMIT");
    return NextResponse.json({ success: true });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("POST api/withdraw error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
