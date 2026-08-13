-- QA-only repair script. Run this only after confirming that QAANTZ01 is the
-- intended direct recommender of QAT3A01. It does not create or settle users.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE nickname = 'QAT3A01')
    OR NOT EXISTS (SELECT 1 FROM public.users WHERE nickname = 'QAANTZ01') THEN
    RAISE EXCEPTION 'Required QA users QAT3A01 and QAANTZ01 must both exist';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT recommender_id AS id, ARRAY[recommender_id]::UUID[] AS path
      FROM public.users
      WHERE nickname = 'QAANTZ01'
        AND recommender_id IS NOT NULL

      UNION ALL

      SELECT parent.recommender_id, ancestors.path || parent.recommender_id
      FROM ancestors
      JOIN public.users AS parent ON parent.id = ancestors.id
      WHERE parent.recommender_id IS NOT NULL
        AND NOT (parent.recommender_id = ANY(ancestors.path))
    )
    SELECT 1
    FROM ancestors
    WHERE id = (SELECT id FROM public.users WHERE nickname = 'QAT3A01')
  ) THEN
    RAISE EXCEPTION 'QAANTZ01 is already below QAT3A01; refusing to create a referral cycle';
  END IF;
END;
$$;

UPDATE public.users AS child
SET parent_id = parent.id,
    recommender_id = parent.id
FROM public.users AS parent
WHERE child.nickname = 'QAT3A01'
  AND parent.nickname = 'QAANTZ01';

SELECT public.rebuild_sponsor_placements(
  (SELECT id FROM public.users WHERE nickname = 'QAANTZ01')
);

-- Expected after the hierarchy repair:
-- QAT3A01's 3rd/6th/9th direct referrals are still direct referrals of
-- QAT3A01, but their sponsor_id becomes QAANTZ01 (then higher ancestors).
SELECT
  member.nickname,
  member.referral_seq,
  recommender.nickname AS recommender,
  sponsor.nickname AS sponsor
FROM public.users AS member
LEFT JOIN public.users AS recommender ON recommender.id = member.recommender_id
LEFT JOIN public.users AS sponsor ON sponsor.id = member.sponsor_id
WHERE member.recommender_id = (
  SELECT id FROM public.users WHERE nickname = 'QAT3A01'
)
ORDER BY member.referral_seq, member.created_at, member.id;

COMMIT;
