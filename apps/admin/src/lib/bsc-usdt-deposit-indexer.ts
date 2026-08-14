import { randomUUID } from "node:crypto";
import {
  Interface,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  id,
  isAddress,
  zeroPadValue,
} from "ethers";
import { Pool, type PoolClient } from "pg";
import { getBscDepositRpcUrl, getBscUsdtContract } from "@/lib/chain-config";

const BSC_MAINNET_CHAIN_ID = 56;
const TRANSFER_TOPIC = id("Transfer(address,address,uint256)");
const TRANSFER_INTERFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

type WalletOwner = {
  userId: string;
  createdAtMs: number;
};

type UsdtAsset = {
  id: number;
  decimals: number;
};

type ActivationSettings = {
  minimumDeposit: string;
};

type CachedBlock = {
  hash: string;
  timestampMs: number;
};

type SyncSettings = {
  confirmations: number;
  blockRange: number;
  maxRangesPerRun: number;
  recipientBatchSize: number;
  rpcMinimumIntervalMs: number;
  liveLookbackBlocks: number;
  startBlock: number | null;
};

type RpcRequestRunner = <T>(request: () => Promise<T>) => Promise<T>;

export type BscUsdtDepositSyncResult = {
  status: "completed" | "locked" | "no_wallets" | "waiting_confirmations";
  chainId: number;
  safeHead: number | null;
  fromBlock: number | null;
  toBlock: number | null;
  rangesScanned: number;
  eventsFound: number;
  credited: number;
  legacyCreditsRecorded: number;
  duplicatesSkipped: number;
  beforeWalletCreationSkipped: number;
  liveRangesScanned: number;
};

export class DepositSyncError extends Error {
  constructor(message: string, public readonly statusCode = 500) {
    super(message);
    this.name = "DepositSyncError";
  }
}

function readIntegerSetting(name: string, fallback: number, minimum: number, maximum: number) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new DepositSyncError(
      name + " must be an integer between " + minimum + " and " + maximum + ".",
      503
    );
  }

  return parsed;
}

function readOptionalStartBlock() {
  const rawValue = process.env.BSC_DEPOSIT_START_BLOCK?.trim();
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new DepositSyncError("BSC_DEPOSIT_START_BLOCK must be a non-negative block number.", 503);
  }

  return parsed;
}

function getSyncSettings(): SyncSettings {
  return {
    confirmations: readIntegerSetting("BSC_DEPOSIT_CONFIRMATIONS", 12, 1, 500),
    // The configured QuickNode Discover endpoint accepts eth_getLogs windows
    // of at most five blocks. More small ranges per run keeps the scan ahead
    // of BSC's block rate without exceeding that provider limit.
    blockRange: readIntegerSetting("BSC_DEPOSIT_SCAN_BLOCK_RANGE", 5, 1, 2_000),
    maxRangesPerRun: readIntegerSetting("BSC_DEPOSIT_MAX_RANGES_PER_RUN", 50, 1, 100),
    recipientBatchSize: readIntegerSetting("BSC_DEPOSIT_RECIPIENT_BATCH_SIZE", 50, 1, 100),
    rpcMinimumIntervalMs: readIntegerSetting(
      "BSC_DEPOSIT_RPC_MIN_INTERVAL_MS",
      150,
      50,
      5_000
    ),
    // While a historical backfill is catching up, retain enough recent blocks
    // to credit new deposits without waiting for the old cursor to reach head.
    liveLookbackBlocks: readIntegerSetting(
      "BSC_DEPOSIT_LIVE_LOOKBACK_BLOCKS",
      300,
      20,
      5_000
    ),
    startBlock: readOptionalStartBlock(),
  };
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function isRpcRateLimitError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const message = "message" in error && typeof error.message === "string"
    ? error.message
    : "";
  const nestedError = "error" in error && typeof error.error === "object" && error.error !== null
    ? error.error as { code?: unknown; message?: unknown }
    : null;

  return nestedError?.code === -32007
    || /request limit|rate limit|too many requests/i.test(message)
    || (typeof nestedError?.message === "string" && /request limit|rate limit|too many requests/i.test(nestedError.message));
}

function createRpcRequestRunner(minimumIntervalMs: number): RpcRequestRunner {
  let nextRequestAt = 0;

  return async <T>(request: () => Promise<T>) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const waitMs = Math.max(0, nextRequestAt - Date.now());
      if (waitMs > 0) {
        await sleep(waitMs);
      }

      nextRequestAt = Date.now() + minimumIntervalMs;
      try {
        return await request();
      } catch (error) {
        if (!isRpcRateLimitError(error) || attempt === 2) {
          throw error;
        }

        // Back off before retrying so a shared QuickNode endpoint can recover.
        nextRequestAt = Math.max(
          nextRequestAt,
          Date.now() + minimumIntervalMs * (attempt + 2)
        );
      }
    }

    throw new DepositSyncError("BSC RPC request retries were exhausted.", 503);
  };
}

function timestampToMilliseconds(value: unknown) {
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyResult(
  status: BscUsdtDepositSyncResult["status"],
  chainId: number,
  safeHead: number | null
): BscUsdtDepositSyncResult {
  return {
    status,
    chainId,
    safeHead,
    fromBlock: null,
    toBlock: null,
    rangesScanned: 0,
    eventsFound: 0,
    credited: 0,
    legacyCreditsRecorded: 0,
    duplicatesSkipped: 0,
    beforeWalletCreationSkipped: 0,
    liveRangesScanned: 0,
  };
}

function cursorKey(chainId: number, contractAddress: string) {
  return "bsc-usdt:" + chainId + ":" + contractAddress.toLowerCase();
}

function liveCursorKey(chainId: number, contractAddress: string) {
  return cursorKey(chainId, contractAddress) + ":live";
}

function chainEventId(chainId: number, contractAddress: string, txHash: string, logIndex: number) {
  return [
    "bsc-usdt",
    chainId,
    contractAddress.toLowerCase(),
    txHash.toLowerCase(),
    logIndex,
  ].join(":");
}

function ledgerTransactionHash(txHash: string, logIndex: number) {
  // ledger_entries.tx_hash is globally unique. A token transaction can contain
  // multiple Transfer logs, so preserve the canonical chain hash in details.
  return "BSC-USDT:" + txHash.toLowerCase() + ":" + logIndex;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function loadWalletOwners(client: PoolClient) {
  const result = await client.query<{
    user_id: string;
    address: string;
    created_at: Date | string;
  }>(
    `SELECT user_id, address, created_at
     FROM public.user_wallets
     WHERE chain_type = 'BSC'`
  );

  const owners = new Map<string, WalletOwner>();
  for (const row of result.rows) {
    if (!isAddress(row.address)) {
      console.warn("Ignoring invalid BSC user wallet address during deposit sync.");
      continue;
    }

    owners.set(getAddress(row.address).toLowerCase(), {
      userId: row.user_id,
      createdAtMs: timestampToMilliseconds(row.created_at),
    });
  }

  return owners;
}

async function loadUsdtAsset(client: PoolClient, contractAddress: string): Promise<UsdtAsset> {
  const result = await client.query<{
    id: number;
    decimals: number;
  }>(
    `SELECT id, decimals
     FROM public.assets
     WHERE symbol = 'USDT'
       AND is_active = TRUE
       AND lower(contract_address) = lower($1)
     LIMIT 1`,
    [contractAddress]
  );

  const asset = result.rows[0];
  if (!asset) {
    throw new DepositSyncError(
      "The active USDT asset does not match the configured BSC USDT contract address.",
      503
    );
  }

  return {
    id: Number(asset.id),
    decimals: Number(asset.decimals),
  };
}

async function loadActivationSettings(client: PoolClient): Promise<ActivationSettings> {
  const result = await client.query<{ value: unknown }>(
    `SELECT value
     FROM public.system_settings
     WHERE key = 'activation_deposit_usdt'
     LIMIT 1`
  );

  const rawValue = typeof result.rows[0]?.value === "string"
    ? result.rows[0].value
    : "100";
  const minimumDeposit = Number(rawValue);

  if (!Number.isFinite(minimumDeposit) || minimumDeposit < 0) {
    throw new DepositSyncError(
      "The activation_deposit_usdt system setting must be a non-negative number.",
      503
    );
  }

  return { minimumDeposit: String(minimumDeposit) };
}

async function loadCursor(client: PoolClient, key: string) {
  const result = await client.query<{ last_scanned_block: string | number }>(
    `SELECT last_scanned_block
     FROM public.chain_sync_cursors
     WHERE cursor_key = $1`,
    [key]
  );

  return result.rows[0] ? Number(result.rows[0].last_scanned_block) : null;
}

async function saveCursor(client: PoolClient, key: string, lastScannedBlock: number) {
  await client.query(
    `INSERT INTO public.chain_sync_cursors (cursor_key, last_scanned_block, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (cursor_key)
     DO UPDATE SET last_scanned_block = EXCLUDED.last_scanned_block,
                   updated_at = NOW()`,
    [key, lastScannedBlock]
  );
}

async function acquireSyncLock(client: PoolClient, key: string, token: string) {
  const result = await client.query<{ lock_token: string }>(
    `INSERT INTO public.bsc_usdt_deposit_sync_locks (
       cursor_key, lock_token, locked_until, updated_at
     )
     VALUES ($1, $2, NOW() + INTERVAL '3 minutes', NOW())
     ON CONFLICT (cursor_key)
     DO UPDATE SET lock_token = EXCLUDED.lock_token,
                   locked_until = EXCLUDED.locked_until,
                   updated_at = NOW()
     WHERE public.bsc_usdt_deposit_sync_locks.locked_until < NOW()
     RETURNING lock_token`,
    [key, token]
  );

  return result.rows[0]?.lock_token === token;
}

async function releaseSyncLock(client: PoolClient, key: string, token: string) {
  await client.query(
    `DELETE FROM public.bsc_usdt_deposit_sync_locks
     WHERE cursor_key = $1
       AND lock_token = $2`,
    [key, token]
  );
}

async function findBlockAtOrBeforeTimestamp(
  provider: JsonRpcProvider,
  runRpcRequest: RpcRequestRunner,
  upperBound: number,
  targetTimestampMs: number
) {
  let low = 0;
  let high = upperBound;
  let result = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const block = await runRpcRequest(() => provider.getBlock(middle));
    if (!block) {
      throw new DepositSyncError("Unable to read a BSC block while selecting the initial deposit cursor.", 503);
    }

    const blockTimestampMs = Number(block.timestamp) * 1_000;
    if (blockTimestampMs <= targetTimestampMs) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

async function determineInitialStartBlock(
  provider: JsonRpcProvider,
  runRpcRequest: RpcRequestRunner,
  safeHead: number,
  walletOwners: Map<string, WalletOwner>,
  configuredStartBlock: number | null
) {
  if (configuredStartBlock !== null) {
    return Math.min(configuredStartBlock, safeHead);
  }

  const knownWalletTimes = Array.from(walletOwners.values())
    .map((wallet) => wallet.createdAtMs)
    .filter((createdAtMs) => createdAtMs > 0);

  if (knownWalletTimes.length === 0) {
    // A missing timestamp must not cause the initial run to scan the full BSC
    // history. Operators can set BSC_DEPOSIT_START_BLOCK for a deliberate backfill.
    return Math.max(0, safeHead - 10_000);
  }

  const earliestWalletCreation = Math.min(...knownWalletTimes);
  // Start a few minutes before the address was saved so a deposit in the same
  // registration window cannot be skipped because of timestamp precision.
  const bufferedTimestamp = Math.max(0, earliestWalletCreation - 5 * 60 * 1_000);
  return findBlockAtOrBeforeTimestamp(provider, runRpcRequest, safeHead, bufferedTimestamp);
}

type TransferLog = Awaited<ReturnType<JsonRpcProvider["getLogs"]>>[number];

async function fetchTransferLogs(
  provider: JsonRpcProvider,
  runRpcRequest: RpcRequestRunner,
  contractAddress: string,
  recipientAddresses: string[],
  fromBlock: number,
  toBlock: number,
  recipientBatchSize: number
) {
  const topicBatches = chunks(
    recipientAddresses.map((address) => zeroPadValue(address, 32)),
    recipientBatchSize
  );
  const uniqueLogs = new Map<string, TransferLog>();

  for (const recipientTopics of topicBatches) {
    const logs = await runRpcRequest(() => provider.getLogs({
      address: contractAddress,
      fromBlock,
      toBlock,
      topics: [TRANSFER_TOPIC, null, recipientTopics],
    }));

    for (const log of logs) {
      uniqueLogs.set(log.transactionHash.toLowerCase() + ":" + log.index, log);
    }
  }

  return Array.from(uniqueLogs.values()).sort((left, right) => (
    left.blockNumber - right.blockNumber || left.index - right.index
  ));
}

async function resolveBlock(
  provider: JsonRpcProvider,
  runRpcRequest: RpcRequestRunner,
  blockCache: Map<number, Promise<CachedBlock>>,
  blockNumber: number,
  expectedHash: string
) {
  let pendingBlock = blockCache.get(blockNumber);
  if (!pendingBlock) {
    pendingBlock = runRpcRequest(() => provider.getBlock(blockNumber)).then((block) => {
      if (!block?.hash) {
        throw new DepositSyncError("Unable to read a confirmed BSC block.", 503);
      }

      return {
        hash: block.hash,
        timestampMs: Number(block.timestamp) * 1_000,
      };
    });
    blockCache.set(blockNumber, pendingBlock);
  }

  const block = await pendingBlock;
  if (block.hash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new DepositSyncError(
      "BSC reorganized while an incoming deposit was being indexed. The sync will retry from the same block.",
      503
    );
  }

  return block;
}

type CreditOutcome = "credited" | "legacy" | "duplicate" | "before_wallet_creation" | "ignored";

async function creditTransferLog({
  client,
  provider,
  runRpcRequest,
  blockCache,
  log,
  walletOwners,
  asset,
  activationSettings,
  chainId,
  contractAddress,
}: {
  client: PoolClient;
  provider: JsonRpcProvider;
  runRpcRequest: RpcRequestRunner;
  blockCache: Map<number, Promise<CachedBlock>>;
  log: TransferLog;
  walletOwners: Map<string, WalletOwner>;
  asset: UsdtAsset;
  activationSettings: ActivationSettings;
  chainId: number;
  contractAddress: string;
}): Promise<CreditOutcome> {
  let parsedLog;
  try {
    parsedLog = TRANSFER_INTERFACE.parseLog({
      topics: log.topics,
      data: log.data,
    });
  } catch {
    return "ignored";
  }

  if (!parsedLog) {
    return "ignored";
  }

  const fromAddress = getAddress(String(parsedLog.args.from));
  const toAddress = getAddress(String(parsedLog.args.to));
  const owner = walletOwners.get(toAddress.toLowerCase());
  if (!owner) {
    return "ignored";
  }

  const block = await resolveBlock(
    provider,
    runRpcRequest,
    blockCache,
    log.blockNumber,
    log.blockHash
  );
  if (owner.createdAtMs > 0 && block.timestampMs < owner.createdAtMs) {
    return "before_wallet_creation";
  }

  const rawAmount = parsedLog.args.value as bigint;
  if (rawAmount <= BigInt(0)) {
    return "ignored";
  }

  const txHash = log.transactionHash.toLowerCase();
  const logIndex = Number(log.index);
  const eventId = chainEventId(chainId, contractAddress, txHash, logIndex);
  const amount = formatUnits(rawAmount, asset.decimals);
  const eventValues = [
    chainId,
    contractAddress.toLowerCase(),
    txHash,
    logIndex,
    log.blockNumber,
    block.hash,
    new Date(block.timestampMs).toISOString(),
    fromAddress,
    toAddress,
    rawAmount.toString(),
    amount,
    asset.id,
    owner.userId,
  ];

  await client.query("BEGIN");
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [eventId]);

    const knownEvent = await client.query(
      `SELECT id
       FROM public.bsc_usdt_deposits
       WHERE chain_id = $1
         AND contract_address = $2
         AND tx_hash = $3
         AND log_index = $4
       LIMIT 1`,
      eventValues.slice(0, 4)
    );
    if (knownEvent.rows[0]) {
      await client.query("COMMIT");
      return "duplicate";
    }

    // Older rpc-watcher releases stored the canonical transaction hash directly
    // in the ledger. Import that credit into the durable event table instead of
    // adding the amount a second time.
    const legacyLedger = await client.query<{ id: string }>(
      `SELECT id
       FROM public.ledger_entries
       WHERE tx_type = 'DEPOSIT'
         AND (
           details ->> 'chain_event_id' = $1
           OR (
             tx_hash = $2
             AND details ->> 'source' = 'on_chain'
             AND user_id = $3
             AND amount = $4::numeric
             AND lower(COALESCE(details ->> 'to_address', '')) = $5
             AND (
               SELECT COUNT(*)
               FROM public.ledger_entries AS same_tx
               WHERE same_tx.tx_type = 'DEPOSIT'
                 AND same_tx.tx_hash = $2
                 AND same_tx.details ->> 'source' = 'on_chain'
             ) = 1
           )
         )
       LIMIT 1`,
      [eventId, txHash, owner.userId, amount, toAddress.toLowerCase()]
    );
    if (legacyLedger.rows[0]) {
      await client.query(
        `INSERT INTO public.bsc_usdt_deposits (
           chain_id, contract_address, tx_hash, log_index, block_number, block_hash,
           block_timestamp, from_address, to_address, raw_amount, amount, asset_id,
           user_id, status, credited_ledger_entry_id, credited_at
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
           $13, 'LEGACY_CREDITED', $14, NOW()
         )
         ON CONFLICT (chain_id, contract_address, tx_hash, log_index) DO NOTHING`,
        [...eventValues, legacyLedger.rows[0].id]
      );
      await client.query("COMMIT");
      return "legacy";
    }

    const insertedEvent = await client.query<{ id: string }>(
      `INSERT INTO public.bsc_usdt_deposits (
         chain_id, contract_address, tx_hash, log_index, block_number, block_hash,
         block_timestamp, from_address, to_address, raw_amount, amount, asset_id,
         user_id, status
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         $13, 'CREDITED'
       )
       ON CONFLICT (chain_id, contract_address, tx_hash, log_index) DO NOTHING
       RETURNING id`,
      eventValues
    );
    if (!insertedEvent.rows[0]) {
      await client.query("COMMIT");
      return "duplicate";
    }

    await client.query(
      `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
       VALUES ($1, $2, $3, 0, NOW())
       ON CONFLICT (user_id, asset_id)
       DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
                     updated_at = NOW()`,
      [owner.userId, asset.id, amount]
    );

    // Keep the existing on-chain-deposit rule: a qualifying USDT deposit
    // activates the account, which lets the database trigger assign the 369
    // referral and sponsor placement exactly once.
    await client.query(
      `UPDATE public.users
       SET status = 'ACTIVE'
       WHERE id = $1
         AND status = 'PENDING'
         AND $2::numeric >= $3::numeric`,
      [owner.userId, amount, activationSettings.minimumDeposit]
    );

    const ledgerDetails = JSON.stringify({
      source: "on_chain",
      chain: "BSC",
      chain_id: chainId,
      contract_address: contractAddress,
      chain_event_id: eventId,
      chain_tx_hash: txHash,
      log_index: logIndex,
      block_number: log.blockNumber,
      block_hash: block.hash,
      from_address: fromAddress,
      to_address: toAddress,
      description: "BSC on-chain USDT deposit",
    });
    const ledger = await client.query<{ id: string }>(
      `INSERT INTO public.ledger_entries (
         user_id, asset_id, amount, tx_type, status, tx_hash, details
       )
       VALUES ($1, $2, $3, 'DEPOSIT', 'COMPLETED', $4, $5::jsonb)
       RETURNING id`,
      [owner.userId, asset.id, amount, ledgerTransactionHash(txHash, logIndex), ledgerDetails]
    );

    await client.query(
      `UPDATE public.bsc_usdt_deposits
       SET credited_ledger_entry_id = $2,
           credited_at = NOW()
       WHERE id = $1`,
      [insertedEvent.rows[0].id, ledger.rows[0].id]
    );

    await client.query("COMMIT");
    return "credited";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function processTransferLogs({
  client,
  provider,
  runRpcRequest,
  blockCache,
  logs,
  walletOwners,
  asset,
  activationSettings,
  chainId,
  contractAddress,
  result,
}: {
  client: PoolClient;
  provider: JsonRpcProvider;
  runRpcRequest: RpcRequestRunner;
  blockCache: Map<number, Promise<CachedBlock>>;
  logs: TransferLog[];
  walletOwners: Map<string, WalletOwner>;
  asset: UsdtAsset;
  activationSettings: ActivationSettings;
  chainId: number;
  contractAddress: string;
  result: BscUsdtDepositSyncResult;
}) {
  result.eventsFound += logs.length;

  for (const log of logs) {
    const outcome = await creditTransferLog({
      client,
      provider,
      runRpcRequest,
      blockCache,
      log,
      walletOwners,
      asset,
      activationSettings,
      chainId,
      contractAddress,
    });

    if (outcome === "credited") {
      result.credited += 1;
    } else if (outcome === "legacy") {
      result.legacyCreditsRecorded += 1;
    } else if (outcome === "duplicate") {
      result.duplicatesSkipped += 1;
    } else if (outcome === "before_wallet_creation") {
      result.beforeWalletCreationSkipped += 1;
    }
  }
}

export function isDepositSyncMigrationError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && ((error as { code?: string }).code === "42P01" || (error as { code?: string }).code === "42703");
}

export async function syncBscUsdtDeposits(): Promise<BscUsdtDepositSyncResult> {
  const client = await pool.connect();
  let lockKey: string | null = null;
  let lockToken: string | null = null;

  try {
    const rpcUrl = getBscDepositRpcUrl().trim();
    if (!rpcUrl) {
      throw new DepositSyncError("BSC RPC URL is not configured.", 503);
    }

    const configuredContract = getBscUsdtContract().trim();
    if (!isAddress(configuredContract)) {
      throw new DepositSyncError("The configured BSC USDT contract address is invalid.", 503);
    }
    const contractAddress = getAddress(configuredContract);

    const settings = getSyncSettings();
    const provider = new JsonRpcProvider(rpcUrl);
    const runRpcRequest = createRpcRequestRunner(settings.rpcMinimumIntervalMs);
    const network = await runRpcRequest(() => provider.getNetwork());
    const chainId = Number(network.chainId);
    if (chainId !== BSC_MAINNET_CHAIN_ID) {
      throw new DepositSyncError(
        "BSC USDT deposit sync requires a BSC mainnet RPC (chain ID 56).",
        503
      );
    }

    lockKey = cursorKey(chainId, contractAddress);
    lockToken = randomUUID();
    if (!await acquireSyncLock(client, lockKey, lockToken)) {
      return emptyResult("locked", chainId, null);
    }

    const walletOwners = await loadWalletOwners(client);
    if (walletOwners.size === 0) {
      return emptyResult("no_wallets", chainId, null);
    }

    const asset = await loadUsdtAsset(client, contractAddress);
    const activationSettings = await loadActivationSettings(client);
    const latestBlock = await runRpcRequest(() => provider.getBlockNumber());
    const safeHead = latestBlock - settings.confirmations;
    if (safeHead < 0) {
      return emptyResult("waiting_confirmations", chainId, null);
    }

    const lastScannedBlock = await loadCursor(client, lockKey);
    const nextBlock = lastScannedBlock === null
      ? await determineInitialStartBlock(
        provider,
        runRpcRequest,
        safeHead,
        walletOwners,
        settings.startBlock
      )
      : lastScannedBlock + 1;

    const result: BscUsdtDepositSyncResult = {
      ...emptyResult("completed", chainId, safeHead),
      fromBlock: nextBlock <= safeHead ? nextBlock : null,
    };
    const blockCache = new Map<number, Promise<CachedBlock>>();
    const recipientAddresses = Array.from(walletOwners.keys());

    const scanRange = async (rangeStart: number, rangeEnd: number) => {
      const logs = await fetchTransferLogs(
        provider,
        runRpcRequest,
        contractAddress,
        recipientAddresses,
        rangeStart,
        rangeEnd,
        settings.recipientBatchSize
      );

      await processTransferLogs({
        client,
        provider,
        runRpcRequest,
        blockCache,
        logs,
        walletOwners,
        asset,
        activationSettings,
        chainId,
        contractAddress,
        result,
      });
    };

    const backfillNearHead = lastScannedBlock !== null
      && lastScannedBlock >= safeHead - settings.liveLookbackBlocks;
    if (!backfillNearHead) {
      const recentCursorKey = liveCursorKey(chainId, contractAddress);
      const lastLiveScannedBlock = await loadCursor(client, recentCursorKey);
      const liveFloor = Math.max(0, safeHead - settings.liveLookbackBlocks);
      let liveRangeStart = lastLiveScannedBlock === null
        ? liveFloor
        : Math.max(liveFloor, lastLiveScannedBlock + 1);

      while (liveRangeStart <= safeHead) {
        const liveRangeEnd = Math.min(liveRangeStart + settings.blockRange - 1, safeHead);
        await scanRange(liveRangeStart, liveRangeEnd);
        await saveCursor(client, recentCursorKey, liveRangeEnd);
        result.liveRangesScanned += 1;
        result.rangesScanned += 1;
        liveRangeStart = liveRangeEnd + 1;
      }
    }

    if (nextBlock > safeHead) {
      result.status = "waiting_confirmations";
      return result;
    }

    let rangeStart = nextBlock;
    let backfillRangesScanned = 0;
    while (rangeStart <= safeHead && backfillRangesScanned < settings.maxRangesPerRun) {
      const rangeEnd = Math.min(rangeStart + settings.blockRange - 1, safeHead);
      await scanRange(rangeStart, rangeEnd);

      await saveCursor(client, lockKey, rangeEnd);
      result.rangesScanned += 1;
      result.toBlock = rangeEnd;
      rangeStart = rangeEnd + 1;
      backfillRangesScanned += 1;
    }

    return result;
  } finally {
    if (lockKey && lockToken) {
      await releaseSyncLock(client, lockKey, lockToken).catch(() => undefined);
    }
    client.release();
  }
}
