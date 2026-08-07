import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId parameter is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          p.id,
          r.round_number as round,
          p.tickets_count as "betsCount",
          (p.tickets_count * 1) as "urdSpent",
          p.status,
          p.created_at as "betAt"
        FROM public.game_participants p
        JOIN public.game_rounds r ON p.round_id = r.id
        WHERE p.user_id = $1
        ORDER BY p.created_at DESC
        LIMIT 50
      `, [userId]);

      const formattedBets = result.rows.map(row => ({
        id: `b-${row.id}`,
        round: row.round,
        betsCount: row.betsCount,
        urdSpent: row.urdSpent,
        status: row.status === 'PENDING' ? 'WAITING' : row.status, // PENDING to WAITING for frontend consistency
        betAt: new Date(row.betAt).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" })
      }));

      return NextResponse.json({ success: true, bets: formattedBets });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error fetching user bets:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
