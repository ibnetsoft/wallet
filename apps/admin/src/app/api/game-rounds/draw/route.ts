import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getBeijingToday, reopenRoundsForNewDay } from "@/lib/game-rounds";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(req: Request) {
  try {
    const { round_id } = await req.json();
    if (!round_id) {
      return NextResponse.json({ success: false, error: "round_id is required" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { today } = await getBeijingToday(client);
      await reopenRoundsForNewDay(client, today);

      const roundRes = await client.query(
        `SELECT status, last_processed_date
         FROM public.game_rounds
         WHERE id = $1
         FOR UPDATE`,
        [round_id]
      );

      if (roundRes.rows.length === 0) {
        throw new Error("Round not found");
      }

      const round = roundRes.rows[0];
      if (round.last_processed_date === today) {
        throw new Error("Round already processed today");
      }
      if (round.status !== "OPEN") {
        throw new Error("Round is not OPEN");
      }

      const partsRes = await client.query(
        `SELECT id, user_id, tickets_count
         FROM public.game_participants
         WHERE round_id = $1 AND round_date = $2::date
         FOR UPDATE`,
        [round_id, today]
      );
      const participants = partsRes.rows;
      const totalTickets = participants.reduce((sum, p) => sum + Number(p.tickets_count), 0);

      const assetsRes = await client.query(
        `SELECT id, symbol FROM public.assets WHERE symbol IN ('USDT', 'JADE', 'BAO')`
      );
      const assets = Object.fromEntries(assetsRes.rows.map((a) => [a.symbol, a.id]));
      if (!assets.USDT || !assets.JADE || !assets.BAO) {
        throw new Error("System assets missing");
      }

      if (totalTickets < 10) {
        for (const p of participants) {
          const usdtRefund = Number(p.tickets_count) * 100;
          const jadeRefund = Number(p.tickets_count) * 1;

          await client.query(
            `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (user_id, asset_id)
             DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
                           updated_at = NOW()`,
            [p.user_id, assets.USDT, usdtRefund]
          );
          await client.query(
            `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (user_id, asset_id)
             DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
                           updated_at = NOW()`,
            [p.user_id, assets.JADE, jadeRefund]
          );

          await client.query(
            `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
             VALUES ($1, $2, 'GAME_REFUND', $3, 'COMPLETED'),
                    ($1, $4, 'GAME_REFUND', $5, 'COMPLETED')`,
            [p.user_id, assets.USDT, usdtRefund, assets.JADE, jadeRefund]
          );

          await client.query(
            `UPDATE public.game_participants
             SET status = 'REFUNDED'
             WHERE id = $1`,
            [p.id]
          );
        }

        await client.query(
          `UPDATE public.game_rounds
           SET status = 'CANCELED', last_processed_date = $2::date
           WHERE id = $1`,
          [round_id, today]
        );

        await client.query("COMMIT");
        return NextResponse.json({ success: true, message: "Round CANCELED and refunded because total tickets < 10" });
      }

      let targetLosers = Math.floor(totalTickets * 0.1);
      const allTickets: { user_id: string; p_id: number }[] = [];
      const userMaxLosses: Record<string, number> = {};
      const userCurrentLosses: Record<string, number> = {};

      for (const p of participants) {
        const ticketCount = Number(p.tickets_count);
        userMaxLosses[p.user_id] = Math.ceil(ticketCount * 0.2);
        userCurrentLosses[p.user_id] = 0;

        for (let i = 0; i < ticketCount; i++) {
          allTickets.push({ user_id: p.user_id, p_id: Number(p.id) });
        }
      }

      for (let i = allTickets.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTickets[i], allTickets[j]] = [allTickets[j], allTickets[i]];
      }

      const loserTicketIndices = new Set<number>();
      for (let i = 0; i < allTickets.length; i++) {
        if (targetLosers <= 0) break;
        const t = allTickets[i];
        if (userCurrentLosses[t.user_id] < userMaxLosses[t.user_id]) {
          loserTicketIndices.add(i);
          userCurrentLosses[t.user_id]++;
          targetLosers--;
        }
      }

      const results = participants.map((p) => ({
        ...p,
        won_tickets: 0,
        lost_tickets: 0
      }));

      for (let i = 0; i < allTickets.length; i++) {
        const t = allTickets[i];
        const pIndex = results.findIndex((r) => Number(r.id) === t.p_id);
        if (loserTicketIndices.has(i)) {
          results[pIndex].lost_tickets++;
        } else {
          results[pIndex].won_tickets++;
        }
      }

      for (const r of results) {
        const usdtPayout = (Number(r.won_tickets) * 102) + (Number(r.lost_tickets) * 80);
        const baoPayout = Number(r.lost_tickets) * 20;
        const jadePayout = Number(r.lost_tickets) * 20;

        if (usdtPayout > 0) {
          await client.query(
            `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (user_id, asset_id)
             DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
                           updated_at = NOW()`,
            [r.user_id, assets.USDT, usdtPayout]
          );
          await client.query(
            `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
             VALUES ($1, $2, 'GAME_REWARD', $3, 'COMPLETED')`,
            [r.user_id, assets.USDT, usdtPayout]
          );
        }

        if (baoPayout > 0) {
          await client.query(
            `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (user_id, asset_id)
             DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
                           updated_at = NOW()`,
            [r.user_id, assets.BAO, baoPayout]
          );
          await client.query(
            `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
             VALUES ($1, $2, 'GAME_CONSOLATION', $3, 'COMPLETED')`,
            [r.user_id, assets.BAO, baoPayout]
          );
        }

        if (jadePayout > 0) {
          await client.query(
            `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
             VALUES ($1, $2, $3, 0, NOW())
             ON CONFLICT (user_id, asset_id)
             DO UPDATE SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
                           updated_at = NOW()`,
            [r.user_id, assets.JADE, jadePayout]
          );
          await client.query(
            `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
             VALUES ($1, $2, 'GAME_CONSOLATION', $3, 'COMPLETED')`,
            [r.user_id, assets.JADE, jadePayout]
          );
        }

        await client.query(
          `UPDATE public.game_participants
           SET won_tickets = $1, lost_tickets = $2, status = 'COMPLETED'
           WHERE id = $3`,
          [r.won_tickets, r.lost_tickets, r.id]
        );
      }

      await client.query(
        `UPDATE public.game_rounds
         SET status = 'COMPLETED', last_processed_date = $2::date
         WHERE id = $1`,
        [round_id, today]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true, message: "Draw completed", participants: results });
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      console.error("Draw error:", e);
      return NextResponse.json(
        { success: false, error: e instanceof Error ? e.message : "Draw failed" },
        { status: 400 }
      );
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    console.error("API error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
