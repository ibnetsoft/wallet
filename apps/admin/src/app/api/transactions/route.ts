import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function parseDetails(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;
    const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const selectedDate = searchParams.get("date")?.trim() || "";
    const offset = (page - 1) * limit;

    const filters: string[] = [];
    const filterParams: Array<string | number> = [];

    if (selectedDate) {
      filterParams.push(selectedDate);
      filters.push(`(l.created_at AT TIME ZONE 'Asia/Seoul')::date = $${filterParams.length}::date`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.ledger_entries AS l
       JOIN public.users AS u ON l.user_id = u.id
       JOIN public.assets AS a ON l.asset_id = a.id
       ${whereClause}`,
      filterParams,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const queryParams = [...filterParams, limit, offset];

    const result = await pool.query(
      `SELECT
         l.id,
         l.amount,
         l.tx_type,
         l.status,
         l.tx_hash,
         l.details,
         l.created_at,
         u.email AS user_email,
         u.nickname AS user_nickname,
         a.symbol AS asset_symbol
       FROM public.ledger_entries AS l
       JOIN public.users AS u ON l.user_id = u.id
       JOIN public.assets AS a ON l.asset_id = a.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${queryParams.length - 1}
       OFFSET $${queryParams.length}`,
      queryParams,
    );

    return NextResponse.json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      transactions: result.rows.map((row: any) => {
        const details = parseDetails(row.details) as Record<string, unknown> | null;

        return {
          id: row.id,
          userEmail: row.user_email,
          userNickname: row.user_nickname || "-",
          asset: row.asset_symbol,
          amount: Number(row.amount),
          type: row.tx_type,
          status: row.status,
          hash: row.tx_hash,
          chainTxHash: typeof details?.chain_tx_hash === "string" ? details.chain_tx_hash : null,
          details,
          createdAt: new Date(row.created_at).toISOString(),
        };
      }),
    });
  } catch (error: unknown) {
    console.error("GET api/transactions error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load transactions." },
      { status: 500 },
    );
  }
}
