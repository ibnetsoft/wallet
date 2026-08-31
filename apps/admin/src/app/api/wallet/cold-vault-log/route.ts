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
const MAX_USDT_TRANSFER_RATIO = 0.85;

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

    if (asset === "USDT") {
      const hotBalanceResult = await client.query<{ value: string }>(
        `SELECT value
         FROM public.system_settings
         WHERE key = 'hot_balance_usdt'
         LIMIT 1`
      );
      const hotBalanceUsdt = Number(hotBalanceResult.rows[0]?.value ?? NaN);

      if (!Number.isFinite(hotBalanceUsdt) || hotBalanceUsdt <= 0) {
        return NextResponse.json(
          { success: false, error: "Unable to verify the current hot wallet USDT balance." },
          { status: 503 }
        );
      }

      const maxTransferableUsdt = Number((hotBalanceUsdt * MAX_USDT_TRANSFER_RATIO).toFixed(6));
      if (amount > maxTransferableUsdt) {
        return NextResponse.json(
          {
            success: false,
            error: `A single cold vault transfer cannot exceed 85% of the current hot wallet USDT balance (${maxTransferableUsdt} USDT).`,
          },
          { status: 400 }
        );
      }
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
