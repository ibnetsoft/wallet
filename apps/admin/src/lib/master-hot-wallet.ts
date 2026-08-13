import type { PoolClient } from "pg";
import { getAddress, isAddress, Wallet } from "ethers";

// This is the current company master hot wallet. It is only a public fallback
// for display until the same address is saved in system_settings.
export const DEFAULT_MASTER_HOT_WALLET_ADDRESS = "0x781dcdb491d5d8596c9F8aB5270f6C9FBAe3B9A4";

export interface MasterHotWallet {
  address: string | null;
  signer: Wallet | null;
  issues: string[];
  isLinked: boolean;
}

function normalizeAddress(value: string | undefined) {
  const address = value?.trim();
  return address && isAddress(address) ? getAddress(address) : null;
}

export function getWalletAddressFromPrivateKey(privateKey: string) {
  return new Wallet(privateKey.trim()).address;
}

async function saveInitialMasterAddress(client: PoolClient, address: string) {
  await client.query(
    `INSERT INTO public.system_settings (key, value, description)
     VALUES ('master_hot_wallet', $1, 'Master hot wallet address')
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value
     WHERE NULLIF(BTRIM(public.system_settings.value), '') IS NULL`,
    [address]
  );
}

// The public master address and signing key are resolved together. A key for a
// different account never becomes a BNB sender, even if it is configured.
export async function resolveMasterHotWallet(client: PoolClient): Promise<MasterHotWallet> {
  const issues: string[] = [];
  const result = await client.query<{ key: string; value: string }>(
    `SELECT key, value
     FROM public.system_settings
     WHERE key IN ('master_hot_wallet', 'master_hot_wallet_private_key')`
  );
  const settings = new Map(result.rows.map((row) => [row.key, row.value]));
  const savedAddress = settings.get("master_hot_wallet")?.trim() || "";
  const configuredAddress = savedAddress ? normalizeAddress(savedAddress) : null;

  if (savedAddress && !configuredAddress) {
    issues.push("The configured master hot wallet address is invalid.");
  }

  const privateKey = (
    settings.get("master_hot_wallet_private_key") || process.env.MASTER_HOT_WALLET_PRIVATE_KEY || ""
  ).trim();

  if (!privateKey) {
    issues.push("A valid master hot wallet private key is required for BNB transfers.");
    const address = configuredAddress ?? getAddress(DEFAULT_MASTER_HOT_WALLET_ADDRESS);
    if (!configuredAddress) {
      await saveInitialMasterAddress(client, address);
    }
    return {
      address,
      signer: null,
      issues,
      isLinked: false,
    };
  }

  let signer: Wallet;
  try {
    signer = new Wallet(privateKey);
  } catch {
    issues.push("The configured master hot wallet private key is invalid.");
    return {
      address: configuredAddress ?? getAddress(DEFAULT_MASTER_HOT_WALLET_ADDRESS),
      signer: null,
      issues,
      isLinked: false,
    };
  }

  // When a key exists without a saved public address, it is still the source
  // of truth. This makes a newly generated master wallet usable immediately.
  const address = configuredAddress ?? signer.address;
  if (!configuredAddress) {
    await saveInitialMasterAddress(client, signer.address);
  }

  if (signer.address.toLowerCase() !== address.toLowerCase()) {
    issues.push("The master hot wallet address does not match its signing key. BNB transfer is blocked.");
    return { address, signer: null, issues, isLinked: false };
  }

  return { address, signer, issues, isLinked: true };
}
