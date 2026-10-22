import { NextResponse } from "next/server";
import { Pool } from "pg";
import { TronWeb, utils } from "tronweb";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function getAddress(privateKey: string) {
  const normalized = privateKey.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) return null;
  return TronWeb.address.fromPrivateKey(normalized) || null;
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (admin?.role !== 'SUPER_ADMIN') return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  let privateKey = "";
  let address = "";
  if (action === "GENERATE") {
    const account = utils.accounts.generateAccount();
    privateKey = account.privateKey;
    address = account.address.base58;
  } else if (action === "IMPORT") {
    privateKey = String(body?.privateKey ?? "").trim().replace(/^0x/i, "");
    address = getAddress(privateKey) || "";
    if (!address) return NextResponse.json({ success: false, error: "Invalid TRON private key." }, { status: 400 });
  } else {
    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of [["tron_master_hot_wallet", address], ["tron_master_hot_wallet_private_key", privateKey]]) {
      await client.query(
        `INSERT INTO public.system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    await client.query("COMMIT");
    // The key is deliberately not returned. It is never exposed by read APIs.
    return NextResponse.json({ success: true, address });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("TRON hot wallet setup error:", error);
    return NextResponse.json({ success: false, error: "Unable to save TRON hot wallet." }, { status: 500 });
  } finally {
    client.release();
  }
}
