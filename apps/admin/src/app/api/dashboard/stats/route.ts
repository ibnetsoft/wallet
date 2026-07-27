import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
    const pendingWithdrawalCount = parseInt(withdrawRes.rows[0].count || "0");

    // 3. Registered & Active Users Count
    const usersRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active
      FROM public.users
    `);
    const totalUsers = parseInt(usersRes.rows[0].total || "0");
    const activeUsers = parseInt(usersRes.rows[0].active || "0");

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
        a.symbol as asset,
        l.amount,
        l.tx_type as type,
        l.tx_hash as hash,
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
      let typeLabel = tx.type;
      if (tx.type === "DEPOSIT") typeLabel = "입금 완료";
      else if (tx.type === "WITHDRAW") typeLabel = tx.status === "PENDING" ? "출금 신청" : "출금 완료";
      else if (tx.type === "SWAP_IN" || tx.type === "SWAP_OUT") typeLabel = "실시간 스왑";
      else if (tx.type === "REFERRAL_BONUS") typeLabel = "추천 수당";
      else if (tx.type === "RANK_BONUS") typeLabel = "직급 수당";
      else if (tx.type === "CHOITAN_BONUS") typeLabel = "Foster 수당";

      const amtVal = parseFloat(tx.amount);
      const isNegative = amtVal < 0;
      const formattedAmount = `${isNegative ? "" : "+"}${amtVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

      return {
        id: tx.id.substring(0, 8).toUpperCase(),
        email: tx.email,
        asset: tx.asset,
        amount: formattedAmount,
        type: typeLabel,
        hash: tx.hash ? (tx.hash.length > 12 ? `${tx.hash.substring(0, 6)}...${tx.hash.substring(tx.hash.length - 4)}` : tx.hash) : "내부 처리",
        status: tx.status === "COMPLETED" ? "완료" : tx.status === "PENDING" ? "대기 중" : "실패",
        date: new Date(tx.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        details: tx.type === "WITHDRAW" ? `수수료 3% 적용` : undefined
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
