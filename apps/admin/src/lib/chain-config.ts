import { FetchRequest, JsonRpcProvider } from "ethers";

export const DEFAULT_BSC_MAINNET_RPC_URL = "https://bsc-dataseed.binance.org";
export const DEFAULT_BSC_FALLBACK_RPC_URLS = [
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://rpc.ankr.com/bsc",
] as const;
export const DEFAULT_BSC_MAINNET_USDT_CONTRACT =
  "0x55d398326f99059fF775485246999027B3197955";
const BSC_MAINNET_CHAIN_ID = 56;
const DEFAULT_BSC_READ_TIMEOUT_MS = 5_000;

// Keep admin chain settings centralized so Vercel monorepo deploys always include this path.

function normalizedSetting(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.replace(/^(["'])(.*)\1$/, "$2");
}

export function getBscRpcUrl() {
  return (
    normalizedSetting(process.env.BSC_RPC_URL)
    || normalizedSetting(process.env.BNB_TRANSFER_RPC_URL)
    || normalizedSetting(process.env.NEXT_PUBLIC_BSC_RPC_URL)
    || DEFAULT_BSC_MAINNET_RPC_URL
  );
}

export function getBscReadRpcUrls() {
  const configured = [
    normalizedSetting(process.env.BSC_RPC_URL),
    normalizedSetting(process.env.BNB_TRANSFER_RPC_URL),
    normalizedSetting(process.env.NEXT_PUBLIC_BSC_RPC_URL),
  ].filter(Boolean);
  const envFallbacks = normalizedSetting(process.env.BSC_RPC_FALLBACK_URLS)
    .split(",")
    .map((value) => normalizedSetting(value))
    .filter(Boolean);

  return [...new Set([
    ...configured,
    DEFAULT_BSC_MAINNET_RPC_URL,
    ...envFallbacks,
    ...DEFAULT_BSC_FALLBACK_RPC_URLS,
  ])];
}

// Deposit indexing must never inherit a browser-facing testnet endpoint.
// A missing server-side endpoint deliberately falls back to BSC mainnet.
export function getBscDepositRpcUrl() {
  return (
    normalizedSetting(process.env.BSC_DEPOSIT_RPC_URL)
    || normalizedSetting(process.env.BSC_RPC_URL)
    || normalizedSetting(process.env.BNB_TRANSFER_RPC_URL)
    || DEFAULT_BSC_MAINNET_RPC_URL
  );
}

export function getBscUsdtContract() {
  return (
    normalizedSetting(process.env.USDT_CONTRACT_ADDRESS) ||
    normalizedSetting(process.env.NEXT_PUBLIC_USDT_CONTRACT) ||
    DEFAULT_BSC_MAINNET_USDT_CONTRACT
  );
}

// Read-only dashboard calls should not wait indefinitely on an unavailable RPC.
// Supplying the known network also avoids a separate eth_chainId round trip.
export function createBscReadProvider(timeoutMs = DEFAULT_BSC_READ_TIMEOUT_MS) {
  const request = new FetchRequest(getBscRpcUrl());
  request.timeout = timeoutMs;

  return new JsonRpcProvider(request, BSC_MAINNET_CHAIN_ID, {
    staticNetwork: true,
  });
}

export function createBscReadProviderFromUrl(
  rpcUrl: string,
  timeoutMs = DEFAULT_BSC_READ_TIMEOUT_MS,
) {
  const request = new FetchRequest(rpcUrl);
  request.timeout = timeoutMs;

  return new JsonRpcProvider(request, BSC_MAINNET_CHAIN_ID, {
    staticNetwork: true,
  });
}

export async function withBscReadProviderFallback<T>(
  runner: (provider: JsonRpcProvider, rpcUrl: string) => Promise<T>,
  timeoutMs = DEFAULT_BSC_READ_TIMEOUT_MS,
) {
  const errors: Array<{ rpcUrl: string; error: unknown }> = [];

  for (const rpcUrl of getBscReadRpcUrls()) {
    try {
      const provider = createBscReadProviderFromUrl(rpcUrl, timeoutMs);
      return await runner(provider, rpcUrl);
    } catch (error) {
      errors.push({ rpcUrl, error });
    }
  }

  const fallbackError = new Error("All configured BSC read RPC endpoints failed.");
  (fallbackError as Error & { cause?: unknown }).cause = errors;
  throw fallbackError;
}
