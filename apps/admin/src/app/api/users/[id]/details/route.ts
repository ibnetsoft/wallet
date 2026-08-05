import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });
    }

    // 1. Fetch Game Machines
    const machinesQuery = `
      SELECT 
        id, 
        package_level, 
        purchase_price, 
        total_entry_limit, 
        used_entries, 
        payout_limit_usd, 
        accumulated_payout_usd, 
        created_at
      FROM public.user_game_machines
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const machinesRes = await pool.query(machinesQuery, [userId]);

    // 2. Fetch Game Participants (Tickets & Draws)
    const gamesQuery = `
      SELECT 
        gp.id,
        gp.round_id,
        gr.status as round_status,
        gp.tickets_count,
        gp.won_tickets,
        gp.lost_tickets,
        gp.status as ticket_status,
        gp.created_at
      FROM public.game_participants gp
      JOIN public.game_rounds gr ON gp.round_id = gr.id
      WHERE gp.user_id = $1
      ORDER BY gp.created_at DESC
    `;
    const gamesRes = await pool.query(gamesQuery, [userId]);

    // 3. Fetch Bonus History
    const bonusesQuery = `
      SELECT 
        l.id,
        a.symbol as asset,
        l.amount,
        l.tx_type,
        l.created_at,
        l.details
      FROM public.ledger_entries l
      JOIN public.assets a ON l.asset_id = a.id
      WHERE l.user_id = $1 
        AND (l.tx_type LIKE '%BONUS%' OR l.tx_type = 'GAME_CONSOLATION' OR l.tx_type = 'GAME_REWARD')
      ORDER BY l.created_at DESC
    `;
    const bonusesRes = await pool.query(bonusesQuery, [userId]);

    return NextResponse.json({
      success: true,
      details: {
        machines: machinesRes.rows.map(row => ({
          ...row,
          payoutPercentage: (parseFloat(row.accumulated_payout_usd) / parseFloat(row.payout_limit_usd)) * 100,
          purchase_price: parseFloat(row.purchase_price),
          payout_limit_usd: parseFloat(row.payout_limit_usd),
          accumulated_payout_usd: parseFloat(row.accumulated_payout_usd)
        })),
        games: gamesRes.rows.map(row => ({
          ...row,
        })),
        bonuses: bonusesRes.rows.map(row => ({
          ...row,
          amount: parseFloat(row.amount)
        }))
      }
    });
  } catch (err: any) {
    console.error("GET api/users/[id]/details error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
