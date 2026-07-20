import * as dotenv from 'dotenv';
import * as cron from 'node-cron';
import { Pool, PoolClient } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) { console.error('🔴 DATABASE_URL missing'); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ═══════════════════════════════════════════════════════════
//  BONUS CONSTANTS  (v1.1 Final Spec)
// ═══════════════════════════════════════════════════════════
const REFERRAL_BONUS_RATE = 0.20;   // 추천보너스: 직추천 1대 매출의 20%
const FOSTER_BONUS_RATE   = 0.10;   // 육성보너스: 후원 1대 매출의 10%
// 엄마보너스: 육성보너스 금액의 100% 매칭 (별도 상수 불필요)
const CHEOTAN_POOL_RATE   = 0.10;   // 최탄보너스 pool: 전체 매출의 10%

// 최탄티켓 부여 (package_level 기준)
const CHEOTAN_TICKETS: Record<number, number> = {
  1: 0, // $100 → 0장
  2: 1, // $500 → 1장
  3: 3, // $1,000 → 3장
};

// 직급보너스 풀 (전체 매출 대비 %, 최소 직급 이상 모두 참여)
const RANK_BONUS_POOLS = [
  { pool: '1star', rate: 0.05, minStars: 1 }, // 1스타 이상 전체, 5%
  { pool: '2star', rate: 0.04, minStars: 2 }, // 2스타 이상, 4%
  { pool: '3star', rate: 0.03, minStars: 3 }, // 3스타 이상, 3%
  { pool: '4star', rate: 0.01, minStars: 4 }, // 4스타 이상, 1%
  { pool: '5star', rate: 0.01, minStars: 5 }, // 5스타 이상, 1%
  { pool: '6star', rate: 0.01, minStars: 6 }, // 6스타 이상, 1%
  { pool: '7star', rate: 0.01, minStars: 7 }, // 7스타만, 1%
];

// 직급 달성 기준 (직추천 산하 누적 매출, 한번 달성 시 유지)
const RANK_THRESHOLDS = [
  { stars: 7, minRevenue: 1_000_000 },
  { stars: 6, minRevenue:   300_000 },
  { stars: 5, minRevenue:   100_000 },
  { stars: 4, minRevenue:    30_000 },
  { stars: 3, minRevenue:    10_000 },
  { stars: 2, minRevenue:     3_000 },
  { stars: 1, minRevenue:     1_000 },
  { stars: 0, minRevenue:         0 },
];

// ═══════════════════════════════════════════════════════════
//  HELPER: Credit bonus to user (ledger + balance upsert)
// ═══════════════════════════════════════════════════════════
async function creditBonus(
  client: PoolClient,
  userId: string,
  assetId: number,
  amount: number,
  txType: string,
  description: string,
  dedupeKey?: string
) {
  if (amount <= 0) return;
  const txHash = dedupeKey ?? `${txType}-${Date.now()}-${userId.substring(0, 8)}-${Math.random().toString(36).slice(2, 7)}`;

  await client.query(
    `INSERT INTO public.ledger_entries (user_id, asset_id, amount, tx_type, status, tx_hash, details)
     VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6::jsonb)
     ON CONFLICT (tx_hash) DO NOTHING`,
    [userId, assetId, amount.toFixed(4), txType, txHash, JSON.stringify({ description })]
  );

  await client.query(
    `INSERT INTO public.user_balances (user_id, asset_id, available_balance, locked_balance, updated_at)
     VALUES ($1, $2, $3, 0, NOW())
     ON CONFLICT (user_id, asset_id)
     DO UPDATE SET available_balance = user_balances.available_balance + EXCLUDED.available_balance,
                   updated_at = NOW()`,
    [userId, assetId, amount.toFixed(4)]
  );
}

// ═══════════════════════════════════════════════════════════
//  HELPER: Trigger 엄마보너스 (2 cases) after 육성보너스
// ═══════════════════════════════════════════════════════════
async function triggerMamaBonus(
  client: PoolClient,
  fosterRecipientId: string,  // 육성보너스를 받은 사람
  fosterAmount: number,        // 육성보너스 금액
  assetId: number,
  machineId: string
) {
  // 육성보너스 수령자의 recommender_id와 original_recommender_id 조회
  const res = await client.query(
    `SELECT recommender_id, original_recommender_id FROM public.users WHERE id = $1`,
    [fosterRecipientId]
  );
  if (!res.rows.length) return;

  const { recommender_id, original_recommender_id } = res.rows[0];

  // 케이스 1: 육성보너스 수령자의 직추천 스폰서(recommender)에게 100% 매칭
  if (recommender_id) {
    await creditBonus(
      client, recommender_id, assetId, fosterAmount, 'MAMA_BONUS',
      `엄마보너스 (100% 매칭 from ${fosterRecipientId.substring(0,8)}) - machine ${machineId}`,
      `MAMA1-${machineId}-${recommender_id.substring(0,8)}`
    );
    console.log(`      🤱 엄마보너스 [케이스1]: +$${fosterAmount.toFixed(2)} → recommender ${recommender_id.substring(0,8)}...`);
  }

  // 케이스 2: 육성보너스 수령자가 롤업(3,6,9)으로 배속된 경우, 원래 추천인에게도 100% 매칭
  // original_recommender_id는 recommender_id와 다를 때만 존재 (롤업으로 sponsor가 바뀐 경우)
  if (original_recommender_id && original_recommender_id !== recommender_id) {
    await creditBonus(
      client, original_recommender_id, assetId, fosterAmount, 'MAMA_BONUS',
      `엄마보너스 (롤업 원추천인 매칭 from ${fosterRecipientId.substring(0,8)}) - machine ${machineId}`,
      `MAMA2-${machineId}-${original_recommender_id.substring(0,8)}`
    );
    console.log(`      🤱 엄마보너스 [케이스2]: +$${fosterAmount.toFixed(2)} → original_recommender ${original_recommender_id.substring(0,8)}...`);
  }
}

// ═══════════════════════════════════════════════════════════
//  STEP 1: Process individual purchase bonuses (real-time style)
//  추천보너스 20% + 육성보너스 10% + 엄마보너스 100% 매칭
// ═══════════════════════════════════════════════════════════
async function processReferralAndFosterBonuses(
  client: PoolClient,
  usdtAssetId: number
): Promise<{ count: number; totalPaid: number }> {
  const purchasesRes = await client.query(`
    SELECT
      ugm.id              AS machine_id,
      ugm.purchase_price,
      ugm.package_level,
      u.recommender_id,
      u.sponsor_id
    FROM public.user_game_machines ugm
    JOIN public.users u ON u.id = ugm.user_id
    WHERE ugm.bonus_settled = FALSE
      AND ugm.created_at::date <= CURRENT_DATE
  `);

  console.log(`   ✅ Found ${purchasesRes.rows.length} unprocessed purchase(s).`);
  let totalPaid = 0;

  for (const p of purchasesRes.rows) {
    const { machine_id, purchase_price, package_level, recommender_id, sponsor_id } = p;
    const price = Number(purchase_price);
    console.log(`\n   → machine ${machine_id} | $${price} | pkg_level ${package_level}`);

    // ── 추천보너스 20% → recommender_id ──────────────────────────
    if (recommender_id) {
      const referralBonus = price * REFERRAL_BONUS_RATE;
      await creditBonus(
        client, recommender_id, usdtAssetId, referralBonus, 'REFERRAL_BONUS',
        `추천보너스 20% from machine ${machine_id}`,
        `REF-${machine_id}`
      );
      // 추천인의 accumulated_revenue 누적 (직급 산정 기준)
      await client.query(
        `UPDATE public.users SET accumulated_revenue = accumulated_revenue + $1 WHERE id = $2`,
        [price, recommender_id]
      );
      totalPaid += referralBonus;
      console.log(`      💰 추천보너스: +$${referralBonus.toFixed(2)} → ${recommender_id.substring(0,8)}...`);
    }

    // ── 육성보너스 10% → sponsor_id → 즉시 엄마보너스 발주 ────────
    if (sponsor_id) {
      const fosterBonus = price * FOSTER_BONUS_RATE;
      await creditBonus(
        client, sponsor_id, usdtAssetId, fosterBonus, 'FOSTER_BONUS',
        `육성보너스 10% from machine ${machine_id}`,
        `FOSTER-${machine_id}`
      );
      totalPaid += fosterBonus;
      console.log(`      💰 육성보너스: +$${fosterBonus.toFixed(2)} → sponsor ${sponsor_id.substring(0,8)}...`);

      // 엄마보너스 이중 발주 (육성보너스 수령 즉시)
      await triggerMamaBonus(client, sponsor_id, fosterBonus, usdtAssetId, machine_id);
      totalPaid += fosterBonus; // 엄마보너스는 최대 2건, 여기선 합산용으로 1배만 (실제 지급은 triggerMamaBonus 내에서)
    }

    // 최탄 티켓 수량 기록 (일마감 최탄보너스 분배용)
    const tickets = CHEOTAN_TICKETS[Number(package_level)] ?? 0;
    if (tickets > 0) {
      await client.query(
        `UPDATE public.user_game_machines SET cheotan_tickets = $1 WHERE id = $2`,
        [tickets, machine_id]
      );
    }

    // 정산 완료 플래그
    await client.query(
      `UPDATE public.user_game_machines SET bonus_settled = TRUE WHERE id = $1`,
      [machine_id]
    );
  }

  return { count: purchasesRes.rows.length, totalPaid };
}

// ═══════════════════════════════════════════════════════════
//  STEP 2: 직급(Star Rank) 갱신
//  accumulated_revenue 기준, 한번 달성하면 유지 (하향 없음)
// ═══════════════════════════════════════════════════════════
async function updateStarRanks(client: PoolClient): Promise<number> {
  const usersRes = await client.query(
    `SELECT id, accumulated_revenue, star_level FROM public.users WHERE status = 'ACTIVE'`
  );

  let updated = 0;
  for (const user of usersRes.rows) {
    const revenue = Number(user.accumulated_revenue);
    const currentStars = Number(user.star_level);
    const newStars = RANK_THRESHOLDS.find(r => revenue >= r.minRevenue)?.stars ?? 0;

    // 직급은 상향만 가능 (하향 없음)
    if (newStars > currentStars) {
      await client.query(
        `UPDATE public.users SET star_level = $1 WHERE id = $2`,
        [newStars, user.id]
      );
      updated++;
      console.log(`   ★ Rank UP: ${user.id.substring(0,8)}... | ${currentStars}→${newStars}-Star (누적 $${revenue.toLocaleString()})`);
    }
  }
  return updated;
}

// ═══════════════════════════════════════════════════════════
//  STEP 3: 최탄보너스 (일마감)
//  전체 일일 매출 × 10% → 최탄티켓 보유 비율로 분배
// ═══════════════════════════════════════════════════════════
async function settleCheotanBonus(
  client: PoolClient,
  usdtAssetId: number,
  dailySalesTotal: number
): Promise<number> {
  if (dailySalesTotal <= 0) return 0;

  const cheotanPool = dailySalesTotal * CHEOTAN_POOL_RATE;

  // 최탄 보유 현황: 유저별 총 티켓 합산
  const ticketRes = await client.query(`
    SELECT ugm.user_id, SUM(ugm.cheotan_tickets) AS total_tickets
    FROM public.user_game_machines ugm
    JOIN public.users u ON u.id = ugm.user_id
    WHERE u.status = 'ACTIVE'
      AND ugm.cheotan_tickets > 0
    GROUP BY ugm.user_id
    HAVING SUM(ugm.cheotan_tickets) > 0
  `);

  const totalTickets = ticketRes.rows.reduce((sum: number, r: any) => sum + Number(r.total_tickets), 0);
  if (totalTickets === 0) {
    console.log('   ℹ️  최탄보너스: 최탄 보유자 없음, 건너뜀.');
    return 0;
  }

  console.log(`   최탄풀: $${cheotanPool.toFixed(2)} (총 ${totalTickets}장 보유)`);
  let totalPaid = 0;

  for (const row of ticketRes.rows) {
    const userTickets = Number(row.total_tickets);
    const share = cheotanPool * (userTickets / totalTickets);
    await creditBonus(
      client, row.user_id, usdtAssetId, share, 'CHEOTAN_BONUS',
      `최탄보너스: ${userTickets}/${totalTickets}장 × $${cheotanPool.toFixed(2)}`,
      `CHEOTAN-${new Date().toISOString().split('T')[0]}-${row.user_id.substring(0,8)}`
    );
    totalPaid += share;
    console.log(`      🎯 최탄: +$${share.toFixed(2)} (${userTickets}장) → ${row.user_id.substring(0,8)}...`);
  }
  return totalPaid;
}

// ═══════════════════════════════════════════════════════════
//  STEP 4: 직급보너스 7-Pool 분배 (일마감)
// ═══════════════════════════════════════════════════════════
async function settleRankBonuses(
  client: PoolClient,
  usdtAssetId: number,
  dailySalesTotal: number
): Promise<number> {
  if (dailySalesTotal <= 0) return 0;

  let totalPaid = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const pool of RANK_BONUS_POOLS) {
    const poolAmount = dailySalesTotal * pool.rate;

    // 해당 pool 자격자: minStars 이상인 ACTIVE 유저
    const eligibleRes = await client.query(
      `SELECT id FROM public.users WHERE status = 'ACTIVE' AND star_level >= $1`,
      [pool.minStars]
    );
    const n = eligibleRes.rows.length;
    if (n === 0) {
      console.log(`   ℹ️  ${pool.pool} pool ($${poolAmount.toFixed(2)}): 자격자 없음`);
      continue;
    }

    const perPerson = poolAmount / n;
    console.log(`   🌟 ${pool.pool} pool: $${poolAmount.toFixed(2)} ÷ ${n}명 = $${perPerson.toFixed(2)}/인`);

    for (const user of eligibleRes.rows) {
      await creditBonus(
        client, user.id, usdtAssetId, perPerson, 'RANK_STAR_BONUS',
        `직급보너스 ${pool.pool} (${pool.rate * 100}%/${n}명)`,
        `RANK-${pool.pool}-${today}-${user.id.substring(0,8)}`
      );
      totalPaid += perPerson;
    }
  }
  return totalPaid;
}

// ═══════════════════════════════════════════════════════════
//  MAIN SETTLEMENT RUNNER
// ═══════════════════════════════════════════════════════════
async function runDailySettlement() {
  const settlementDate = new Date().toISOString().split('T')[0];
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`📅 [SETTLEMENT] Daily Close: ${settlementDate} (KST 00:00)`);
  console.log(`${'═'.repeat(64)}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve USDT asset id
    const assetRes = await client.query(`SELECT id FROM public.assets WHERE symbol = 'USDT' LIMIT 1`);
    if (!assetRes.rows.length) throw new Error('USDT asset not found');
    const usdtAssetId: number = assetRes.rows[0].id;

    // --- Step 1: 추천/육성/엄마 보너스 ---
    console.log('\n[1/4] 추천보너스 + 육성보너스 + 엄마보너스 처리...');
    const { count: purchaseCount, totalPaid: step1Paid } =
      await processReferralAndFosterBonuses(client, usdtAssetId);

    // 오늘 하루 전체 게임기 매출 합산 (최탄/직급보너스 기준)
    const salesRes = await client.query(`
      SELECT COALESCE(SUM(purchase_price), 0) AS total
      FROM public.user_game_machines
      WHERE created_at::date = CURRENT_DATE
    `);
    const dailySalesTotal = Number(salesRes.rows[0].total);
    console.log(`\n   📊 오늘 일일 총 매출: $${dailySalesTotal.toLocaleString()}`);

    // --- Step 2: 직급 갱신 ---
    console.log('\n[2/4] 직급(Star Rank) 갱신...');
    const rankUpdated = await updateStarRanks(client);
    console.log(`   ✅ ${rankUpdated}명 직급 상향.`);

    // --- Step 3: 최탄보너스 ---
    console.log('\n[3/4] 최탄보너스 분배...');
    const cheotanPaid = await settleCheotanBonus(client, usdtAssetId, dailySalesTotal);

    // --- Step 4: 직급보너스 7-Pool ---
    console.log('\n[4/4] 직급보너스 7-Pool 분배...');
    const rankBonusPaid = await settleRankBonuses(client, usdtAssetId, dailySalesTotal);

    await client.query('COMMIT');

    const grandTotal = step1Paid + cheotanPaid + rankBonusPaid;
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`✅ SETTLEMENT COMPLETE: ${settlementDate}`);
    console.log(`   구매 건수 처리:        ${purchaseCount}건`);
    console.log(`   직급 상향:             ${rankUpdated}명`);
    console.log(`   추천/육성/엄마:        $${step1Paid.toFixed(2)}`);
    console.log(`   최탄보너스:            $${cheotanPaid.toFixed(2)}`);
    console.log(`   직급보너스:            $${rankBonusPaid.toFixed(2)}`);
    console.log(`   ─────────────────────────────────`);
    console.log(`   총 지급액:             $${grandTotal.toFixed(2)} USDT`);
    console.log(`${'═'.repeat(64)}\n`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n🔴 SETTLEMENT FAILED — ROLLED BACK:`, err);
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN ENTRY
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('🕐 369 Daily Settlement Cron Daemon v2.0 started.');

  try {
    const res = await pool.query('SELECT NOW() AS now');
    console.log(`✅ DB connected. Server time: ${res.rows[0].now}`);
  } catch (err) {
    console.error('🔴 DB connection failed:', err);
    process.exit(1);
  }

  // 매일 KST 00:00 = UTC 15:00 실행
  cron.schedule('0 15 * * *', async () => {
    console.log('\n⏰ Cron triggered (00:00 KST)');
    await runDailySettlement();
  }, { timezone: 'UTC' });

  console.log('⌛ Waiting for next run at 15:00 UTC (00:00 KST)...');

  if (process.env.RUN_NOW === 'true') {
    console.log('\n🧪 RUN_NOW=true — 즉시 테스트 실행');
    await runDailySettlement();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
