import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const hongbaoAssetRes = await client.query(
      `INSERT INTO public.assets (symbol, contract_address, decimals, is_active)
       VALUES ('HONGBAO', NULL, 0, true)
       ON CONFLICT (symbol) DO UPDATE SET symbol = EXCLUDED.symbol
       RETURNING id`
    );
    const hongbaoAssetId = hongbaoAssetRes.rows[0]?.id;

    if (hongbaoAssetId) {
      const expectedHongbaoRes = await client.query(
        `SELECT COALESCE(SUM(
            CASE
              WHEN package_level = 2 THEN 1
              WHEN package_level = 3 THEN 3
              ELSE 0
            END
          ), 0) AS expected_hongbao
         FROM public.user_game_machines
         WHERE user_id = $1`,
        [userId]
      );
      const expectedHongbao = parseFloat(expectedHongbaoRes.rows[0]?.expected_hongbao ?? "0");

      await client.query(
        `INSERT INTO public.user_balances (user_id, asset_id, available_balance, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, asset_id)
         DO UPDATE SET
           available_balance = GREATEST(public.user_balances.available_balance, EXCLUDED.available_balance),
           updated_at = NOW()`,
        [userId, hongbaoAssetId, expectedHongbao]
      );
    }

    // JOIN query to get balance by symbol dynamically
    const res = await client.query(`
      SELECT b.available_balance, a.symbol 
      FROM public.user_balances b
      JOIN public.assets a ON b.asset_id = a.id
      WHERE b.user_id = $1
    `, [userId]);

    const balances: Record<string, number> = {
      USDT: 0,
      URC: 0,
      BNB: 0,
      JADE: 0,
      HONGBAO: 0
    };

    res.rows.forEach((row) => {
      if (row.symbol) {
        balances[row.symbol.toUpperCase()] = parseFloat(row.available_balance || "0");
      }
    });

    return NextResponse.json({ success: true, balances });
  } catch (err: any) {
    console.error("GET api/user/balance error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
