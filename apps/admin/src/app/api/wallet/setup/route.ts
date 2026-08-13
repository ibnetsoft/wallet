import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";
import { resolveMasterHotWallet } from "@/lib/master-hot-wallet";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Keep this legacy endpoint from setting an arbitrary public address. The
// settings save endpoint derives the address from the master signing key.
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const masterHotWallet = await resolveMasterHotWallet(client);
    if (!masterHotWallet.address || masterHotWallet.issues.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: masterHotWallet.issues.join(" ") || "Master hot wallet is not configured.",
        },
        { status: 503 }
      );
    }

    await client.query(
      `INSERT INTO public.system_settings (key, value)
       VALUES ('hot_balance_usdt', '0')
       ON CONFLICT (key) DO NOTHING`
    );

    return NextResponse.json({ success: true, address: masterHotWallet.address });
  } catch (err: unknown) {
    console.error("wallet/setup route error:", err);
    return NextResponse.json(
      { success: false, error: "Unable to initialize the master hot wallet." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
