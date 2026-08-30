"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/admin-path";
import { Calculator, Coins, Percent, Receipt, RefreshCw } from "lucide-react";

interface AllowanceSummary {
  totalProductSales: number;
  totalGameWagers: number;
  salesRate: number;
  gameRate: number;
  salesAllowanceAmount: number;
  gameAllowanceAmount: number;
  totalAllowanceAmount: number;
}

function formatUsd(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AllowancesPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AllowanceSummary | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(adminApi("/api/allowances/summary"), { cache: "no-store" });
      const data = await response.json();
      setSummary(data.success ? data.summary : null);
    } catch (error) {
      console.error("Failed to load allowance summary:", error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">배당내역</h2>
          <p className="mt-1 text-sm text-[#8E8E93]">
            시스템 환경 설정에서 입력한 매출배당과 게임배당 기준으로 현재 누적 배당 금액을 보여줍니다.
          </p>
        </div>
        <button
          onClick={() => void loadSummary()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#8E8E93] transition-colors hover:bg-[#3A3A40] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>새로고침</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">누적 상품매출</p>
              <h3 className="mt-2 text-2xl font-extrabold text-white font-mono">
                {summary ? `${formatUsd(summary.totalProductSales)} USDT` : "-"}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#30D5C8]/10 text-[#30D5C8]">
              <Receipt size={22} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[#8E8E93]">전체 회원의 상품구매 누적 금액 합계</p>
        </div>

        <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">누적 게임배팅금액</p>
              <h3 className="mt-2 text-2xl font-extrabold text-white font-mono">
                {summary ? `${formatUsd(summary.totalGameWagers)} USDT` : "-"}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0B90B]/10 text-[#F0B90B]">
              <Coins size={22} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[#8E8E93]">완료된 전체 게임 배팅 누적 금액 합계</p>
        </div>

        <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">총 수당 기준 금액</p>
              <h3 className="mt-2 text-2xl font-extrabold text-white font-mono">
                {summary ? `${formatUsd(summary.totalAllowanceAmount)} USDT` : "-"}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#BF5AF2]/10 text-[#BF5AF2]">
              <Calculator size={22} />
            </div>
          </div>
          <p className="mt-3 text-xs text-[#8E8E93]">매출배당 + 게임배당 합산 금액</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <Percent size={16} className="text-[#00D2FF]" />
          <h4 className="text-sm font-bold uppercase tracking-wider text-white">배당 설정 반영 내역</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#26262B] font-semibold uppercase tracking-wider text-[#8E8E93]">
                <th className="px-4 py-3">항목</th>
                <th className="px-4 py-3 text-right">기준 금액</th>
                <th className="px-4 py-3 text-right">배당 비율</th>
                <th className="px-4 py-3 text-right">배당 금액</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#8E8E93]">
                    배당 집계 데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : !summary ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#8E8E93]">
                    배당 데이터를 불러오지 못했습니다.
                  </td>
                </tr>
              ) : (
                <>
                  <tr className="border-b border-[#26262B]/40">
                    <td className="px-4 py-4 font-semibold text-white">매출배당</td>
                    <td className="px-4 py-4 text-right font-mono text-[#EAECEF]">
                      {formatUsd(summary.totalProductSales)} USDT
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-[#30D5C8]">
                      {summary.salesRate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-[#30D5C8]">
                      {formatUsd(summary.salesAllowanceAmount)} USDT
                    </td>
                  </tr>
                  <tr className="border-b border-[#26262B]/40">
                    <td className="px-4 py-4 font-semibold text-white">게임배당</td>
                    <td className="px-4 py-4 text-right font-mono text-[#EAECEF]">
                      {formatUsd(summary.totalGameWagers)} USDT
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-[#F0B90B]">
                      {summary.gameRate.toFixed(2)}%
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-[#F0B90B]">
                      {formatUsd(summary.gameAllowanceAmount)} USDT
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 font-bold text-white">합계</td>
                    <td className="px-4 py-4 text-right text-[#8E8E93]">-</td>
                    <td className="px-4 py-4 text-right text-[#8E8E93]">-</td>
                    <td className="px-4 py-4 text-right font-mono text-lg font-extrabold text-[#BF5AF2]">
                      {formatUsd(summary.totalAllowanceAmount)} USDT
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
