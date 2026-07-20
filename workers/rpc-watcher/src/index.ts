import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { HDWalletManager } from './utils/hdwallet';

// Load environment variables
dotenv.config();

const RPC_URL = process.env.RPC_URL || '';
const MASTER_MNEMONIC = process.env.MASTER_MNEMONIC || '';
const CONTRACT_USDT = process.env.CONTRACT_USDT || '';
const CONTRACT_URC = process.env.CONTRACT_URC || '';

// Minimal ERC-20 / BEP-20 ABI for Transfer event detection
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

async function main() {
  console.log('🚀 Starting BSC Centralized Wallet Daemon (RPC Watcher)...');
  console.log(`📡 Connecting to QuickNode RPC: ${RPC_URL.substring(0, 45)}...`);

  // 1. Initialize Ethers Provider
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`🟢 Successfully connected to BSC. Current Block Number: ${blockNumber}`);
  } catch (error) {
    console.error('🔴 Failed to connect to BSC RPC node. Please verify RPC_URL in .env');
    console.error(error);
    process.exit(1);
  }

  // 2. Initialize HD Wallet derivation check
  console.log('\n🔑 Verifying BIP-44 HD Wallet derivation settings...');
  try {
    const walletManager = new HDWalletManager(MASTER_MNEMONIC);
    console.log('Sample derived user deposit addresses (Derivation Index 0 to 4):');
    for (let i = 0; i < 5; i++) {
      const derived = walletManager.deriveAddress(i);
      console.log(`  Index [${i}]: Address: ${derived.address}`);
    }
  } catch (error) {
    console.error('🔴 Failed to derive HD wallet addresses. Verify MASTER_MNEMONIC in .env');
    console.error(error);
  }

  // 3. Setup BEP-20 Token Event Subscriptions
  console.log('\n🕵️ Setting up on-chain Transfer Event listeners...');
  
  if (CONTRACT_USDT && ethers.isAddress(CONTRACT_USDT)) {
    const usdtContract = new ethers.Contract(CONTRACT_USDT, ERC20_ABI, provider);
    console.log(`   - USDT Contract target: ${CONTRACT_USDT}`);
    
    // Subscribe to Transfer events (WebSocket or Polling fallback)
    usdtContract.on('Transfer', (from: string, to: string, value: bigint, event: any) => {
      const formattedAmount = ethers.formatUnits(value, 18); // assuming 18 decimals
      console.log(`[USDT EVENT] Transfer detected: ${from} ➡️ ${to} | Amount: ${formattedAmount} USDT | Tx: ${event.log.transactionHash}`);
      
      // TODO: 입금 감지 대상 주소인지 DB(user_wallets) 조회 후 원장(ledger_entries) 및 user_balances 반영 트리거
    });
  } else {
    console.log('   ⚠️ CONTRACT_USDT is empty or invalid. Skipping USDT subscription.');
  }

  if (CONTRACT_URC && ethers.isAddress(CONTRACT_URC)) {
    const urcContract = new ethers.Contract(CONTRACT_URC, ERC20_ABI, provider);
    console.log(`   - URC Contract target: ${CONTRACT_URC}`);

    urcContract.on('Transfer', (from: string, to: string, value: bigint, event: any) => {
      const formattedAmount = ethers.formatUnits(value, 18);
      console.log(`[URC EVENT] Transfer detected: ${from} ➡️ ${to} | Amount: ${formattedAmount} URC | Tx: ${event.log.transactionHash}`);
      
      // TODO: URC 입금 감지 시 DB 반영 트리거
    });
  } else {
    console.log('   ⚠️ CONTRACT_URC is empty or invalid. Skipping URC subscription.');
  }

  console.log('\n🔔 Daemon is running in event-listening state. Waiting for on-chain events...');
}

main().catch((err) => {
  console.error('Fatal error in Watcher main thread:');
  console.error(err);
});
