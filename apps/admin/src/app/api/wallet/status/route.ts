import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Get users with balances
    const { data: usersWithBalances, error: usersErr } = await supabaseAdmin
      .from("users")
      .select(`
        id,
        email,
        user_wallets ( address ),
        user_balances ( available_balance, asset_id )
      `)
      .limit(100);

    if (usersErr) throw usersErr;

    // 2. Get system settings
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("system_settings")
      .select("key, value");

    if (settingsErr) throw settingsErr;

    // 3. Get vault transfer logs
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from("vault_transfers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (logsErr) throw logsErr;

    return NextResponse.json({
      success: true,
      usersWithBalances,
      settings,
      logs
    });
  } catch (err: any) {
    console.error("wallet/status API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
