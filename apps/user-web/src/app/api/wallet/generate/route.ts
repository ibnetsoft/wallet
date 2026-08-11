import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const mnemonic = process.env.WALLET_MASTER_MNEMONIC;
    if (!mnemonic) {
      return NextResponse.json({ error: "Server misconfiguration: no mnemonic" }, { status: 500 });
    }

    const client = await pool.connect();
    let address = "";
    let nextIndex = 0;

    try {
      await client.query("BEGIN");

      const existingWalletRes = await client.query(
        `SELECT address
         FROM public.user_wallets
         WHERE user_id = $1 AND chain_type = 'BSC'
         LIMIT 1`,
        [user_id]
      );

      if (existingWalletRes.rows[0]?.address) {
        await client.query("COMMIT");
        return NextResponse.json({
          success: true,
          address: existingWalletRes.rows[0].address,
          chain_type: "BSC",
          existing: true
        });
      }

      await client.query(
        `INSERT INTO public.system_settings (key, value)
         VALUES ('wallet_derivation_index', '0')
         ON CONFLICT (key) DO NOTHING`
      );

      const counterRes = await client.query(
        `SELECT value
         FROM public.system_settings
         WHERE key = 'wallet_derivation_index'
         FOR UPDATE`
      );

      nextIndex = Number(counterRes.rows[0]?.value ?? 0);

      const basePath = "m/44'/60'/0'/0";
      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, "", basePath);
      const childWallet = hdNode.deriveChild(nextIndex);
      address = childWallet.address;

      await client.query(
        `INSERT INTO public.user_wallets (user_id, address, derivation_index, chain_type)
         VALUES ($1, $2, $3, 'BSC')`,
        [user_id, address, nextIndex]
      );

      await client.query(
        `UPDATE public.system_settings
         SET value = $1
         WHERE key = 'wallet_derivation_index'`,
        [String(nextIndex + 1)]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      address,
      derivation_index: nextIndex,
      chain_type: "BSC"
    });
  } catch (error: unknown) {
    console.error("Wallet generation error:", error);
    return NextResponse.json(
      { error: `Internal Error: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
