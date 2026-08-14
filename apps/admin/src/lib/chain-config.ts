import { FetchRequest, JsonRpcProvider } from "ethers";

export const DEFAULT_BSC_MAINNET_RPC_URL = "https://bsc-dataseed.binance.org";
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
