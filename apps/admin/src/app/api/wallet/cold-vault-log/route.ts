import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";
import { resolveMasterHotWallet } from "@/lib/master-hot-wallet";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SUPPORTED_ASSETS = new Set(["USDT", "BNB"]);

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { amount?: unknown; asset?: unknown; coldVaultAddress?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const asset = typeof body.asset === "string" ? body.asset.trim().toUpperCase() : "";
  const coldVaultAddress = typeof body.coldVaultAddress === "string" ? body.coldVaultAddress.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ success: false, error: "A positive transfer amount is required." }, { status: 400 });
  }
  if (!SUPPORTED_ASSETS.has(asset) || !coldVaultAddress) {
    return NextResponse.json({ success: false, error: "A supported asset and cold vault address are required." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const masterHotWallet = await resolveMasterHotWallet(client);
    if (!masterHotWallet.address) {
      return NextResponse.json({ success: false, error: "Master hot wallet is not configured." }, { status: 503 });
    }

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO public.vault_transfers
        (from_label, to_label, amount, asset, cold_vault_address, note)
       VALUES ($1, 'Offline cold vault', $2, $3, $4, $5)`,
      [
        `Master hot wallet (${masterHotWallet.address.slice(0, 8)}...)`,
        amount,
        asset,
        coldVaultAddress,
        `Manual transfer record by ${admin.email}`,
      ]
    );
    await client.query(
      `INSERT INTO public.system_settings (key, value)
       VALUES ('cold_vault_address', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [coldVaultAddress]
    );
    if (asset === "USDT") {
      await client.query(
        `INSERT INTO public.system_settings (key, value, description)
         VALUES ('cold_balance_usdt', $1, 'Cumulative logged cold vault USDT amount')
         ON CONFLICT (key) DO UPDATE
           SET value = (
             COALESCE(NULLIF(BTRIM(public.system_settings.value), ''), '0')::numeric
             + EXCLUDED.value::numeric
           )::text`,
        [amount.toString()]
      );
    }
    await client.query("COMMIT");

    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("cold-vault-log route error:", error);
    return NextResponse.json({ success: false, error: "Unable to save the cold vault transfer record." }, { status: 500 });
  } finally {
    client.release();
  }
}
