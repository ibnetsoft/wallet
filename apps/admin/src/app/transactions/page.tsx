"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Coins,
  Gift,
  RefreshCw,
  Search,
} from "lucide-react";

interface Transaction {
  id: string;
  userEmail: string;
  userNickname: string;
  asset: string;
  amount: number;
  type: string;
  status: string;
  hash: string | null;
  chainTxHash: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SyncResult {
  status: string;
  rangesScanned: number;
  eventsFound: number;
  credited: number;
  legacyCreditsRecorded: number;
  duplicatesSkipped: number;
}

function assetDisplayName(asset: string) {
  if (asset === "JADE") return "옥구슬";
  if (asset === "HONGBAO") return "홍바오";
  return asset;
}

function transactionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    DEPOSIT: "입금",
    WITHDRAW: "출금",
    SWAP_IN: "스왑 입금",
    SWAP_OUT: "스왑 출금",
    REFERRAL_BONUS: "추천 보너스",
    RANK_BONUS: "직급 보너스",
    CHOITAN_BONUS: "최단 보너스",
    FOSTER_BONUS: "양육 보너스",
    MAMA_BONUS: "마마 보너스",
    PACKAGE_BUY: "상품 구매",
    PACKAGE_BONUS: "상품 보상",
    GAME_WAGER: "게임 배팅",
    GAME_REWARD: "게임 당첨 보상",
    GAME_CONSOLATION: "낙첨 위로 보상",
    GAME_REFUND: "게임 환불",
  };

  return labels[type] ?? type;
}

function detailsLabel(details: Record<string, unknown> | null) {
  if (!details) return "-";
  if (typeof details.description === "string") return details.description;
  if (typeof details.chain_event_id === "string") return "BSC 입금 반영";
  if (typeof details.run === "string" && details.mode === "auto") return "자동 배팅 실행";
  if (typeof details.run === "string" && typeof details.roundId === "number") {
    return `게임 라운드 정산 (${details.roundId}회차)`;
  }
  if (typeof details.referrer_nickname === "string") return `추천인 ${details.referrer_nickname}`;
  if (typeof details.source === "string") return String(details.source);
  return JSON.stringify(details);
}

function statusLabel(status: string) {
  if (status === "COMPLETED") return "완료";
  if (status === "PENDING") return "대기";
  if (status === "FAILED") return "실패";
  return status;
}

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "20",
        page: String(page),
      });
      if (selectedDate) params.set("date", selectedDate);

      const response = await fetch(`/api/transactions?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      setTransactions(data.success && data.transactions ? data.transactions : []);
      setPagination(data.success && data.pagination ? data.pagination : { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (error) {
      console.error("Failed to load transaction history:", error);
      setTransactions([]);
      setPagination({ total: 0, page: 1, limit: 20, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  const syncBscUsdtDeposits = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const response = await fetch("/api/deposits/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "BSC USDT deposit sync failed.");
      }

      const result = data.result as SyncResult;
      setSyncMessage(
        result.status === "locked"
          ? "BSC 동기화가 이미 실행 중입니다."
          : `BSC 동기화: ${result.credited}건 반영, ${result.eventsFound}건 이벤트 확인, ${result.rangesScanned}개 블록 범위 확인`,
      );
      await fetchTransactions();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "BSC USDT deposit sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void fetchTransactions();
  }, [page, selectedDate]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = transactions.filter((transaction) => (
    !normalizedSearch
    || transaction.userEmail.toLowerCase().includes(normalizedSearch)
    || transaction.userNickname.toLowerCase().includes(normalizedSearch)
    || transaction.type.toLowerCase().includes(normalizedSearch)
    || transactionTypeLabel(transaction.type).toLowerCase().includes(normalizedSearch)
    || transaction.asset.toLowerCase().includes(normalizedSearch)
    || assetDisplayName(transaction.asset).toLowerCase().includes(normalizedSearch)
    || detailsLabel(transaction.details).toLowerCase().includes(normalizedSearch)
  ));

  const pageNumbers = Array.from({ length: pagination.totalPages }, (_, index) => index + 1).slice(
    Math.max(0, pagination.page - 3),
    Math.max(0, pagination.page - 3) + 5,
  );

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">전체 거래 내역</h2>
          <p className="mt-1 text-sm text-[#8E8E93]">
            유저의 BSC 입금, 출금, 보너스, 게임 보상 내역을 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void syncBscUsdtDeposits()}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-[#26A17B]/30 bg-[#26A17B]/10 px-3 py-2 text-xs font-bold text-[#30D5C8] transition-colors hover:bg-[#26A17B]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Coins size={13} className={syncing ? "animate-spin" : ""} />
            <span>{syncing ? "BSC 동기화 중" : "BSC USDT 동기화"}</span>
          </button>
          <button
            onClick={() => void fetchTransactions()}
            disabled={loading || syncing}
            className="flex items-center gap-1.5 rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#8E8E93] transition-colors hover:bg-[#3A3A40] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#26A17B]/20 bg-[#26A17B]/5 px-4 py-3 text-xs text-[#B7C6CC]">
        BSC USDT 입금은 메인넷에서 12개 블록 확인 후 자동 반영됩니다. 수동 동기화는 같은 온체인 이벤트를 중복 반영하지 않습니다.
      </div>

      {syncMessage && (
        <div className="rounded-lg border border-[#00D2FF]/20 bg-[#00D2FF]/5 px-3 py-2 text-xs text-[#8EDFFF]">
          {syncMessage}
        </div>
      )}

      <div className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <h4 className="flex items-center text-sm font-bold uppercase tracking-wider text-white">
            <Activity size={16} className="mr-2 text-[#00D2FF]" />
            전체 거래 기록 ({pagination.total}건)
          </h4>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-[#26262B] bg-[#1C1C21] px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#00D2FF]"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("");
                  setPage(1);
                }}
                className="rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#8E8E93] transition-colors hover:bg-[#3A3A40]"
              >
                전체
              </button>
            </div>

            <div className="relative w-full md:w-72">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#8E8E93]">
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="이메일, 닉네임, 자산, 상세 검색"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-lg border border-[#26262B] bg-[#1C1C21] py-2 pl-9 pr-3 text-xs text-white outline-none transition-colors focus:border-[#00D2FF]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#26262B] font-semibold uppercase tracking-wider text-[#8E8E93]">
                <th className="px-4 py-3">시간</th>
                <th className="px-4 py-3">TX ID</th>
                <th className="px-4 py-3">유저</th>
                <th className="px-4 py-3 text-center">자산</th>
                <th className="px-4 py-3 text-right">수량</th>
                <th className="px-4 py-3">유형</th>
                <th className="px-4 py-3">상세 내역</th>
                <th className="px-4 py-3 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8E8E93]">거래 데이터를 불러오는 중...</td>
                </tr>
              ) : filtered.map((transaction) => (
                <tr key={transaction.id} className="border-b border-[#26262B]/40 transition-all hover:bg-[#1C1C21]/30">
                  <td className="px-4 py-4 text-[10px] text-[#8E8E93]">
                    {new Date(transaction.createdAt).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-4 font-mono text-[10px] font-semibold text-[#8E8E93]">
                    {transaction.id.split("-")[0]}...
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-white">{transaction.userNickname}</div>
                    <div className="text-[10px] text-[#8E8E93]">{transaction.userEmail}</div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${
                      transaction.asset === "USDT"
                        ? "border-[#26A17B]/20 bg-[#26A17B]/10 text-[#26A17B]"
                        : transaction.asset === "BAO"
                          ? "border-[#0ECB81]/20 bg-[#0ECB81]/10 text-[#0ECB81]"
                          : transaction.asset === "JADE"
                            ? "border-[#30D5C8]/20 bg-[#30D5C8]/10 text-[#30D5C8]"
                            : transaction.asset === "HONGBAO"
                              ? "border-[#FF453A]/20 bg-[#FF453A]/10 text-[#FF453A]"
                              : "border-[#BF5AF2]/20 bg-[#BF5AF2]/10 text-[#BF5AF2]"
                    }`}>
                      {assetDisplayName(transaction.asset)}
                    </span>
                  </td>
                  <td className={`px-4 py-4 text-right font-mono font-bold ${transaction.amount > 0 ? "text-[#30D5C8]" : "text-[#FF453A]"}`}>
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      {transaction.type === "DEPOSIT" && <ArrowDownLeft size={12} className="text-[#30D5C8]" />}
                      {transaction.type === "WITHDRAW" && <ArrowUpRight size={12} className="text-[#FF453A]" />}
                      {(transaction.type.includes("BONUS") || transaction.type === "GAME_CONSOLATION") && <Gift size={12} className="text-[#BF5AF2]" />}
                      {transaction.type.includes("SWAP") && <RefreshCw size={12} className="text-[#FF9F0A]" />}
                      <span className="text-[10px] text-[#EAECEF]">{transactionTypeLabel(transaction.type)}</span>
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-4 text-[10px] text-[#8E8E93]" title={JSON.stringify(transaction.details)}>
                    {detailsLabel(transaction.details)}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {transaction.status === "COMPLETED" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#30D5C8]">
                        <CheckCircle size={10} />
                        <span>{statusLabel(transaction.status)}</span>
                      </span>
                    ) : transaction.status === "PENDING" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF9F0A]">
                        <RefreshCw size={10} className="animate-spin" />
                        <span>{statusLabel(transaction.status)}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#F6465D]">{statusLabel(transaction.status)}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8E8E93]">조회된 거래 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#26262B] pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-[#8E8E93]">
            {pagination.page} / {pagination.totalPages} 페이지 · 페이지당 20건
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={pagination.page <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#EAECEF] transition-colors hover:bg-[#3A3A40] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft size={14} />
              이전
            </button>
            <div className="flex items-center gap-1">
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition-colors ${
                    pageNumber === pagination.page
                      ? "bg-[#00D2FF] text-[#0B0E11]"
                      : "bg-[#26262B] text-[#EAECEF] hover:bg-[#3A3A40]"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="inline-flex items-center gap-1 rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#EAECEF] transition-colors hover:bg-[#3A3A40] disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
