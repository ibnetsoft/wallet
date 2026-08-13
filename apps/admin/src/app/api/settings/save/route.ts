import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getVerifiedAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(request: Request) {
  try {
    const admin = await getVerifiedAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { rows } = await request.json();
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: "Invalid rows data" }, { status: 400 });
    }

    const blockedKeys = new Set([
      "master_hot_wallet_private_key",
      "hot_wallet_history",
    ]);
    const allowedKeys = new Set([
      "swap_fee_rate",
      "withdrawal_fee_rate",
      "cold_vault_address",
      "cold_balance_usdt",
    ]);
    if (rows.some((row) => !row || typeof row.key !== "string" || blockedKeys.has(row.key) || !allowedKeys.has(row.key))) {
      return NextResponse.json(
        { success: false, error: "This settings API does not allow the requested key." },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of rows) {
        if (typeof row.value !== "string" || row.key.length > 100 || row.value.length > 10000) {
          throw new Error("Invalid setting value");
        }
        await client.query(`
          INSERT INTO public.system_settings (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [row.key, row.value]);
      }
      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("settings/save API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
