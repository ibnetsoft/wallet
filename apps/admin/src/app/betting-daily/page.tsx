"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarRange, RefreshCw, Ticket, Users } from "lucide-react";

interface DailyBettingRow {
  date: string;
  totalTickets: number;
  totalBetAmount: number;
  participantsCount: number;
  roundsCount: number;
}

interface DailyBettingResponse {
  success: boolean;
  days: number;
  unitBetAmount: number;
  dailyTotals: DailyBettingRow[];
  summary?: {
    totalBetAmount: number;
    totalTickets: number;
    totalParticipants: number;
    daysWithData: number;
    averageDailyBetAmount: number;
    peakDay: DailyBettingRow | null;
  };
  error?: string;
}

function formatUsdt(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function BettingDailyPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DailyBettingRow[]>([]);
  const [unitBetAmount, setUnitBetAmount] = useState(100);
  const [summary, setSummary] = useState<DailyBettingResponse["summary"] | null>(null);

  const fetchDailyTotals = async (targetDays: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/betting-daily?days=${targetDays}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as DailyBettingResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "일별 배팅 집계를 불러오지 못했습니다.");
      }

      setRows(Array.isArray(data.dailyTotals) ? data.dailyTotals : []);
      setUnitBetAmount(data.unitBetAmount ?? 100);
      setSummary(data.summary ?? null);
    } catch (fetchError) {
      setRows([]);
      setSummary(null);
      setError(fetchError instanceof Error ? fetchError.message : "일별 배팅 집계를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDailyTotals(days);
  }, [days]);

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">일별 배팅 총액</h2>
          <p className="mt-1 text-sm text-[#8E8E93]">
            유저들의 일자별 게임 배팅 총액을 확인합니다. 기준 단가는 1티켓당 {unitBetAmount} USDT입니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[7, 30, 90].map((option) => (
            <button
              key={option}
              onClick={() => setDays(option)}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                days === option
                  ? "border border-[#26A17B]/30 bg-[#26A17B]/10 text-[#26A17B]"
                  : "bg-[#26262B] text-[#8E8E93] hover:bg-[#3A3A40] hover:text-white"
              }`}
            >
              최근 {option}일
            </button>
          ))}
          <button
            onClick={() => void fetchDailyTotals(days)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#8E8E93] transition-colors hover:bg-[#3A3A40] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">기간 총 배팅액</span>
            <BarChart3 size={18} className="text-[#26A17B]" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {formatUsdt(summary?.totalBetAmount ?? 0)} USDT
          </div>
        </div>

        <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">총 티켓 수</span>
            <Ticket size={18} className="text-[#00D2FF]" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {(summary?.totalTickets ?? 0).toLocaleString()} 장
          </div>
        </div>

        <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">일평균 배팅액</span>
            <CalendarRange size={18} className="text-[#FF9F0A]" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {formatUsdt(summary?.averageDailyBetAmount ?? 0)} USDT
          </div>
        </div>

        <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">참여 유저 합계</span>
            <Users size={18} className="text-[#BF5AF2]" />
          </div>
          <div className="font-mono text-2xl font-extrabold text-white">
            {(summary?.totalParticipants ?? 0).toLocaleString()} 명
          </div>
        </div>
      </div>

      {summary?.peakDay && (
        <div className="rounded-xl border border-[#26A17B]/20 bg-[#26A17B]/5 px-4 py-3 text-xs text-[#B7C6CC]">
          최고 배팅일: {formatDate(summary.peakDay.date)} / {formatUsdt(summary.peakDay.totalBetAmount)} USDT /{" "}
          {summary.peakDay.totalTickets.toLocaleString()}장 / {summary.peakDay.participantsCount.toLocaleString()}명 참여
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[#FF453A]/20 bg-[#FF453A]/5 px-3 py-2 text-xs text-[#FFB4AE]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
        <div className="mb-6">
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">
            일별 집계 {summary ? `(${summary.daysWithData}일 데이터)` : ""}
          </h4>
          <p className="mt-1 text-[11px] text-[#8E8E93]">
            `REFUNDED` 상태는 제외하고, `round_date` 기준으로 합산합니다.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#26262B] font-semibold uppercase tracking-wider text-[#8E8E93]">
                <th className="px-4 py-3">날짜</th>
                <th className="px-4 py-3 text-right">배팅 총액</th>
                <th className="px-4 py-3 text-right">티켓 수</th>
                <th className="px-4 py-3 text-right">참여 유저</th>
                <th className="px-4 py-3 text-right">운영 회차</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#8E8E93]">
                    일별 배팅 집계를 불러오는 중...
                  </td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.date} className="border-b border-[#26262B]/40 transition-all hover:bg-[#1C1C21]/30">
                  <td className="px-4 py-4 font-semibold text-white">{formatDate(row.date)}</td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-[#26A17B]">
                    {formatUsdt(row.totalBetAmount)} USDT
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-white">
                    {row.totalTickets.toLocaleString()}장
                  </td>
                  <td className="px-4 py-4 text-right text-[#EAECEF]">
                    {row.participantsCount.toLocaleString()}명
                  </td>
                  <td className="px-4 py-4 text-right text-[#8E8E93]">
                    {row.roundsCount.toLocaleString()}회차
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#8E8E93]">
                    조회된 배팅 집계가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
