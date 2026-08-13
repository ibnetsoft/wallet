import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";
import { getProduct } from "@/lib/products";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const { level } = await req.json();
    const product = getProduct(level);
    if (!product) {
      return NextResponse.json({ success: false, error: "Invalid product" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userRes = await client.query(
        `UPDATE public.users
         SET status = 'ACTIVE',
             recommender_id = COALESCE(recommender_id, parent_id)
         WHERE id = $1
         RETURNING id`,
        [user.id]
      );
      if (userRes.rows.length === 0) {
        throw new Error("User profile not found");
      }

      const assetsRes = await client.query(
        `SELECT id, symbol FROM public.assets WHERE symbol IN ('USDT', 'JADE', 'URC', 'HONGBAO')`
      );
      const assets = Object.fromEntries(assetsRes.rows.map((asset) => [asset.symbol, Number(asset.id)]));
      if (!assets.USDT || !assets.JADE || !assets.HONGBAO) {
        throw new Error("System assets are not configured");
      }

      const usdtBalance = await client.query(
        `UPDATE public.user_balances
         SET available_balance = available_balance - $1, updated_at = NOW()
         WHERE user_id = $2
           AND asset_id = $3
           AND available_balance >= $1
         RETURNING available_balance`,
        [product.price, user.id, assets.USDT]
      );
      if (usdtBalance.rows.length === 0) {
        throw new Error("Insufficient USDT balance");
      }

      const creditBalance = async (assetId: number, amount: number) => {
        if (amount <= 0) return;
        await client.query(
          `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
           VALUES ($1, $2, $3, 0, NOW())
           ON CONFLICT (user_id, asset_id) DO UPDATE
             SET available_balance = public.user_balances.available_balance + EXCLUDED.available_balance,
                 updated_at = NOW()`,
          [user.id, assetId, amount]
        );
      };

      const addLedger = async (assetId: number, amount: number, txType: "PACKAGE_BUY" | "PACKAGE_BONUS") => {
        if (amount === 0) return;
        await client.query(
          `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
           VALUES ($1, $2, $3, $4, 'COMPLETED')`,
          [user.id, assetId, txType, amount]
        );
      };

      await creditBalance(assets.JADE, product.jadeBonus);
      await creditBalance(assets.URC, product.urcBonus);
      await creditBalance(assets.HONGBAO, product.hongbaoBonus);
      await addLedger(assets.USDT, -product.price, "PACKAGE_BUY");
      await addLedger(assets.JADE, product.jadeBonus, "PACKAGE_BONUS");
      await addLedger(assets.URC, product.urcBonus, "PACKAGE_BONUS");
      await addLedger(assets.HONGBAO, product.hongbaoBonus, "PACKAGE_BONUS");

      const machineRes = await client.query(
        `INSERT INTO public.user_game_machines
           (user_id, package_level, purchase_price, total_entry_limit, payout_limit_usd)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [user.id, product.level, product.price, product.entryLimit, product.payoutLimit]
      );

      await client.query(`SELECT public.settle_machine_purchase($1)`, [machineRes.rows[0].id]);
      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Package purchased successfully",
        product,
        balances: {
          USDT: Number(usdtBalance.rows[0].available_balance),
          JADE: product.jadeBonus,
          URC: product.urcBonus,
          HONGBAO: product.hongbaoBonus,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error("Purchase error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Purchase failed" },
      { status: 400 }
    );
  }
}
