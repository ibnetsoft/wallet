import * as dotenv from 'dotenv';
import * as cron from 'node-cron';
import { Pool, PoolClient } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.error('🔴 DATABASE_URL is missing in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ─────────────────────────────────────────────────
//  Bonus Rate Constants (v1.1 Spec)
// ─────────────────────────────────────────────────
const DIRECT_REFERRAL_BONUS_RATE = 0.20;  // 추천 보너스: 20%
const FOSTER_BONUS_RATE          = 0.10;  // 육성 보너스: 10% (후원계보 1대)
const IMMA_BONUS_RATE            = 0.05;  // 임마 보너스: 5%  (후원계보 2대)
const CHEOTAN_BONUS_RATE         = 0.03;  // 최탄 보너스: 3%  (후원계보 3대)

// Rank thresholds (1대 추천인 게임기 매출 기준)
const RANK_THRESHOLDS = [
  { stars: 3, minRevenue: 30000 },
  { stars: 2, minRevenue: 10000 },
  { stars: 1, minRevenue: 3000  },
  { stars: 0, minRevenue: 0     },
];

// ─────────────────────────────────────────────────
//  Helper: Credit Bonus (aligned with actual DB schema)
// ─────────────────────────────────────────────────
async function creditBonus(
  client: PoolClient,
  userId: string,
  assetId: number,
  amount: number,
  txType: string,
  description: string
) {
  // Insert ledger entry using actual schema columns: tx_type, details (JSONB)
  await client.query(
    `INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
     VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6::jsonb)`,
    [
      userId,
      assetId,
      amount.toFixed(4),
      txType,
      `BONUS-${Date.now()}-${userId.substring(0, 8)}`,
      JSON.stringify({ description })
    ]
  );

  // Upsert user balance — actual schema uses available_balance, not balance
  await client.query(
    `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
     VALUES ($1, $2, $3, 0, NOW())
     ON CONFLICT (user_id, asset_id)
     DO UPDATE SET available_balance = user_balances.available_balance + EXCLUDED.available_balance,
                   updated_at = NOW()`,
    [userId, assetId, amount.toFixed(4)]
  );
}

// ─────────────────────────────────────────────────
//  Core Settlement Function
// ─────────────────────────────────────────────────
async function runDailySettlement() {
  const settlementDate = new Date().toISOString().split('T')[0];
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📅 [SETTLEMENT] Daily Close: ${settlementDate} (KST 00:00)`);
  console.log(`${'═'.repeat(60)}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve USDT asset_id (INT in actual schema)
    const assetRes = await client.query(
      `SELECT id FROM public.assets WHERE symbol = 'USDT' LIMIT 1`
    );
    if (assetRes.rows.length === 0) throw new Error('USDT asset not found.');
    const usdtAssetId: number = assetRes.rows[0].id;

    // 1. Fetch unprocessed game machine purchases
    //    Note: placement_id was added by the activation trigger migration
    console.log('\n[1/5] Fetching unprocessed game machine purchases...');
    const purchasesRes = await client.query(`
      SELECT
        ugm.id             AS machine_id,
        ugm.user_id        AS buyer_id,
        ugm.purchase_price,
        u.parent_id        AS sponsor_id
      FROM public.user_game_machines ugm
      JOIN public.users u ON u.id = ugm.user_id
      WHERE ugm.bonus_settled = FALSE
        AND ugm.created_at::date <= CURRENT_DATE
    `);

    console.log(`   ✅ Found ${purchasesRes.rows.length} unprocessed purchases.`);

    let totalBonusPaid = 0;

    for (const purchase of purchasesRes.rows) {
      const { machine_id, buyer_id, purchase_price, sponsor_id } = purchase;
      const price = Number(purchase_price);

      console.log(`\n   → Processing machine ${machine_id} | Price: $${price}`);

      // ── (A) 추천 보너스 20% ─────────────────────────────────────────
      if (sponsor_id) {
        const directBonus = price * DIRECT_REFERRAL_BONUS_RATE;
        await creditBonus(client, sponsor_id, usdtAssetId, directBonus,
          'REFERRAL_BONUS', `추천 보너스 20% from machine ${machine_id}`);
        
        // Accumulate sales revenue on sponsor for rank calculation
        await client.query(
          `UPDATE public.users SET accumulated_revenue = accumulated_revenue + $1 WHERE id = $2`,
          [price, sponsor_id]
        );
        totalBonusPaid += directBonus;
        console.log(`      💰 Referral: +$${directBonus.toFixed(2)} → ${sponsor_id.substring(0, 8)}...`);

        // Get sponsor's placement_id (added by activation trigger migration)
        const sponsorRes = await client.query(
          `SELECT placement_id FROM public.users WHERE id = $1`,
          [sponsor_id]
        );
        const placement1Id = sponsorRes.rows[0]?.placement_id;

        // ── (B) 육성 보너스 10% (후원계보 1대) ─────────────────────────
        if (placement1Id) {
          const fosterBonus = price * FOSTER_BONUS_RATE;
          await creditBonus(client, placement1Id, usdtAssetId, fosterBonus,
            'RANK_BONUS', `육성 보너스 10% from machine ${machine_id}`);
          totalBonusPaid += fosterBonus;
          console.log(`      💰 Foster:   +$${fosterBonus.toFixed(2)} → ${placement1Id.substring(0, 8)}...`);

          // ── (C) 임마 보너스 5% (후원계보 2대) ──────────────────────
          const p1Res = await client.query(
            `SELECT placement_id FROM public.users WHERE id = $1`,
            [placement1Id]
          );
          const placement2Id = p1Res.rows[0]?.placement_id;
          if (placement2Id) {
            const immaBonus = price * IMMA_BONUS_RATE;
            await creditBonus(client, placement2Id, usdtAssetId, immaBonus,
              'RANK_BONUS', `임마 보너스 5% from machine ${machine_id}`);
            totalBonusPaid += immaBonus;
            console.log(`      💰 Imma:     +$${immaBonus.toFixed(2)} → ${placement2Id.substring(0, 8)}...`);

            // ── (D) 최탄 보너스 3% (후원계보 3대) ─────────────────────
            const p2Res = await client.query(
              `SELECT placement_id FROM public.users WHERE id = $1`,
              [placement2Id]
            );
            const placement3Id = p2Res.rows[0]?.placement_id;
            if (placement3Id) {
              const cheotanBonus = price * CHEOTAN_BONUS_RATE;
              await creditBonus(client, placement3Id, usdtAssetId, cheotanBonus,
                'CHOITAN_BONUS', `최탄 보너스 3% from machine ${machine_id}`);
              totalBonusPaid += cheotanBonus;
              console.log(`      💰 Cheotan:  +$${cheotanBonus.toFixed(2)} → ${placement3Id.substring(0, 8)}...`);
            }
          }
        }
      }

      // Mark purchase as bonus_settled
      await client.query(
        `UPDATE public.user_game_machines SET bonus_settled = TRUE WHERE id = $1`,
        [machine_id]
      );
    }

    // 2. Update Star Ranks for all active users
    console.log(`\n[2/5] Recalculating star levels for all active users...`);
    const usersRes = await client.query(
      `SELECT id, accumulated_revenue, star_level FROM public.users WHERE status = 'ACTIVE'`
    );

    let rankUpdated = 0;
    for (const user of usersRes.rows) {
      const revenue = Number(user.accumulated_revenue);
      const newStars = RANK_THRESHOLDS.find(r => revenue >= r.minRevenue)?.stars ?? 0;
      if (newStars !== Number(user.star_level)) {
        await client.query(
          `UPDATE public.users SET star_level = $1 WHERE id = $2`,
          [newStars, user.id]
        );
        rankUpdated++;
        console.log(`   ★ Rank update: ${user.id.substring(0, 8)}... → ${newStars}-Star ($${revenue})`);
      }
    }
    console.log(`   ✅ ${rankUpdated} user rank(s) updated.`);

    // 3. Log settlement summary — note: ledger requires user_id NOT NULL per schema
    //    So we skip the global audit entry and just log to console.
    await client.query('COMMIT');

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ Settlement COMPLETE: ${settlementDate}`);
    console.log(`   Total Bonuses Distributed: $${totalBonusPaid.toFixed(2)} USDT`);
    console.log(`   Purchases settled: ${purchasesRes.rows.length}`);
    console.log(`   Ranks updated: ${rankUpdated}`);
    console.log(`${'═'.repeat(60)}\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n🔴 SETTLEMENT FAILED — Transaction rolled back:`, err);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────
//  Main: Cron Scheduler
// ─────────────────────────────────────────────────
async function main() {
  console.log('🕐 369 Daily Settlement Cron Daemon started.');
  console.log('   Schedule: Every day at 00:00 KST (15:00 UTC)');

  try {
    const res = await pool.query('SELECT NOW() AS now');
    console.log(`✅ Database connected. Server time: ${res.rows[0].now}`);
  } catch (err) {
    console.error('🔴 Cannot connect to database:', err);
    process.exit(1);
  }

  // Schedule: 00:00 KST = 15:00 UTC
  cron.schedule('0 15 * * *', async () => {
    console.log('\n⏰ Cron triggered: Running daily settlement now...');
    await runDailySettlement();
  }, { timezone: 'UTC' });

  console.log('\n⌛ Cron daemon is waiting for next scheduled run at 15:00 UTC (00:00 KST)...');

  if (process.env.RUN_NOW === 'true') {
    console.log('\n🧪 RUN_NOW=true — running settlement immediately for testing...');
    await runDailySettlement();
  }
}

main().catch(err => {
  console.error('Fatal error in Settlement Cron:', err);
  process.exit(1);
});
