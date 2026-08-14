"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
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

interface SyncResult {
  status: string;
  rangesScanned: number;
  eventsFound: number;
  credited: number;
  legacyCreditsRecorded: number;
  duplicatesSkipped: number;
}

function isBscTransactionHash(value: string | null) {
  return Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));
}

function transactionExplorerHash(transaction: Transaction) {
  if (isBscTransactionHash(transaction.chainTxHash)) {
    return transaction.chainTxHash;
  }

  return isBscTransactionHash(transaction.hash) ? transaction.hash : null;
}

function detailsLabel(details: Record<string, unknown> | null) {
  if (!details) {
    return "-";
  }

  if (typeof details.description === "string") {
    return details.description;
  }
  if (typeof details.chain_event_id === "string") {
    return "BSC confirmed deposit";
  }

  return JSON.stringify(details);
}

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/transactions?limit=200", { cache: "no-store" });
      const data = await response.json();
      setTransactions(data.success && data.transactions ? data.transactions : []);
    } catch (error) {
      console.error("Failed to load transaction history:", error);
      setTransactions([]);
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
          ? "A BSC USDT sync is already running."
          : "BSC sync: "
            + result.credited
            + " credited, "
            + result.eventsFound
            + " events checked, "
            + result.rangesScanned
            + " block ranges scanned."
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
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = transactions.filter((transaction) => (
    !normalizedSearch
    || transaction.userEmail.toLowerCase().includes(normalizedSearch)
    || transaction.userNickname.toLowerCase().includes(normalizedSearch)
    || transaction.type.toLowerCase().includes(normalizedSearch)
    || transaction.asset.toLowerCase().includes(normalizedSearch)
    || transaction.hash?.toLowerCase().includes(normalizedSearch)
    || transaction.chainTxHash?.toLowerCase().includes(normalizedSearch)
  ));

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">전체 거래 내역 (통합 장부)</h2>
          <p className="mt-1 text-sm text-[#8E8E93]">
            유저 BSC 입금, 출금, 보너스, 스왑, 게임 보상 내역을 확인합니다.
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
            전체 거래 기록 ({filtered.length}건)
          </h4>

          <div className="relative w-full md:w-72">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#8E8E93]">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="이메일, 닉네임, 자산, 해시 검색"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-[#26262B] bg-[#1C1C21] py-2 pl-9 pr-3 text-xs text-white outline-none transition-colors focus:border-[#00D2FF]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#26262B] font-semibold uppercase tracking-wider text-[#8E8E93]">
                <th className="px-4 py-3">Tx ID</th>
                <th className="px-4 py-3">유저</th>
                <th className="px-4 py-3 text-center">자산</th>
                <th className="px-4 py-3 text-right">수량</th>
                <th className="px-4 py-3">유형</th>
                <th className="px-4 py-3">상세 내역</th>
                <th className="px-4 py-3">BSC Tx Hash</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-right">시간</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#8E8E93]">거래 데이터를 불러오는 중...</td>
                </tr>
              ) : filtered.map((transaction) => {
                const explorerHash = transactionExplorerHash(transaction);
                return (
                  <tr key={transaction.id} className="border-b border-[#26262B]/40 transition-all hover:bg-[#1C1C21]/30">
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
                        {transaction.asset}
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
                        <span className="text-[10px] text-[#EAECEF]">{transaction.type}</span>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-4 text-[10px] text-[#8E8E93]" title={JSON.stringify(transaction.details)}>
                      {detailsLabel(transaction.details)}
                    </td>
                    <td className="px-4 py-4">
                      {explorerHash ? (
                        <a
                          href={`https://bscscan.com/tx/${explorerHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] text-[#00D2FF] hover:underline"
                        >
                          {explorerHash.slice(0, 6)}...{explorerHash.slice(-4)}
                        </a>
                      ) : transaction.hash ? (
                        <span className="font-mono text-[10px] text-[#8E8E93]">{transaction.hash.slice(0, 12)}...</span>
                      ) : (
                        <span className="text-[10px] italic text-[#8E8E93]">내부 처리</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {transaction.status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#30D5C8]">
                          <CheckCircle size={10} />
                          <span>완료</span>
                        </span>
                      ) : transaction.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF9F0A]">
                          <RefreshCw size={10} className="animate-spin" />
                          <span>대기</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#F6465D]">실패</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-[10px] text-[#8E8E93]">
                      {new Date(transaction.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#8E8E93]">조회된 거래 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
