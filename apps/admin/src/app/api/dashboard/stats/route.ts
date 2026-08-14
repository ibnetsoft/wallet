import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function statusLabel(status: string) {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "PENDING":
      return "pending";
    default:
      return "failed";
  }
}

export async function GET() {
  try {
    // 1. Total User USDT Balances (Total Deposits)
    const depositRes = await pool.query(`
      SELECT COALESCE(SUM(available_balance::numeric), 0) as total
      FROM public.user_balances
      WHERE asset_id = 2
    `);
    const totalDeposit = parseFloat(depositRes.rows[0].total || "0");

    // 2. Pending Withdrawal Amount & Count
    const withdrawRes = await pool.query(`
      SELECT 
        COALESCE(SUM(ABS(amount::numeric)), 0) as total,
        COUNT(*) as count
      FROM public.ledger_entries
      WHERE tx_type = 'WITHDRAW' AND status = 'PENDING'
    `);
    const pendingWithdrawalAmount = parseFloat(withdrawRes.rows[0].total || "0");
    const pendingWithdrawalCount = parseInt(withdrawRes.rows[0].count || "0", 10);

    // 3. Registered & Active Users Count
    const usersRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active
      FROM public.users
    `);
    const totalUsers = parseInt(usersRes.rows[0].total || "0", 10);
    const activeUsers = parseInt(usersRes.rows[0].active || "0", 10);

    // 4. Withdrawal Fee Earned (sum of fees in COMPLETED withdrawals)
    const feeRes = await pool.query(`
      SELECT 
        COALESCE(SUM(ABS(amount::numeric) * 0.03), 0) as total
      FROM public.ledger_entries
      WHERE tx_type = 'WITHDRAW' AND status = 'COMPLETED'
    `);
    const totalFees = parseFloat(feeRes.rows[0].total || "0");

    // 5. Recent Transactions
    const txQuery = `
      SELECT 
        l.id,
        u.email,
        u.nickname,
        a.symbol as asset,
        l.amount,
        l.tx_type as type,
        l.status,
        l.created_at
      FROM public.ledger_entries l
      JOIN public.users u ON l.user_id = u.id
      JOIN public.assets a ON l.asset_id = a.id
      ORDER BY l.created_at DESC
      LIMIT 10
    `;
    const txRes = await pool.query(txQuery);
    
    const recentTransactions = txRes.rows.map((tx: any) => {
      const amtVal = parseFloat(tx.amount);
      const isNegative = amtVal < 0;
      const formattedAmount = `${isNegative ? "" : "+"}${amtVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

      return {
        id: tx.id.substring(0, 8).toUpperCase(),
        email: tx.email,
        nickname: tx.nickname || "-",
        asset: tx.asset,
        amount: formattedAmount,
        type: tx.type,
        status: statusLabel(tx.status),
        date: new Date(tx.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        details: tx.type === "WITHDRAW" ? "수수료 3% 적용" : undefined,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalDeposit,
        pendingWithdrawalAmount,
        pendingWithdrawalCount,
        totalUsers,
        activeUsers,
        totalFees
      },
      recentTransactions
    });

  } catch (err: any) {
    console.error("Dashboard stats error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
