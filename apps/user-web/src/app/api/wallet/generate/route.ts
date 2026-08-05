import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ethers } from 'ethers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const mnemonic = process.env.WALLET_MASTER_MNEMONIC;
    if (!mnemonic) {
      return NextResponse.json({ error: 'Server misconfiguration: no mnemonic' }, { status: 500 });
    }

    const supabase = createAdminClient();

    // 1. Check if user already has a wallet
    const { data: existingWallet } = await supabase
      .from('user_wallets')
      .select('address')
      .eq('user_id', user_id)
      .eq('chain_type', 'BSC')
      .limit(1)
      .single();

    if (existingWallet?.address) {
      return NextResponse.json({
        success: true,
        address: existingWallet.address,
        chain_type: 'BSC',
        existing: true
      });
    }

    // 2. Get next derivation index
    const { data: maxIndexData } = await supabase
      .from('user_wallets')
      .select('derivation_index')
      .order('derivation_index', { ascending: false })
      .limit(1)
      .single();

    const nextIndex = maxIndexData ? maxIndexData.derivation_index + 1 : 0;

    // 3. Derive BSC wallet from mnemonic (ethers v6: specify base path, then relative index)
    const basePath = "m/44'/60'/0'/0";
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, "", basePath);
    const childWallet = hdNode.deriveChild(nextIndex);
    const address = childWallet.address;

    // 4. Insert into user_wallets
    const { error: insertError } = await supabase
      .from('user_wallets')
      .insert({
        user_id,
        address,
        derivation_index: nextIndex,
        chain_type: 'BSC',
      });

    if (insertError) {
      console.error('Wallet insert error:', insertError);
      return NextResponse.json({ error: `DB insert failed: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      address,
      derivation_index: nextIndex,
      chain_type: 'BSC'
    });
  } catch (error: any) {
    console.error('Wallet generation error:', error);
    return NextResponse.json({ error: `Internal Error: ${error.message}` }, { status: 500 });
  }
}
