export const DEFAULT_BSC_MAINNET_RPC_URL = "https://bsc-dataseed.binance.org";
export const DEFAULT_BSC_MAINNET_USDT_CONTRACT =
  "0x55d398326f99059fF775485246999027B3197955";

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
