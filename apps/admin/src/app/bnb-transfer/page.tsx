"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { adminApi } from "@/lib/admin-path";

type TransferStatus = "PROCESSING" | "BROADCAST" | "CONFIRMED" | "FAILED";

interface TransferLog {
  id: string;
  amount: string | number;
  recipient_address: string;
  source_address: string;
  status: TransferStatus;
  tx_hash: string | null;
  failure_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface TransferResult {
  id: string;
  amount: string | number;
  recipientAddress: string;
  sourceAddress: string;
  status: TransferStatus;
  txHash: string | null;
  explorerUrl: string | null;
  confirmedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

interface BnbTransferResponse {
  success: boolean;
  enabled?: boolean;
  sourceAddress?: string | null;
  sourceBalance?: string | null;
  confirmationPhrase?: string;
  maxAmount?: string | null;
  gasReserve?: string | null;
  allowlistEnabled?: boolean;
  armingIssues?: string[];
  logs?: TransferLog[];
  error?: string;
  message?: string;
  transfer?: TransferResult;
}

const statusStyles: Record<TransferStatus, string> = {
  PROCESSING: "border-[#FF9F0A]/30 bg-[#FF9F0A]/10 text-[#FF9F0A]",
  BROADCAST: "border-[#00D2FF]/30 bg-[#00D2FF]/10 text-[#00D2FF]",
  CONFIRMED: "border-[#30D5C8]/30 bg-[#30D5C8]/10 text-[#30D5C8]",
  FAILED: "border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF453A]",
};

function shortAddress(address: string | null | undefined) {
  if (!address) return "Not configured";
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBnbBalance(value: string | null | undefined) {
  const balance = Number(value);
  if (!Number.isFinite(balance)) return "-";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(balance);
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `bnb-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export default function BnbTransferPage() {
  const [data, setData] = useState<BnbTransferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pendingRequestKey, setPendingRequestKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(adminApi("/api/bnb-transfer"), { cache: "no-store" });
      const result = (await response.json()) as BnbTransferResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to load the BNB transfer page.");
      }
      setData(result);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load the BNB transfer page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!data?.enabled) {
      setMessage({ type: "error", text: "Resolve the BNB transfer setup warnings before sending." });
      return;
    }
    if (!recipientAddress.trim() || !amount.trim()) {
      setMessage({ type: "error", text: "Enter a BSC recipient address and BNB amount." });
      return;
    }
    if (confirmation.trim() !== data.confirmationPhrase) {
      setMessage({
        type: "error",
        text: `Type ${data.confirmationPhrase} exactly before sending.`,
      });
      return;
    }
    if (pendingRequestKey) {
      setMessage({
        type: "error",
        text: "A previous request may still be pending. Check the audit log and BscScan before starting another transfer.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Send ${amount.trim()} BNB on BSC mainnet?\n\nRecipient: ${recipientAddress.trim()}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    const idempotencyKey = createIdempotencyKey();
    setPendingRequestKey(idempotencyKey);
    setSubmitting(true);

    try {
      const response = await fetch(adminApi("/api/bnb-transfer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAddress: recipientAddress.trim(),
          amount: amount.trim(),
          note: note.trim(),
          confirmation: confirmation.trim(),
          idempotencyKey,
        }),
      });
      const result = (await response.json()) as BnbTransferResponse;
      const transferStatus = result.transfer?.status;

      if (transferStatus === "CONFIRMED") {
        setMessage({ type: "success", text: "BNB transfer confirmed on BSC." });
        setRecipientAddress("");
        setAmount("");
        setNote("");
        setConfirmation("");
        setPendingRequestKey(null);
      } else if (transferStatus === "BROADCAST" || transferStatus === "PROCESSING") {
        setMessage({
          type: "success",
          text: result.message || "The BNB transaction is pending. Check BscScan before attempting another transfer.",
        });
      } else if (transferStatus === "FAILED") {
        setPendingRequestKey(null);
        setMessage({ type: "error", text: result.error || "The BNB transaction failed. Review the audit log." });
      } else if (!response.ok || !result.success) {
        // The API rejected this before it recorded or signed a transaction.
        setPendingRequestKey(null);
        setMessage({ type: "error", text: result.error || "BNB transfer was rejected." });
      } else {
        setPendingRequestKey(null);
        setMessage({ type: "success", text: result.message || "BNB transfer request completed." });
      }

      await loadData();
    } catch (error) {
      // Preserve the key after an unknown network error. Retrying with a new
      // key could create a second on-chain transfer if the first one succeeded.
      setMessage({
        type: "error",
        text: error instanceof Error
          ? `${error.message} Verify the audit log and BscScan before retrying.`
          : "The request outcome is unknown. Verify the audit log and BscScan before retrying.",
      });
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(data?.enabled) && !submitting && !pendingRequestKey;

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Send className="text-[#F0B90B]" size={25} />
            <h2 className="text-2xl font-bold tracking-tight text-white">마스터 핫 월렛 BNB 송금</h2>
          </div>
          <p className="mt-1 text-sm text-[#8E8E93]">
            마스터 핫 월렛과 같은 주소에서 BSC 메인넷 BNB를 보냅니다. 새 마스터 지갑을 만들면 송금 주소도 자동으로 함께 바뀝니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading || submitting}
          className="flex items-center gap-1.5 rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#8E8E93] transition-colors hover:bg-[#3A3A40] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 p-4 text-sm text-[#FF9D95]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">BNB 송금 상태를 불러올 수 없습니다.</p>
            <p className="mt-1 text-xs">{loadError}</p>
          </div>
        </div>
      )}

      {data && !data.enabled && (
        <div className="rounded-2xl border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#FF9F0A]" />
            <div>
              <h3 className="font-bold text-[#FF9F0A]">전송 기능이 비활성화되어 있습니다.</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#EAECEF]">
                아래 항목을 모두 해결하기 전에는 어떤 BNB 전송도 실행되지 않습니다.
              </p>
              <ul className="mt-3 space-y-1 text-xs text-[#FFCC80]">
                {(data.armingIssues ?? []).map((issue) => (
                  <li key={issue}>- {issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="space-y-5 rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg xl:col-span-2">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Wallet size={18} className="text-[#F0B90B]" />
              마스터 핫 월렛
            </h3>
            <span className="rounded border border-[#F0B90B]/30 bg-[#F0B90B]/10 px-2 py-0.5 text-[10px] font-bold text-[#F0B90B]">
              BSC MAINNET
            </span>
          </div>

          <div className="space-y-2 rounded-xl border border-[#26262B] bg-[#121215] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">마스터 핫 월렛 / 송금 주소</p>
            <p className="break-all font-mono text-xs text-white">{data?.sourceAddress || "Not configured"}</p>
            {data?.sourceAddress && <p className="font-mono text-[10px] text-[#8E8E93]">{shortAddress(data.sourceAddress)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#26262B] bg-[#121215] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">보유 BNB</p>
              <p className="mt-1 font-mono text-lg font-bold text-[#30D5C8]">
                {formatBnbBalance(data?.sourceBalance)} <span className="text-xs">BNB</span>
              </p>
              <p className="mt-1 text-[10px] text-[#8E8E93]">BSC 온체인 잔액</p>
            </div>
            <div className="rounded-xl border border-[#26262B] bg-[#121215] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8E8E93]">1회 한도</p>
              <p className="mt-1 font-mono text-lg font-bold text-white">
                {data?.maxAmount ?? "-"} <span className="text-xs">BNB</span>
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[#00D2FF]/20 bg-[#00D2FF]/5 p-4 text-xs text-[#EAECEF]">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#00D2FF]" />
              <p>전송 후 예상 수수료와 별도로 최소 {data?.gasReserve ?? "-"} BNB를 지갑에 남깁니다.</p>
            </div>
            <div className="flex items-start gap-2">
              <LockKeyhole size={16} className="mt-0.5 shrink-0 text-[#00D2FF]" />
              <p>
                수신 주소 제한: {data?.allowlistEnabled ? "활성화됨" : "미설정"}. BSC 외 네트워크 주소로는 보내지 마세요.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg xl:col-span-3">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Send size={18} className="text-[#F0B90B]" />
              BNB 전송 요청
            </h3>
            <span className="text-[10px] font-bold text-[#FF9F0A]">되돌릴 수 없음</span>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-xs font-semibold text-[#EAECEF]">수신 BSC 지갑 주소</span>
              <input
                value={recipientAddress}
                onChange={(event) => setRecipientAddress(event.target.value)}
                placeholder="0x..."
                autoComplete="off"
                spellCheck={false}
                disabled={!data?.enabled || submitting || Boolean(pendingRequestKey)}
                className="mt-2 w-full rounded-xl border border-[#26262B] bg-[#121215] px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-[#57575F] focus:border-[#F0B90B] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#EAECEF]">전송 수량</span>
              <div className="mt-2 flex overflow-hidden rounded-xl border border-[#26262B] bg-[#121215] focus-within:border-[#F0B90B]">
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoComplete="off"
                  disabled={!data?.enabled || submitting || Boolean(pendingRequestKey)}
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-[#57575F] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="flex items-center border-l border-[#26262B] px-4 text-xs font-bold text-[#F0B90B]">BNB</span>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#EAECEF]">감사 메모 (선택)</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="예: 2026-08 운영비 외부 지갑 이체"
                disabled={!data?.enabled || submitting || Boolean(pendingRequestKey)}
                className="mt-2 w-full rounded-xl border border-[#26262B] bg-[#121215] px-4 py-3 text-sm text-white outline-none placeholder:text-[#57575F] focus:border-[#F0B90B] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#EAECEF]">
                확인 문구: <span className="font-mono text-[#F0B90B]">{data?.confirmationPhrase ?? "SEND BNB"}</span>
              </span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={data?.confirmationPhrase ?? "SEND BNB"}
                disabled={!data?.enabled || submitting || Boolean(pendingRequestKey)}
                className="mt-2 w-full rounded-xl border border-[#26262B] bg-[#121215] px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-[#57575F] focus:border-[#F0B90B] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>

            {message && (
              <div
                className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
                  message.type === "success"
                    ? "border-[#30D5C8]/30 bg-[#30D5C8]/10 text-[#30D5C8]"
                    : "border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF9D95]"
                }`}
              >
                {message.type === "success" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            {pendingRequestKey && (
              <p className="text-xs leading-relaxed text-[#FFCC80]">
                이전 요청의 결과를 확인할 때까지 추가 전송을 잠갔습니다. 아래 감사 로그와 BscScan을 확인하세요.
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F0B90B] py-3.5 text-sm font-extrabold text-[#121215] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? <RefreshCw size={17} className="animate-spin" /> : <Send size={17} />}
              {submitting ? "전송 요청 처리 중" : "BNB 전송 요청"}
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26262B] pb-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <CheckCircle2 size={18} className="text-[#30D5C8]" />
              BNB 전송 감사 로그
            </h3>
            <p className="mt-1 text-xs text-[#8E8E93]">이 전용 기능에서 요청한 최근 20건만 표시합니다.</p>
          </div>
          <span className="text-[10px] font-bold text-[#8E8E93]">감사 테이블: admin_bnb_transfers</span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#26262B] text-[#8E8E93]">
                <th className="px-3 py-3 font-semibold">상태</th>
                <th className="px-3 py-3 font-semibold">수량</th>
                <th className="px-3 py-3 font-semibold">수신 주소</th>
                <th className="px-3 py-3 font-semibold">트랜잭션</th>
                <th className="px-3 py-3 font-semibold">요청 시각</th>
                <th className="px-3 py-3 font-semibold">오류/상태</th>
              </tr>
            </thead>
            <tbody>
              {(data?.logs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-[#8E8E93]">
                    아직 이 기능으로 전송한 BNB가 없습니다.
                  </td>
                </tr>
              ) : (
                (data?.logs ?? []).map((log) => (
                  <tr key={log.id} className="border-b border-[#26262B]/50 transition-colors hover:bg-[#1C1C21]/40">
                    <td className="px-3 py-3">
                      <span className={`rounded border px-2 py-1 text-[10px] font-bold ${statusStyles[log.status]}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono font-bold text-white">{log.amount} BNB</td>
                    <td className="px-3 py-3 font-mono text-[#EAECEF]" title={log.recipient_address}>
                      {shortAddress(log.recipient_address)}
                    </td>
                    <td className="px-3 py-3">
                      {log.tx_hash ? (
                        <a
                          href={`https://bscscan.com/tx/${log.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[#00D2FF] hover:underline"
                        >
                          {shortAddress(log.tx_hash)} <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-[#8E8E93]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[#8E8E93]">{formatDate(log.created_at)}</td>
                    <td className="max-w-xs px-3 py-3 text-[#8E8E93]" title={log.failure_reason ?? undefined}>
                      {log.failure_reason || (log.confirmed_at ? `Confirmed ${formatDate(log.confirmed_at)}` : "-")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
