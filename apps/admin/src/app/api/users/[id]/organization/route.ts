import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MemberRow = {
  id: string;
  email: string;
  nickname: string;
  status: string;
  created_at: string;
  recommender_id: string | null;
  sponsor_id: string | null;
  original_recommender_id: string | null;
  referral_seq: string | number;
  total_purchase: string | number;
  recommender_nickname: string | null;
  sponsor_nickname: string | null;
  is_rollup: boolean;
  depth?: string | number;
};

function toMember(row: MemberRow) {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname || row.email,
    status: row.status,
    createdAt: row.created_at,
    recommenderId: row.recommender_id,
    recommenderName: row.recommender_nickname,
    sponsorId: row.sponsor_id,
    sponsorName: row.sponsor_nickname,
    originalRecommenderId: row.original_recommender_id,
    referralSeq: Number(row.referral_seq ?? 0),
    totalPurchase: Number(row.total_purchase ?? 0),
    isRollup: Boolean(row.is_rollup),
    ...(row.depth === undefined ? {} : { depth: Number(row.depth) }),
  };
}

const memberColumns = `
  u.id,
  u.email,
  COALESCE(NULLIF(u.nickname, ''), u.email) AS nickname,
  u.status,
  u.created_at,
  u.recommender_id,
  u.sponsor_id,
  u.original_recommender_id,
  u.referral_seq,
  COALESCE(recommender.nickname, recommender.email) AS recommender_nickname,
  COALESCE(sponsor.nickname, sponsor.email) AS sponsor_nickname,
  COALESCE(machine_totals.total_purchase, 0) AS total_purchase,
  (
    u.status = 'ACTIVE'
    AND u.sponsor_id IS NOT NULL
    AND u.sponsor_id IS DISTINCT FROM u.recommender_id
  ) AS is_rollup
`;

const memberJoins = `
  LEFT JOIN public.users AS recommender ON recommender.id = u.recommender_id
  LEFT JOIN public.users AS sponsor ON sponsor.id = u.sponsor_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(purchase_price), 0) AS total_purchase
    FROM public.user_game_machines
    WHERE user_id = u.id
  ) AS machine_totals ON TRUE
`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId } = await params;
  if (!UUID_PATTERN.test(userId)) {
    return NextResponse.json({ success: false, error: "Invalid member ID" }, { status: 400 });
  }

  try {
    const client = await pool.connect();

    try {
      const memberResult = await client.query<MemberRow>(
        `SELECT ${memberColumns}
         FROM public.users AS u
         ${memberJoins}
         WHERE u.id = $1`,
        [userId]
      );

      if (memberResult.rowCount === 0) {
        return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
      }

      const directResult = await client.query<MemberRow>(
        `SELECT ${memberColumns}
         FROM public.users AS u
         ${memberJoins}
         WHERE u.recommender_id = $1
         ORDER BY
           CASE WHEN u.status = 'ACTIVE' THEN 0 ELSE 1 END,
           NULLIF(u.referral_seq, 0) NULLS LAST,
           u.created_at ASC,
           u.id ASC`,
        [userId]
      );

      const sponsorResult = await client.query<MemberRow>(
        `WITH RECURSIVE sponsor_tree AS (
           SELECT
             u.id,
             u.email,
             u.nickname,
             u.status,
             u.created_at,
             u.recommender_id,
             u.sponsor_id,
             u.original_recommender_id,
             u.referral_seq,
             1::INTEGER AS depth,
             ARRAY[u.id]::UUID[] AS path
           FROM public.users AS u
           WHERE u.sponsor_id = $1

           UNION ALL

           SELECT
             child.id,
             child.email,
             child.nickname,
             child.status,
             child.created_at,
             child.recommender_id,
             child.sponsor_id,
             child.original_recommender_id,
             child.referral_seq,
             sponsor_tree.depth + 1,
             sponsor_tree.path || child.id
           FROM sponsor_tree
           JOIN public.users AS child ON child.sponsor_id = sponsor_tree.id
           WHERE NOT (child.id = ANY(sponsor_tree.path))
         )
         SELECT
           sponsor_tree.id,
           sponsor_tree.email,
           COALESCE(NULLIF(sponsor_tree.nickname, ''), sponsor_tree.email) AS nickname,
           sponsor_tree.status,
           sponsor_tree.created_at,
           sponsor_tree.recommender_id,
           sponsor_tree.sponsor_id,
           sponsor_tree.original_recommender_id,
           sponsor_tree.referral_seq,
           COALESCE(recommender.nickname, recommender.email) AS recommender_nickname,
           COALESCE(sponsor.nickname, sponsor.email) AS sponsor_nickname,
           COALESCE(machine_totals.total_purchase, 0) AS total_purchase,
           (
             sponsor_tree.status = 'ACTIVE'
             AND sponsor_tree.sponsor_id IS NOT NULL
             AND sponsor_tree.sponsor_id IS DISTINCT FROM sponsor_tree.recommender_id
           ) AS is_rollup,
           sponsor_tree.depth
         FROM sponsor_tree
         LEFT JOIN public.users AS recommender ON recommender.id = sponsor_tree.recommender_id
         LEFT JOIN public.users AS sponsor ON sponsor.id = sponsor_tree.sponsor_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(purchase_price), 0) AS total_purchase
           FROM public.user_game_machines
           WHERE user_id = sponsor_tree.id
         ) AS machine_totals ON TRUE
         ORDER BY sponsor_tree.path`,
        [userId]
      );

      const ancestorsResult = await client.query<MemberRow>(
        `WITH RECURSIVE sponsor_ancestors AS (
           SELECT
             u.id,
             u.email,
             u.nickname,
             u.status,
             u.created_at,
             u.recommender_id,
             u.sponsor_id,
             u.original_recommender_id,
             u.referral_seq,
             0::INTEGER AS depth,
             ARRAY[u.id]::UUID[] AS path
           FROM public.users AS u
           WHERE u.id = $1

           UNION ALL

           SELECT
             parent.id,
             parent.email,
             parent.nickname,
             parent.status,
             parent.created_at,
             parent.recommender_id,
             parent.sponsor_id,
             parent.original_recommender_id,
             parent.referral_seq,
             sponsor_ancestors.depth + 1,
             sponsor_ancestors.path || parent.id
           FROM sponsor_ancestors
           JOIN public.users AS parent ON parent.id = sponsor_ancestors.sponsor_id
           WHERE NOT (parent.id = ANY(sponsor_ancestors.path))
         )
         SELECT
           sponsor_ancestors.id,
           sponsor_ancestors.email,
           COALESCE(NULLIF(sponsor_ancestors.nickname, ''), sponsor_ancestors.email) AS nickname,
           sponsor_ancestors.status,
           sponsor_ancestors.created_at,
           sponsor_ancestors.recommender_id,
           sponsor_ancestors.sponsor_id,
           sponsor_ancestors.original_recommender_id,
           sponsor_ancestors.referral_seq,
           COALESCE(recommender.nickname, recommender.email) AS recommender_nickname,
           COALESCE(sponsor.nickname, sponsor.email) AS sponsor_nickname,
           COALESCE(machine_totals.total_purchase, 0) AS total_purchase,
           (
             sponsor_ancestors.status = 'ACTIVE'
             AND sponsor_ancestors.sponsor_id IS NOT NULL
             AND sponsor_ancestors.sponsor_id IS DISTINCT FROM sponsor_ancestors.recommender_id
           ) AS is_rollup,
           sponsor_ancestors.depth
         FROM sponsor_ancestors
         LEFT JOIN public.users AS recommender ON recommender.id = sponsor_ancestors.recommender_id
         LEFT JOIN public.users AS sponsor ON sponsor.id = sponsor_ancestors.sponsor_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(purchase_price), 0) AS total_purchase
           FROM public.user_game_machines
           WHERE user_id = sponsor_ancestors.id
         ) AS machine_totals ON TRUE
         WHERE sponsor_ancestors.depth > 0
         ORDER BY sponsor_ancestors.depth DESC`,
        [userId]
      );

      const directReferrals = directResult.rows.map(toMember);
      const sponsorTree = sponsorResult.rows.map(toMember);

      return NextResponse.json({
        success: true,
        organization: {
          member: toMember(memberResult.rows[0]),
          directReferrals,
          sponsorTree,
          sponsorAncestors: ancestorsResult.rows.map(toMember),
          summary: {
            directReferralCount: directReferrals.length,
            rolledUpDirectCount: directReferrals.filter((member) => member.isRollup).length,
            sponsorDescendantCount: sponsorTree.length,
          },
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("GET api/users/[id]/organization error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load the organization chart. Verify the referral and sponsor migration is applied.",
      },
      { status: 500 }
    );
  }
}
