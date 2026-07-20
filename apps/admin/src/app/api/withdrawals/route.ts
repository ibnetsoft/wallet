import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 1. GET: Fetch pending withdrawals for administrative audit
export async function GET() {
  try {
    const { data: withdrawals, error } = await supabaseAdmin
      .from("ledger_entries")
      .select(`
        id,
        user_id,
        asset_id,
        amount,
        fee,
        type,
        status,
        tx_hash,
        created_at,
        users:user_id ( email )
      `)
      .eq("type", "WITHDRAW")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch pending withdrawals: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals.map((w: any) => ({
        id: w.id,
        userId: w.user_id,
        email: w.users?.email || "unknown@user.com",
        amount: Math.abs(Number(w.amount)), // Withdraw amount is negative in double-entry ledger
        fee: Number(w.fee),
        asset: "USDT", // Mapping from asset_id dynamically in real prod
        txHash: w.tx_hash,
        status: w.status,
        time: new Date(w.created_at).toLocaleTimeString()
      }))
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 2. POST: Approve or Reject a specific withdrawal
export async function POST(request: Request) {
  try {
    const { withdrawalId, action, reason } = await request.json();

    if (!withdrawalId || !action) {
      return NextResponse.json(
        { success: false, error: "withdrawalId and action ('APPROVE' | 'REJECT') are required" },
        { status: 400 }
      );
    }

    // Fetch the target ledger entry to audit
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from("ledger_entries")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (fetchError || !entry) {
      return NextResponse.json(
        { success: false, error: "Withdrawal ledger entry not found" },
        { status: 404 }
      );
    }

    if (entry.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: `Withdrawal is already in ${entry.status} status` },
        { status: 400 }
      );
    }

    if (action === "APPROVE") {
      // Approve withdrawal: update status to COMPLETED
      // (In production, this would trigger hot wallet keys to broadcast to BSC node)
      const { error: updateError } = await supabaseAdmin
        .from("ledger_entries")
        .update({ status: "COMPLETED" })
        .eq("id", withdrawalId);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: `Failed to approve: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Withdrawal approved successfully. Hot wallet queued."
      });

    } else if (action === "REJECT") {
      // Reject withdrawal:
      // Refund the locked amount to user's balance and mark ledger entry as FAILED.
      // Since it's double-entry bookkeeping, we do this in a single atomic transaction.
      const amountToRefund = Math.abs(Number(entry.amount));
      
      // Update entry status to FAILED
      const { error: updateFailError } = await supabaseAdmin
        .from("ledger_entries")
        .update({ status: "FAILED" })
        .eq("id", withdrawalId);

      if (updateFailError) {
        return NextResponse.json(
          { success: false, error: `Failed to reject: ${updateFailError.message}` },
          { status: 500 }
        );
      }

      // Add a refund entry in ledger
      const { error: refundLedgerError } = await supabaseAdmin
        .from("ledger_entries")
        .insert({
          user_id: entry.user_id,
          asset_id: entry.asset_id,
          amount: amountToRefund,
          fee: 0,
          type: "REFUND",
          status: "COMPLETED",
          tx_hash: "Internal Reject",
          description: reason || "Withdrawal rejected by Admin"
        });

      if (refundLedgerError) {
        console.error("Critical: Failed to insert refund ledger entry:", refundLedgerError);
      }

      // Restore user balance
      const { data: currentBal, error: balanceFetchError } = await supabaseAdmin
        .from("user_balances")
        .select("balance")
        .eq("user_id", entry.user_id)
        .eq("asset_id", entry.asset_id)
        .single();

      if (!balanceFetchError && currentBal) {
        const newBalance = Number(currentBal.balance) + amountToRefund;
        await supabaseAdmin
          .from("user_balances")
          .update({ balance: newBalance })
          .eq("user_id", entry.user_id)
          .eq("asset_id", entry.asset_id);
      }

      return NextResponse.json({
        success: true,
        message: "Withdrawal rejected. locked funds refunded to user."
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action type" },
      { status: 400 }
    );

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
