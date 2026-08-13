import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";
import { getWalletAddressFromPrivateKey } from "@/lib/master-hot-wallet";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = await request.json();
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: "Invalid rows data" }, { status: 400 });
    }

    const normalizedRows = rows.map((row) => ({
      key: typeof row?.key === "string" ? row.key.trim() : "",
      value: typeof row?.value === "string" ? row.value.trim() : "",
    }));
    if (normalizedRows.some((row) => !row.key)) {
      return NextResponse.json({ success: false, error: "A setting key is required" }, { status: 400 });
    }

    const masterKeyRow = normalizedRows.find((row) => row.key === "master_hot_wallet_private_key");
    const hasMasterAddressRow = normalizedRows.some((row) => row.key === "master_hot_wallet");
    const changesMasterWallet = Boolean(masterKeyRow?.value) || hasMasterAddressRow;
    let configuredMasterKey = masterKeyRow?.value || process.env.MASTER_HOT_WALLET_PRIVATE_KEY?.trim() || "";

    if (changesMasterWallet && !configuredMasterKey) {
      const existingKey = await pool.query<{ value: string }>(
        `SELECT value
         FROM public.system_settings
         WHERE key = 'master_hot_wallet_private_key'
         LIMIT 1`
      );
      configuredMasterKey = existingKey.rows[0]?.value?.trim() || "";
    }
    if (changesMasterWallet && configuredMasterKey) {
      let canonicalMasterAddress: string;
      try {
        canonicalMasterAddress = getWalletAddressFromPrivateKey(configuredMasterKey);
      } catch {
        return NextResponse.json(
          { success: false, error: "The master hot wallet private key is invalid" },
          { status: 400 }
        );
      }

      // The public address must always follow the key used by the master hot
      // wallet. This also links a newly generated master wallet to BNB sender.
      const addressIndex = normalizedRows.findIndex((row) => row.key === "master_hot_wallet");
      const addressRow = { key: "master_hot_wallet", value: canonicalMasterAddress };
      if (addressIndex >= 0) {
        normalizedRows[addressIndex] = addressRow;
      } else {
        normalizedRows.push(addressRow);
      }
    } else if (changesMasterWallet) {
      return NextResponse.json(
        {
          success: false,
          error: "마스터 핫 월렛 주소는 일치하는 개인키와 함께 저장해야 합니다.",
        },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of normalizedRows) {
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
