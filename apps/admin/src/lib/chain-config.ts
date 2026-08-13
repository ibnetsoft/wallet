export const DEFAULT_BSC_MAINNET_RPC_URL = "https://bsc-dataseed.binance.org";
export const DEFAULT_BSC_MAINNET_USDT_CONTRACT =
  "0x55d398326f99059fF775485246999027B3197955";
export const BSC_MAINNET_CHAIN_ID = 56;
export const BSC_MAINNET_EXPLORER_URL = "https://bscscan.com";

// Keep admin chain settings centralized so Vercel monorepo deploys always include this path.

export function getBscRpcUrl() {
  return process.env.BSC_RPC_URL || process.env.NEXT_PUBLIC_BSC_RPC_URL || DEFAULT_BSC_MAINNET_RPC_URL;
}

export function getBscUsdtContract() {
  return (
    process.env.USDT_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_USDT_CONTRACT ||
    DEFAULT_BSC_MAINNET_USDT_CONTRACT
  );
}

export function getBscChainId() {
  const configuredChainId = Number(process.env.BSC_CHAIN_ID || BSC_MAINNET_CHAIN_ID);
  return Number.isSafeInteger(configuredChainId) && configuredChainId > 0
    ? configuredChainId
    : BSC_MAINNET_CHAIN_ID;
}

export function getBscExplorerBaseUrl() {
  return (process.env.BSC_EXPLORER_URL || BSC_MAINNET_EXPLORER_URL).replace(/\/$/, "");
}
