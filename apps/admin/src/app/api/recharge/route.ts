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
    const { email, amount } = await request.json();
    if (!email || !amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ success: false, error: "email and positive amount are required" }, { status: 400 });
    }

    const rechargeVal = parseFloat(amount);

    await client.query("BEGIN");

    // 1. Get user id by email or nickname
    const userRes = await client.query("SELECT id FROM public.users WHERE email = $1 OR nickname = $1", [email.trim()]);
    if (userRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "해당 이메일 또는 닉네임의 회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const userId = userRes.rows[0].id;

    // 2. Upsert user balance (asset_id = 2 for USDT)
    await client.query(`
      INSERT INTO public.user_balances (user_id, asset_id, available_balance)
      VALUES ($1, 2, $2)
      ON CONFLICT (user_id, asset_id)
      DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance
    `, [userId, rechargeVal]);

    // 3. Insert transaction log into ledger_entries
    const txHash = `SU-RCG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    await client.query(`
      INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
      VALUES ($1, 2, $2, 'DEPOSIT', 'COMPLETED', $3, $4)
    `, [userId, rechargeVal, txHash, JSON.stringify({ description: "어드민 수동 USDT 충전" })]);

    await client.query("COMMIT");
    return NextResponse.json({ success: true, txHash });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("api/recharge error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
