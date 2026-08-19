import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function toRate(value: unknown) {
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await pool.connect();

    try {
      const [totalsResult, settingsResult] = await Promise.all([
        client.query<{
          total_product_sales: string | number;
          total_game_wagers: string | number;
        }>(
          `SELECT
             COALESCE(
               (SELECT SUM(purchase_price::numeric) FROM public.user_game_machines),
               0
             ) AS total_product_sales,
             COALESCE(
               (
                 SELECT SUM(ABS(amount::numeric))
                 FROM public.ledger_entries
                 WHERE tx_type = 'GAME_WAGER' AND status = 'COMPLETED'
               ),
               0
             ) AS total_game_wagers`
        ),
        client.query<{ key: string; value: string }>(
          `SELECT key, value
           FROM public.system_settings
           WHERE key = ANY($1::text[])`,
          [["sales_allowance_rate", "game_allowance_rate"]]
        ),
      ]);

      const settingsMap = Object.fromEntries(
        settingsResult.rows.map((row) => [row.key, row.value])
      );

      const totalProductSales = Number(totalsResult.rows[0]?.total_product_sales ?? 0);
      const totalGameWagers = Number(totalsResult.rows[0]?.total_game_wagers ?? 0);
      const salesRate = toRate(settingsMap.sales_allowance_rate);
      const gameRate = toRate(settingsMap.game_allowance_rate);
      const salesAllowanceAmount = totalProductSales * (salesRate / 100);
      const gameAllowanceAmount = totalGameWagers * (gameRate / 100);

      return NextResponse.json({
        success: true,
        summary: {
          totalProductSales,
          totalGameWagers,
          salesRate,
          gameRate,
          salesAllowanceAmount,
          gameAllowanceAmount,
          totalAllowanceAmount: salesAllowanceAmount + gameAllowanceAmount,
        },
      });
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error("GET api/allowances/summary error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load allowance summary.",
      },
      { status: 500 }
    );
  }
}
