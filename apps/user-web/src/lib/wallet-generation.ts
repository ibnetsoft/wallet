import { ethers } from "ethers";
import { Pool } from "pg";
import { TronWeb } from "tronweb";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export type GeneratedWallet = {
  address: string;
  chainType: "BSC" | "TRON";
  derivationIndex?: number;
  existing: boolean;
};

export type MemberWallets = {
  bsc: GeneratedWallet;
  tron: GeneratedWallet;
};

/**
 * Allocates one deterministic BSC deposit address for a member.
 * The counter row is locked so simultaneous registrations cannot receive
 * the same derivation index.
 */
export async function ensureBscWallet(userId: string): Promise<GeneratedWallet> {
  const mnemonic = process.env.WALLET_MASTER_MNEMONIC;
  if (!mnemonic) {
    throw new Error("Wallet service is unavailable");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT address FROM public.user_wallets
       WHERE user_id = $1 AND chain_type = 'BSC'
       LIMIT 1`,
      [userId]
    );
    if (existing.rows[0]?.address) {
      await client.query("COMMIT");
      return { address: existing.rows[0].address, chainType: "BSC", existing: true };
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
    const configuredIndex = Number(counter.rows[0]?.value ?? 0);
    const issuedWallets = await client.query(
      `SELECT COALESCE(MAX(derivation_index) + 1, 0) AS next_index
       FROM public.user_wallets
       WHERE chain_type = 'BSC'`
    );
    // Older manual issuances can exist without advancing the setting. Always
    // continue after the highest address already issued for this chain.
    const derivationIndex = Math.max(
      configuredIndex,
      Number(issuedWallets.rows[0]?.next_index ?? 0)
    );
    const wallet = ethers.HDNodeWallet.fromPhrase(
      mnemonic,
      "",
      "m/44'/60'/0'/0"
    ).deriveChild(derivationIndex);

    await client.query(
      `INSERT INTO public.user_wallets (user_id, address, derivation_index, chain_type)
       VALUES ($1, $2, $3, 'BSC')`,
      [userId, wallet.address, derivationIndex]
    );
    await client.query(
      `UPDATE public.system_settings SET value = $1 WHERE key = 'wallet_derivation_index'`,
      [String(derivationIndex + 1)]
    );
    await client.query("COMMIT");

    return {
      address: wallet.address,
      chainType: "BSC",
      derivationIndex,
      existing: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Allocates a TRON mainnet address for receiving official TRC20 USDT.
 * It deliberately uses the TRON BIP-44 coin type (195), not the BSC path.
 */
export async function ensureTronWallet(userId: string): Promise<GeneratedWallet> {
  const mnemonic = process.env.WALLET_MASTER_MNEMONIC;
  if (!mnemonic) {
    throw new Error("Wallet service is unavailable");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT address FROM public.user_wallets
       WHERE user_id = $1 AND chain_type = 'TRON'
       LIMIT 1`,
      [userId]
    );
    if (existing.rows[0]?.address) {
      await client.query("COMMIT");
      return { address: existing.rows[0].address, chainType: "TRON", existing: true };
    }

    await client.query(
      `INSERT INTO public.system_settings (key, value)
       VALUES ('tron_wallet_derivation_index', '0')
       ON CONFLICT (key) DO NOTHING`
    );
    const counter = await client.query(
      `SELECT value FROM public.system_settings
       WHERE key = 'tron_wallet_derivation_index'
       FOR UPDATE`
    );
    const configuredIndex = Number(counter.rows[0]?.value ?? 0);
    const issuedWallets = await client.query(
      `SELECT COALESCE(MAX(derivation_index) + 1, 0) AS next_index
       FROM public.user_wallets
       WHERE chain_type = 'TRON'`
    );
    const derivationIndex = Math.max(
      configuredIndex,
      Number(issuedWallets.rows[0]?.next_index ?? 0)
    );
    const account = TronWeb.fromMnemonic(
      mnemonic,
      `m/44'/195'/0'/0/${derivationIndex}`
    );

    await client.query(
      `INSERT INTO public.user_wallets (user_id, address, derivation_index, chain_type)
       VALUES ($1, $2, $3, 'TRON')`,
      [userId, account.address, derivationIndex]
    );
    await client.query(
      `UPDATE public.system_settings
       SET value = $1
       WHERE key = 'tron_wallet_derivation_index'`,
      [String(derivationIndex + 1)]
    );
    await client.query("COMMIT");

    return {
      address: account.address,
      chainType: "TRON",
      derivationIndex,
      existing: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureMemberWallets(userId: string): Promise<MemberWallets> {
  const [bsc, tron] = await Promise.all([
    ensureBscWallet(userId),
    ensureTronWallet(userId),
  ]);
  return { bsc, tron };
}
