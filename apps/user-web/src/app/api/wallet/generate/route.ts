import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { ethers } from 'ethers';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const mnemonic = process.env.WALLET_MASTER_MNEMONIC;
    if (!mnemonic) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // 1. Query the next available derivation_index atomically
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const indexResult = await client.query(`
        SELECT COALESCE(MAX(derivation_index), -1) + 1 AS next_index
        FROM public.user_wallets
      `);
      
      const nextIndex = parseInt(indexResult.rows[0].next_index, 10);
      
      // 2. Use ethers to derive the BSC child wallet
      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
      const childWallet = hdNode.derivePath(`m/44'/60'/0'/0/${nextIndex}`);
      const address = childWallet.address;
      
      // 3. Insert the new address
      await client.query(`
        INSERT INTO public.user_wallets (user_id, address, derivation_index, chain_type)
        VALUES ($1, $2, $3, 'BSC')
      `, [user_id, address, nextIndex]);
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        address,
        derivation_index: nextIndex,
        chain_type: 'BSC'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Wallet generation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
