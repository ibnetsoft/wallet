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
    const { target_wallet } = await request.json();
    if (!target_wallet) {
      return NextResponse.json({ success: false, error: "target_wallet is required" }, { status: 400 });
    }

    await client.query("BEGIN");

    // 1. Calculate sum of all user USDT balances (asset_id = 2)
    const sumRes = await client.query(`
      SELECT COALESCE(SUM(available_balance::numeric), 0) as total
      FROM public.user_balances
      WHERE asset_id = 2
    `);
    const totalSweepable = parseFloat(sumRes.rows[0].total || "0");

    if (totalSweepable <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "모으기 가능한 유저 USDT 잔액이 없습니다." }, { status: 400 });
    }

    // 2. Set all user USDT balances to 0
    await client.query(`
      UPDATE public.user_balances
      SET available_balance = 0
      WHERE asset_id = 2
    `);

    // 3. Update master hot wallet balance in system_settings
    await client.query(`
      INSERT INTO public.system_settings (key, value, description)
      VALUES ('hot_balance_usdt', $1, '마스터 핫 지갑 USDT 잔액')
      ON CONFLICT (key) 
      DO UPDATE SET value = (COALESCE(public.system_settings.value::numeric, 0) + $2)::text
    `, [totalSweepable.toString(), totalSweepable]);

    // 4. Insert completed sweep request log
    await client.query(`
      INSERT INTO public.sweep_requests (total_amount, target_wallet, status, requested_by)
      VALUES ($1, $2, 'completed', 'admin')
    `, [totalSweepable, target_wallet]);

    await client.query("COMMIT");
    return NextResponse.json({ success: true, sweptAmount: totalSweepable });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("wallet/sweep route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
