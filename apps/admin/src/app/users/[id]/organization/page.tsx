"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  GitBranch,
  Network,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

type NetworkTab = "referral" | "sponsor";

interface OrganizationMember {
  id: string;
  email: string;
  nickname: string;
  status: string;
  createdAt: string;
  recommenderId: string | null;
  recommenderName: string | null;
  sponsorId: string | null;
  sponsorName: string | null;
  originalRecommenderId: string | null;
  referralSeq: number;
  totalPurchase: number;
  isRollup: boolean;
  depth?: number;
}

interface OrganizationData {
  member: OrganizationMember;
  directReferrals: OrganizationMember[];
  sponsorTree: OrganizationMember[];
  sponsorAncestors: OrganizationMember[];
  summary: {
    directReferralCount: number;
    rolledUpDirectCount: number;
    sponsorDescendantCount: number;
  };
}

function formatUsdt(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${
        active
          ? "border-[#0ECB81]/30 bg-[#0ECB81]/10 text-[#0ECB81]"
          : "border-[#FF9F0A]/30 bg-[#FF9F0A]/10 text-[#FF9F0A]"
      }`}
    >
      {active ? "활성" : "대기"}
    </span>
  );
}

function MemberCard({ member, showDepth = false }: { member: OrganizationMember; showDepth?: boolean }) {
  const thirdMultiple = member.status === "ACTIVE" && member.referralSeq > 0 && member.referralSeq % 3 === 0;

  return (
    <Link
      href={`/users/${member.id}/organization`}
      className="group block rounded-xl border border-[#26262B] bg-[#1C1C21] p-4 transition-colors hover:border-[#00D2FF]/60 hover:bg-[#202027]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-white">{member.nickname}</p>
            <ChevronRight size={14} className="shrink-0 text-[#8E8E93] transition-transform group-hover:translate-x-0.5 group-hover:text-[#00D2FF]" />
          </div>
          <p className="mt-1 truncate text-[11px] text-[#8E8E93]">{member.email}</p>
        </div>
        <StatusBadge status={member.status} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
        {showDepth ? (
          <span className="rounded bg-[#BF5AF2]/10 px-2 py-1 text-[#BF5AF2]">
            후원 {member.depth ?? 1}단계
          </span>
        ) : member.referralSeq > 0 ? (
          <span className="rounded bg-[#00D2FF]/10 px-2 py-1 text-[#00D2FF]">
            직추천 {member.referralSeq}번
          </span>
        ) : (
          <span className="rounded bg-[#8E8E93]/10 px-2 py-1 text-[#8E8E93]">활성화 대기</span>
        )}
        {member.isRollup ? (
          <span className="rounded bg-[#F0B90B]/10 px-2 py-1 text-[#F0B90B]">롤업 배치됨</span>
        ) : thirdMultiple ? (
          <span className="rounded bg-[#FF9F0A]/10 px-2 py-1 text-[#FF9F0A]">3배수, 상위 후원인 없음</span>
        ) : null}
      </div>

      <div className="mt-3 space-y-1.5 border-t border-[#26262B] pt-3 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-[#8E8E93]">원 추천인</span>
          <span className="truncate text-right font-semibold text-[#EAECEF]">{member.recommenderName ?? "없음"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#8E8E93]">최종 후원인</span>
          <span className={`truncate text-right font-semibold ${member.isRollup ? "text-[#F0B90B]" : "text-[#EAECEF]"}`}>
            {member.sponsorName ?? "미배치"}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#8E8E93]">누적 구매</span>
          <span className="font-mono font-bold text-[#30D5C8]">{formatUsdt(member.totalPurchase)} USDT</span>
        </div>
      </div>
    </Link>
  );
}

export default function UserOrganizationPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const [tab, setTab] = useState<NetworkTab>("referral");
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrganization = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/organization`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        success: boolean;
        organization?: OrganizationData;
        error?: string;
      };

      if (!response.ok || !result.success || !result.organization) {
        throw new Error(result.error || "조직도 데이터를 불러오지 못했습니다.");
      }

      setOrganization(result.organization);
    } catch (loadError) {
      setOrganization(null);
      setError(loadError instanceof Error ? loadError.message : "조직도 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadOrganization();
  }, [loadOrganization]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-[#8E8E93]">
        조직도 데이터를 불러오는 중입니다.
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pt-10">
        <div className="rounded-2xl border border-[#F6465D]/30 bg-[#F6465D]/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-[#F6465D]" size={20} />
            <div>
              <h2 className="font-bold text-white">조직도를 불러오지 못했습니다.</h2>
              <p className="mt-1 text-sm text-[#F2F2F7]">{error ?? "잠시 후 다시 시도해 주세요."}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href="/users" className="rounded-lg border border-[#26262B] bg-[#1C1C21] px-4 py-2 text-sm font-bold text-white hover:border-[#00D2FF]">
            회원 목록으로
          </Link>
          <button
            type="button"
            onClick={() => void loadOrganization()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00D2FF] px-4 py-2 text-sm font-bold text-[#0B0E11] hover:bg-[#38ddff]"
          >
            <RefreshCw size={15} />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const { member, directReferrals, sponsorTree, sponsorAncestors, summary } = organization;
  const currentMembers = tab === "referral" ? directReferrals : sponsorTree;

  return (
    <div className="mx-auto max-w-6xl space-y-6 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/users" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8E8E93] hover:text-[#00D2FF]">
            <ArrowLeft size={14} />
            회원 목록
          </Link>
          <h2 className="mt-3 flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <Network className="text-[#00D2FF]" size={24} />
            {member.nickname} 조직도
          </h2>
          <p className="mt-1 text-sm text-[#8E8E93]">직추천 관계와 실제 후원 배치를 분리해 확인합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrganization()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#26262B] bg-[#1C1C21] px-4 py-2.5 text-sm font-bold text-[#EAECEF] transition-colors hover:border-[#00D2FF] hover:text-[#00D2FF]"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-[#00D2FF]/20 bg-[#16161A] p-5 shadow-lg">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#00D2FF]/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-white">{member.nickname}</h3>
              <StatusBadge status={member.status} />
              {member.isRollup && <span className="rounded-full border border-[#F0B90B]/30 bg-[#F0B90B]/10 px-2 py-1 text-[10px] font-bold text-[#F0B90B]">롤업 회원</span>}
            </div>
            <p className="mt-1 text-sm text-[#8E8E93]">{member.email}</p>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-lg border border-[#26262B] bg-[#0C0C0E]/70 px-3 py-2.5">
                <p className="text-[#8E8E93]">원 추천인</p>
                <p className="mt-1 font-bold text-white">{member.recommenderName ?? "없음 (최상위)"}</p>
              </div>
              <div className="rounded-lg border border-[#26262B] bg-[#0C0C0E]/70 px-3 py-2.5">
                <p className="text-[#8E8E93]">최종 후원인</p>
                <p className="mt-1 font-bold text-[#00D2FF]">{member.sponsorName ?? "없음 (최상위)"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="min-w-[92px] rounded-xl border border-[#26262B] bg-[#0C0C0E]/70 p-3 text-center">
              <p className="text-[10px] text-[#8E8E93]">직추천</p>
              <p className="mt-1 text-xl font-black text-[#00D2FF]">{summary.directReferralCount}</p>
            </div>
            <div className="min-w-[92px] rounded-xl border border-[#26262B] bg-[#0C0C0E]/70 p-3 text-center">
              <p className="text-[10px] text-[#8E8E93]">롤업 배치</p>
              <p className="mt-1 text-xl font-black text-[#F0B90B]">{summary.rolledUpDirectCount}</p>
            </div>
            <div className="min-w-[92px] rounded-xl border border-[#26262B] bg-[#0C0C0E]/70 p-3 text-center">
              <p className="text-[10px] text-[#8E8E93]">후원 산하</p>
              <p className="mt-1 text-xl font-black text-[#BF5AF2]">{summary.sponsorDescendantCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#26262B] bg-[#16161A] p-4">
        <div className="flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 shrink-0 text-[#0ECB81]" size={18} />
          <p className="leading-6 text-[#EAECEF]">
            모든 회원은 <strong className="text-white">원 추천인</strong>을 유지합니다. 활성 직추천의 3·6·9…번째 회원은 최종 후원인만 상위 조직으로 롤업될 수 있으며, 아래 카드의 <strong className="text-[#F0B90B]">롤업 배치됨</strong> 표시와 최종 후원인으로 결과를 확인합니다.
          </p>
        </div>
      </section>

      {sponsorAncestors.length > 0 && (
        <section className="rounded-2xl border border-[#26262B] bg-[#16161A] p-5">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch size={17} className="text-[#BF5AF2]" />
            <h3 className="font-bold text-white">상위 후원 라인</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {sponsorAncestors.map((ancestor, index) => (
              <div key={ancestor.id} className="contents">
                {index > 0 && <ChevronRight size={14} className="text-[#48484A]" />}
                <Link
                  href={`/users/${ancestor.id}/organization`}
                  className="rounded-lg border border-[#BF5AF2]/25 bg-[#BF5AF2]/10 px-3 py-2 font-bold text-[#EAECEF] hover:border-[#BF5AF2]"
                >
                  {ancestor.nickname}
                </Link>
              </div>
            ))}
            <ChevronRight size={14} className="text-[#48484A]" />
            <span className="rounded-lg border border-[#00D2FF]/30 bg-[#00D2FF]/10 px-3 py-2 font-bold text-[#00D2FF]">{member.nickname}</span>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#26262B] bg-[#16161A] shadow-lg">
        <div className="border-b border-[#26262B] p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Users className="text-[#00D2FF]" size={18} />
              <h3 className="font-bold text-white">하위 조직</h3>
            </div>
            <div className="flex rounded-xl bg-[#0C0C0E] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTab("referral")}
                className={`rounded-lg px-4 py-2 transition-colors ${tab === "referral" ? "bg-[#00D2FF] text-[#0B0E11]" : "text-[#8E8E93] hover:text-white"}`}
              >
                추천 조직도 ({directReferrals.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("sponsor")}
                className={`rounded-lg px-4 py-2 transition-colors ${tab === "sponsor" ? "bg-[#BF5AF2] text-white" : "text-[#8E8E93] hover:text-white"}`}
              >
                후원 조직도 ({sponsorTree.length})
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#8E8E93]">
            {tab === "referral"
              ? "직접 추천한 전체 회원입니다. 롤업 대상도 원 추천 관계에는 그대로 남습니다."
              : "실제 sponsor_id 기준의 배치 조직입니다. 롤업 회원은 상위 후원인 아래에 표시됩니다."}
          </p>
        </div>

        {currentMembers.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <Users size={28} className="mx-auto text-[#48484A]" />
            <p className="mt-3 text-sm font-semibold text-[#8E8E93]">
              {tab === "referral" ? "직추천 회원이 없습니다." : "후원 조직에 배치된 회원이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {currentMembers.map((networkMember) => (
              <div
                key={networkMember.id}
                className={tab === "sponsor" ? "relative" : undefined}
                style={
                  tab === "sponsor" && networkMember.depth && networkMember.depth > 1
                    ? { marginLeft: `${Math.min(networkMember.depth - 1, 3) * 14}px` }
                    : undefined
                }
              >
                {tab === "sponsor" && networkMember.depth && networkMember.depth > 1 && (
                  <span className="absolute -left-2 top-0 h-full border-l border-dashed border-[#BF5AF2]/30" aria-hidden="true" />
                )}
                <MemberCard member={networkMember} showDepth={tab === "sponsor"} />
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="pb-4 text-center text-[11px] text-[#48484A]">기준 회원 가입일: {shortDate(member.createdAt)}</p>
    </div>
  );
}
