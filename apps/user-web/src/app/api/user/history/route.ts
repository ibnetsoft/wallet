import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

type LedgerDetails = Record<string, unknown>;

const BONUS_TRANSACTION_TYPES = new Set([
  "REFERRAL_BONUS",
  "FOSTER_BONUS",
  "MAMA_BONUS",
  "CHEOTAN_BONUS",
  "RANK_BONUS",
  "RANK_STAR_BONUS",
  "CHOITAN_BONUS",
  "PACKAGE_BONUS",
  "GAME_WIN",
  "GAME_REWARD",
  "GAME_CONSOLATION",
]);

const SWAP_TRANSACTION_TYPES = new Set(["SWAP_IN", "SWAP_OUT"]);

function parseDetails(value: unknown): LedgerDetails {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as LedgerDetails)
    : {};
}

function isOnChainTransactionHash(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const res = await pool.query(
      `SELECT l.id, l.amount, l.tx_type, l.status, l.tx_hash, l.details, l.created_at, a.symbol,
              source_user.id AS source_user_id,
              source_user.nickname AS source_nickname
       FROM public.ledger_entries l
       LEFT JOIN public.assets a ON a.id = l.asset_id
       LEFT JOIN public.users source_user
         ON source_user.id::text = (l.details ->> 'source_user_id')
       WHERE l.user_id = $1
         AND l.tx_type = ANY($2::text[])
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT 300`,
      [
        user.id,
        [
          "DEPOSIT",
          "WITHDRAW",
          ...BONUS_TRANSACTION_TYPES,
          ...SWAP_TRANSACTION_TYPES,
        ],
      ]
    );

    const entries = res.rows.map((row) => {
      const details = parseDetails(row.details);
      const sourceUserId = typeof details.source_user_id === "string" ? details.source_user_id : null;

      return {
        id: String(row.id),
        amount: Number(row.amount),
        txType: row.tx_type,
        status: row.status,
        // A ledger key can be synthetic when one BSC transaction emitted more
        // than one Transfer log. The canonical chain hash stays in details.
        txHash: details.chain_tx_hash || row.tx_hash,
        symbol: row.symbol ?? "USDT",
        details,
        createdAt: row.created_at,
        sourceUser: sourceUserId
          ? {
              id: sourceUserId,
              nickname: row.source_nickname ?? null,
            }
          : null,
      };
    });

    // The transactions tab is reserved for user-facing wallet movement only.
    const transactions = entries.filter((entry) => {
      if (entry.txType === "WITHDRAW") {
        return typeof entry.details.address === "string" && entry.details.address.length > 0;
      }

      return entry.txType === "DEPOSIT" && (
        entry.details.source === "on_chain" || isOnChainTransactionHash(entry.txHash)
      );
    });

    const bonuses = entries.filter((entry) => BONUS_TRANSACTION_TYPES.has(entry.txType));
    const swaps = entries.filter((entry) => SWAP_TRANSACTION_TYPES.has(entry.txType));

    return NextResponse.json({
      success: true,
      transactions,
      bonuses,
      swaps,
    });
  } catch (error: unknown) {
    console.error("History query failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load history" }, { status: 500 });
  }
}
