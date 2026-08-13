import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const { amount, address } = await request.json();
    const withdrawAmount = Number(amount);
    if (!Number.isFinite(withdrawAmount) || withdrawAmount < 30 || !/^0x[a-fA-F0-9]{40}$/.test(String(address))) {
      return NextResponse.json({ success: false, error: "Invalid withdrawal request. Minimum is 30 USDT." }, { status: 400 });
    }

    await client.query("BEGIN");
    const usdtAsset = await client.query(`SELECT id FROM public.assets WHERE symbol = 'USDT'`);
    if (!usdtAsset.rows[0]) throw new Error("USDT asset is not configured");
    const assetId = usdtAsset.rows[0].id;
    const balance = await client.query(
      `UPDATE public.user_balances
       SET available_balance = available_balance - $1, updated_at = NOW()
       WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1
       RETURNING available_balance`,
      [withdrawAmount, user.id, assetId]
    );
    if (balance.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "Insufficient USDT balance" }, { status: 400 });
    }
    await client.query(
      `INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, details)
       VALUES ($1, $2, $3, 'WITHDRAW', 'PENDING', $4::jsonb)`,
      [user.id, assetId, -withdrawAmount, JSON.stringify({ address, description: "USDT withdrawal request" })]
    );
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    console.error("Withdrawal error:", error);
    return NextResponse.json({ success: false, error: "Failed to submit withdrawal" }, { status: 500 });
  } finally {
    client.release();
  }
}
