import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Fetch ledger entries joining with users and assets
    const query = `
      SELECT 
        l.id,
        l.amount,
        l.tx_type,
        l.status,
        l.tx_hash,
        l.details,
        l.created_at,
        u.email as user_email,
        u.nickname as user_nickname,
        a.symbol as asset_symbol
      FROM public.ledger_entries l
      JOIN public.users u ON l.user_id = u.id
      JOIN public.assets a ON l.asset_id = a.id
      ORDER BY l.created_at DESC
      LIMIT $1
    `;
    const res = await pool.query(query, [limit]);

    return NextResponse.json({
      success: true,
      transactions: res.rows.map((row: any) => ({
        id: row.id,
        userEmail: row.user_email,
        userNickname: row.user_nickname || "유저",
        asset: row.asset_symbol,
        amount: parseFloat(row.amount),
        type: row.tx_type,
        status: row.status,
        hash: row.tx_hash,
        details: row.details,
        createdAt: new Date(row.created_at).toLocaleString()
      }))
    });
  } catch (err: any) {
    console.error("GET api/transactions error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
