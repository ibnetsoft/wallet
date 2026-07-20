import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { HDWalletManager } from './utils/hdwallet';

// Load environment variables
dotenv.config();

const RPC_URL = process.env.RPC_URL || '';
const MASTER_MNEMONIC = process.env.MASTER_MNEMONIC || '';
const CONTRACT_USDT = process.env.CONTRACT_USDT || '';
const CONTRACT_URC = process.env.CONTRACT_URC || '';

const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.error('🔴 DATABASE_URL is missing in .env');
  process.exit(1);
}

// Initialize PostgreSQL Pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase cloud PostgreSQL connections
  }
});

// Minimal ERC-20 / BEP-20 ABI for Transfer event detection
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function balanceOf(address owner) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

// Helper to handle Deposit Event via direct PostgreSQL connection
async function handleOnChainDeposit(tokenSymbol: string, fromAddress: string, toAddress: string, amount: string, txHash: string) {
  const client = await pool.connect();
  try {
    // Start transactional block for data integrity
    await client.query('BEGIN');

    // 1. Resolve asset UUID dynamically from symbol
    const assetRes = await client.query(
      'SELECT id FROM public.assets WHERE symbol = $1 LIMIT 1',
      [tokenSymbol]
    );

    if (assetRes.rows.length === 0) {
      console.error(`[DB ERROR] Asset symbol ${tokenSymbol} not found in database.`);
      await client.query('ROLLBACK');
      return;
    }
    const assetId = assetRes.rows[0].id;

    // 2. Query user_wallets to see if 'toAddress' belongs to a registered user deposit address
    const walletRes = await client.query(
      'SELECT user_id, derivation_index FROM public.user_wallets WHERE address ILIKE $1 LIMIT 1',
      [toAddress]
    );

    if (walletRes.rows.length === 0) {
      // Address not in system, skip logging (untracked deposit)
      await client.query('ROLLBACK');
      return;
    }
    const { user_id: userId, derivation_index: derivationIndex } = walletRes.rows[0];
    console.log(`🎯 Match found! Deposit belongs to User UUID: ${userId} (Derivation Index: ${derivationIndex})`);

    // 3. Verify double-deposit (idempotency check) via txHash
    const dupRes = await client.query(
      'SELECT id FROM public.ledger_entries WHERE tx_hash = $1 AND type = $2 LIMIT 1',
      [txHash, 'DEPOSIT']
    );

    if (dupRes.rows.length > 0) {
      console.log(`⚠️ Skip duplicate event: Tx ${txHash} already credited.`);
      await client.query('ROLLBACK');
      return;
    }

    const depositAmount = Number(amount);

    // 4. Record Deposit in Ledger Bookkeeping
    const ledgerRes = await client.query(
      `INSERT INTO public.ledger_entries (user_id, asset_id, amount, fee, type, status, tx_hash, description)
       VALUES ($1, $2, $3, 0, 'DEPOSIT', 'COMPLETED', $4, $5) RETURNING id`,
      [userId, assetId, depositAmount, txHash, `BSC On-chain Deposit from ${fromAddress}`]
    );

    console.log(`✅ Ledger Entry created: Entry ID ${ledgerRes.rows[0].id}`);

    // 5. Update user_balances (using upsert logic)
    await client.query(
      `INSERT INTO public.user_balances (user_id, asset_id, balance, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, asset_id)
       DO UPDATE SET balance = user_balances.balance + EXCLUDED.balance, updated_at = NOW()`,
      [userId, assetId, depositAmount]
    );

    console.log(`💰 Updated balance for User ${userId}: Credited +${depositAmount} ${tokenSymbol}`);

    // 6. Marketing Business Rule:
    // If deposit asset is USDT and amount is >= $100 (default package threshold),
    // activate user status from PENDING -> ACTIVE to fire the 369 sponsor pass-up trigger
    if (tokenSymbol === 'USDT' && depositAmount >= 100) {
      const userRes = await client.query(
        'SELECT status FROM public.users WHERE id = $1 LIMIT 1',
        [userId]
      );

      if (userRes.rows.length > 0 && userRes.rows[0].status === 'PENDING') {
        console.log(`🚀 User deposited ${depositAmount} USDT >= $100. Activating account...`);
        
        // This UPDATE triggers handle_user_activation() in public.users (Postgres Trigger)
        const updateRes = await client.query(
          "UPDATE public.users SET status = 'ACTIVE' WHERE id = $1 RETURNING id, email, placement_id",
          [userId]
        );

        if (updateRes.rows.length > 0) {
          console.log(`✨ User Activated! Placement assigned to: ${updateRes.rows[0].placement_id}`);
        }
      }
    }

    // Commit Transaction
    await client.query('COMMIT');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`密 Critical error during deposit transaction rollback:`, err);
  } finally {
    client.release();
  }
}

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
    
    usdtContract.on('Transfer', (from: string, to: string, value: bigint, event: any) => {
      const formattedAmount = ethers.formatUnits(value, 18);
      console.log(`[USDT EVENT] Transfer detected: ${from} ➡️ ${to} | Amount: ${formattedAmount} USDT | Tx: ${event.log.transactionHash}`);
      
      // Process deposit async
      handleOnChainDeposit('USDT', from, to, formattedAmount, event.log.transactionHash);
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
      
      // Process deposit async
      handleOnChainDeposit('URC', from, to, formattedAmount, event.log.transactionHash);
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
