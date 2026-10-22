import { Pool } from "pg";
import { setTimeout as delay } from "node:timers/promises";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Public TRON Grid endpoint: no secret is embedded. Operator-entered URLs are
// attempted first, then this free endpoint is the final fallback.
const DEFAULT_TRON_API_URL = "https://api.trongrid.io";
const TRC20_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

type TronTransfer = {
  transaction_id?: string;
  from?: string;
  to?: string;
  value?: string;
  block_timestamp?: number;
  block_number?: number;
  event_index?: number;
  token_info?: { address?: string; decimals?: number; symbol?: string };
};

export type Trc20SyncResult = { checkedWallets: number; credited: number; duplicates: number; failedWallets: number };

function configuredUrls(value: unknown) {
  const urls = String(value ?? "")
    .split(/[\n,]/)
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter((url) => /^https:\/\/[^\s/]+/i.test(url));
  return [...new Set([...urls, DEFAULT_TRON_API_URL])];
}

async function loadTransfers(address: string, apiUrls: string[]) {
  let lastError: unknown;
  for (const baseUrl of apiUrls) {
    try {
      const url = new URL(`/v1/accounts/${address}/transactions/trc20`, baseUrl);
      url.searchParams.set("only_to", "true");
      url.searchParams.set("only_confirmed", "true");
      url.searchParams.set("contract_address", TRC20_USDT_CONTRACT);
      url.searchParams.set("limit", "200");
      // Anonymous TronGrid traffic shares an IP quota. Avoid sending the next
      // wallet request immediately after the previous one completes.
      await delay(1_100);
      const response = await fetch(url, {
        headers: { Accept: "application/json", ...(process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : {}) },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`TRON endpoint ${url.hostname} returned ${response.status}`);
      const payload = await response.json() as { data?: TronTransfer[] };
      if (!Array.isArray(payload.data)) throw new Error(`TRON endpoint ${url.hostname} returned an invalid transfer response`);
      return payload.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All TRON endpoints failed");
}

export async function syncTrc20UsdtDeposits(): Promise<Trc20SyncResult> {
  const client = await pool.connect();
  const result: Trc20SyncResult = { checkedWallets: 0, credited: 0, duplicates: 0, failedWallets: 0 };
  try {
    const walletsResult = await client.query<{ user_id: string; address: string }>("SELECT user_id, address FROM public.user_wallets WHERE chain_type = 'TRON'");
    const settingsResult = await client.query<{ value: string }>("SELECT value FROM public.system_settings WHERE key = 'trc20_rpc_urls' LIMIT 1");
    const assetResult = await client.query<{ id: number }>("SELECT id FROM public.assets WHERE symbol = 'USDT' AND is_active = TRUE LIMIT 1");
    const activationResult = await client.query<{ value: string }>("SELECT value FROM public.system_settings WHERE key = 'activation_deposit_usdt' LIMIT 1");
    const assetId = assetResult.rows[0]?.id;
    if (!assetId) throw new Error("USDT asset is not configured");
    const minimumDeposit = Number(activationResult.rows[0]?.value ?? 100);
    const apiUrls = configuredUrls(settingsResult.rows[0]?.value);

    for (const wallet of walletsResult.rows) {
      result.checkedWallets += 1;
      let transfers: TronTransfer[];
      try { transfers = await loadTransfers(wallet.address, apiUrls); } catch (error) {
        console.error("TRC20 wallet lookup failed", error instanceof Error ? error.message : "Unknown provider error");
        result.failedWallets += 1; continue;
      }
      for (const transfer of transfers) {
        const contract = transfer.token_info?.address;
        const txHash = transfer.transaction_id;
        const raw = transfer.value;
        if (!txHash || !raw || contract !== TRC20_USDT_CONTRACT || !transfer.from || transfer.to !== wallet.address) continue;
        const eventIndex = Number(transfer.event_index ?? 0);
        const amount = Number(raw) / 1_000_000;
        if (!Number.isFinite(amount) || amount <= 0) continue;
        await client.query("BEGIN");
        try {
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO public.trc20_usdt_deposits (
              contract_address, tx_hash, event_index, block_number, block_timestamp,
              from_address, to_address, raw_amount, amount, asset_id, user_id, status
            ) VALUES ($1,$2,$3,$4,to_timestamp($5 / 1000.0),$6,$7,$8,$9,$10,$11,'CREDITED')
            ON CONFLICT (contract_address, tx_hash, event_index) DO NOTHING RETURNING id`,
            [contract, txHash, eventIndex, transfer.block_number ?? null, transfer.block_timestamp ?? Date.now(), transfer.from, transfer.to, raw, amount, assetId, wallet.user_id]
          );
          if (!inserted.rows[0]) { await client.query("COMMIT"); result.duplicates += 1; continue; }
          await client.query(
            `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
             VALUES ($1,$2,$3,0,NOW())
             ON CONFLICT (user_id, asset_id) DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance, updated_at = NOW()`,
            [wallet.user_id, assetId, amount]
          );
          await client.query("UPDATE public.users SET status = 'ACTIVE' WHERE id = $1 AND status = 'PENDING' AND $2::numeric >= $3::numeric", [wallet.user_id, amount, minimumDeposit]);
          const ledger = await client.query<{ id: string }>(
            `INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
             VALUES ($1,$2,$3,'DEPOSIT','COMPLETED',$4,$5::jsonb) RETURNING id`,
            [wallet.user_id, assetId, amount, `TRON-USDT:${txHash}:${eventIndex}`, JSON.stringify({ source: "on_chain", chain: "TRON", network: "TRC20", chain_tx_hash: txHash, event_index: eventIndex, contract_address: contract, from_address: transfer.from, to_address: transfer.to })]
          );
          await client.query("UPDATE public.trc20_usdt_deposits SET credited_ledger_entry_id = $2, credited_at = NOW() WHERE id = $1", [inserted.rows[0].id, ledger.rows[0].id]);
          await client.query("COMMIT"); result.credited += 1;
        } catch (error) { await client.query("ROLLBACK"); throw error; }
      }
    }
    return result;
  } finally { client.release(); }
}
