import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  const mnemonic = process.env.WALLET_MASTER_MNEMONIC;
  if (!mnemonic) {
    return NextResponse.json({ success: false, error: "Wallet service is unavailable" }, { status: 503 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT address FROM public.user_wallets
       WHERE user_id = $1 AND chain_type = 'BSC'
       LIMIT 1`,
      [user.id]
    );
    if (existing.rows[0]?.address) {
      await client.query("COMMIT");
      return NextResponse.json({ success: true, address: existing.rows[0].address, chain_type: "BSC", existing: true });
    }

    await client.query(
      `INSERT INTO public.system_settings (key, value)
       VALUES ('wallet_derivation_index', '0')
       ON CONFLICT (key) DO NOTHING`
    );
    const counter = await client.query(
      `SELECT value FROM public.system_settings
       WHERE key = 'wallet_derivation_index'
       FOR UPDATE`
    );
    const index = Number(counter.rows[0]?.value ?? 0);
    const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, "", "m/44'/60'/0'/0").deriveChild(index);

    await client.query(
      `INSERT INTO public.user_wallets (user_id, address, derivation_index, chain_type)
       VALUES ($1, $2, $3, 'BSC')`,
      [user.id, wallet.address, index]
    );
    await client.query(
      `UPDATE public.system_settings SET value = $1 WHERE key = 'wallet_derivation_index'`,
      [String(index + 1)]
    );
    await client.query("COMMIT");
    return NextResponse.json({ success: true, address: wallet.address, derivation_index: index, chain_type: "BSC" });
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    console.error("Wallet generation error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate wallet" }, { status: 500 });
  } finally {
    client.release();
  }
}
