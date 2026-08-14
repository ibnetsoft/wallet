"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Check,
  CheckCircle,
  Copy,
  Info,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";

interface UserWallet {
  user_id: string;
  email: string;
  wallet_address: string;
  usdt_balance: number;
}

interface VaultTransferLog {
  id: string;
  from_label: string;
  to_label: string;
  amount: number;
  asset: string;
  cold_vault_address: string;
  note: string;
  created_at: string;
}

function getVaultTransferTxHash(note: string) {
  const match = note.match(/txHash=(0x[a-fA-F0-9]{64})/);
  return match ? match[1] : null;
}

function formatNumber(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export default function WalletSweepPage() {
  const [loading, setLoading] = useState(true);
  const [userWallets, setUserWallets] = useState<UserWallet[]>([]);
  const [vaultLogs, setVaultLogs] = useState<VaultTransferLog[]>([]);

  const [masterHotWallet, setMasterHotWallet] = useState("");
  const [coldVaultAddress, setColdVaultAddress] = useState("");
  const [hotBalanceUSDT, setHotBalanceUSDT] = useState<number | null>(null);
  const [coldBalanceUSDT, setColdBalanceUSDT] = useState<number | null>(null);
  const [feeWalletAddress, setFeeWalletAddress] = useState<string | null>(null);
  const [feeWalletBalance, setFeeWalletBalance] = useState(0);

  const [vaultAsset, setVaultAsset] = useState<"USDT" | "BNB">("USDT");
  const [vaultAmount, setVaultAmount] = useState("");
  const [loadingSweep, setLoadingSweep] = useState<"live" | "dry-run" | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [vaultMsg, setVaultMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [masterWalletCopied, setMasterWalletCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResult, feeResult] = await Promise.allSettled([
        fetch("/api/wallet/status").then(async (response) => ({
          ok: response.ok,
          data: await response.json(),
        })),
        fetch("/api/wallet/fee-status").then(async (response) => ({
          ok: response.ok,
          data: await response.json(),
        })),
      ]);

      const statusData = statusResult.status === "fulfilled" && statusResult.value.ok
        ? statusResult.value.data
        : null;

      if (statusData?.success) {
        const mappedWallets = (Array.isArray(statusData.usersWithBalances) ? statusData.usersWithBalances : [])
          .map((user: any) => {
            const usdtBalanceRow = Array.isArray(user.user_balances)
              ? user.user_balances.find((balance: any) => balance.asset_id === 2)
              : null;
            const walletAddress = Array.isArray(user.user_wallets) && user.user_wallets.length > 0
              ? user.user_wallets[0].address
              : "-";

            return {
              user_id: user.id,
              email: user.email ?? user.id,
              wallet_address: walletAddress,
              usdt_balance: usdtBalanceRow ? Number.parseFloat(usdtBalanceRow.available_balance) : 0,
            } satisfies UserWallet;
          })
          .sort((a: UserWallet, b: UserWallet) => b.usdt_balance - a.usdt_balance);

        setUserWallets(mappedWallets);

        if (Array.isArray(statusData.settings)) {
          const settingsMap = Object.fromEntries(
            statusData.settings.map((row: { key: string; value: string }) => [row.key, row.value]),
          );
          setMasterHotWallet(settingsMap.master_hot_wallet ?? "");
          setColdVaultAddress(settingsMap.cold_vault_address ?? "");
          setHotBalanceUSDT(
            settingsMap.hot_balance_usdt ? Number.parseFloat(settingsMap.hot_balance_usdt) : null,
          );
          setColdBalanceUSDT(
            settingsMap.cold_balance_usdt ? Number.parseFloat(settingsMap.cold_balance_usdt) : null,
          );
        }

        setVaultLogs(Array.isArray(statusData.logs) ? statusData.logs : []);
      }

      if (feeResult.status === "fulfilled" && feeResult.value.ok) {
        const feeData = feeResult.value.data;
        if (feeData?.success) {
          setFeeWalletAddress(feeData.address ?? null);
          setFeeWalletBalance(typeof feeData.balance === "number" ? feeData.balance : 0);
          if (typeof feeData.usdtBalance === "number") {
            setHotBalanceUSDT(feeData.usdtBalance);
          }
        }
      }
    } catch (error) {
      console.error("wallet dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totalSweepable = userWallets.reduce((sum, wallet) => sum + (wallet.usdt_balance ?? 0), 0);
  const estimatedGasNeed = userWallets.length * 0.0005;

  const handleCopyMasterWallet = async () => {
    const address = masterHotWallet || feeWalletAddress || "";
    if (!address) {
      return;
    }

    await navigator.clipboard.writeText(address);
    setMasterWalletCopied(true);
    window.setTimeout(() => setMasterWalletCopied(false), 2000);
  };

  const formatSweepSummary = (data: any, dryRun: boolean) => {
    const summary = data?.summary;
    if (!summary) {
      return dryRun
        ? "드라이런 응답 요약을 불러오지 못했습니다."
        : "스윕 결과 요약을 불러오지 못했습니다.";
    }

    const head = dryRun
      ? `드라이런 완료: 실행 가능 ${summary.actionableUsers}건 / 전체 ${summary.totalUsersScanned}건`
      : `스윕 완료: 성공 ${summary.sweptUsers}건 / 실패 ${summary.failedUsers}건 / 제외 ${summary.skippedUsers}건`;
    const amountText = `예상 스윕 ${formatNumber(Number(summary.totalSweepAmount), 6)} USDT, 필요 가스 ${formatNumber(Number(summary.requiredGasBnb), 6)} BNB`;
    const issueText = Array.isArray(summary.issues) && summary.issues.length > 0
      ? ` 경고 ${summary.issues.length}건이 함께 기록되었습니다.`
      : "";

    return `${head}. ${amountText}.${issueText}`;
  };

  const handleSweep = async (dryRun = false) => {
    if (totalSweepable <= 0) {
      setSweepMsg({ type: "err", text: "스윕 가능한 사용자 USDT 잔액이 없습니다." });
      return;
    }

    if (!masterHotWallet) {
      setSweepMsg({ type: "err", text: "마스터 핫월렛 주소가 설정되어 있지 않습니다." });
      return;
    }

    if (!dryRun) {
      const confirmed = window.confirm(
        `총 ${formatNumber(totalSweepable, 6)} USDT를 ${masterHotWallet} 로 실제 스윕할까요?\n\n실행 시 BSC 메인넷 트랜잭션이 전송되고, 성공한 지갑만 DB 잔액이 차감됩니다.`,
      );
      if (!confirmed) {
        return;
      }
    }

    setLoadingSweep(dryRun ? "dry-run" : "live");
    setSweepMsg(null);

    try {
      const response = await fetch("/api/wallet/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_wallet: masterHotWallet, dryRun }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Sweep request failed.");
      }

      setSweepMsg({
        type: "ok",
        text: formatSweepSummary(data, dryRun),
      });

      if (!dryRun) {
        void fetchData();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setSweepMsg({ type: "err", text: `오류: ${message}` });
    } finally {
      setLoadingSweep(null);
    }
  };

  const handleColdTransfer = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number.parseFloat(vaultAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setVaultMsg({ type: "err", text: "전송할 금액을 올바르게 입력해 주세요." });
      return;
    }

    if (!coldVaultAddress.trim()) {
      setVaultMsg({ type: "err", text: "콜드월렛 주소를 먼저 입력해 주세요." });
      return;
    }

    if (vaultAsset === "USDT" && hotBalanceUSDT !== null && amount > hotBalanceUSDT) {
      setVaultMsg({
        type: "err",
        text: `핫월렛 USDT 잔액(${formatNumber(hotBalanceUSDT, 6)} USDT)을 초과했습니다.`,
      });
      return;
    }

    const confirmed = window.confirm(
      `${amount.toLocaleString("ko-KR")} ${vaultAsset}를 콜드월렛으로 전송할까요?\n\n실행 시 실제 BSC 메인넷 트랜잭션이 전송되며, 성공 시 이력도 함께 기록됩니다.`,
    );
    if (!confirmed) {
      return;
    }

    setLoadingVault(true);
    setVaultMsg(null);

    try {
      const response = await fetch("/api/wallet/cold-vault-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          asset: vaultAsset,
          coldVaultAddress,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Cold vault transfer failed.");
      }

      setVaultMsg({
        type: "ok",
        text: `${amount.toLocaleString("ko-KR")} ${vaultAsset} 콜드월렛 이체가 기록되었습니다. TX: ${result.txHash ?? "-"}`,
      });
      setVaultAmount("");
      void fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setVaultMsg({ type: "err", text: `오류: ${message}` });
    } finally {
      setLoadingVault(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#8E8E93]">
        <RefreshCw className="mr-2 animate-spin" size={18} />
        지갑 현황을 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div className="relative space-y-8 font-sans">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center space-x-2 text-2xl font-bold tracking-tight text-white">
            <Wallet className="text-[#00D2FF]" />
            <span>지갑 Sweep / Cold Vault 관리</span>
          </h2>
          <p className="mt-1 text-sm text-[#8E8E93]">
            사용자 입금 지갑의 USDT를 마스터 핫월렛으로 모으고, 필요 시 콜드월렛 이체까지 한 화면에서 관리합니다.
          </p>
        </div>

        <button
          onClick={() => void fetchData()}
          className="flex cursor-pointer items-center space-x-1.5 rounded-lg bg-[#26262B] px-3 py-2 text-xs text-[#8E8E93] transition-colors hover:bg-[#3A3A40]"
        >
          <RefreshCw size={13} />
          <span>새로고침</span>
        </button>
      </div>

      <div className="flex items-start space-x-3 rounded-xl border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 p-4">
        <Info size={16} className="mt-0.5 flex-shrink-0 text-[#FF9F0A]" />
        <div className="text-xs leading-relaxed text-[#EAECEF]">
          <span className="font-bold text-[#FF9F0A]">주의</span>
          {" "}스윕 실행과 콜드월렛 전송은 모두 실제 BSC 메인넷 트랜잭션을 발생시킵니다. 먼저 `Dry Run`으로 대상과 가스비를 점검한 뒤 진행해 주세요.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider text-white">
              <ArrowDownRight size={18} className="text-[#00D2FF]" />
              <span>1. 사용자 지갑 Sweep</span>
            </h4>
            <span className="rounded border border-[#30D5C8]/20 bg-[#30D5C8]/10 px-2 py-0.5 text-[10px] font-bold text-[#30D5C8]">
              BSC BEP-20
            </span>
          </div>

          <div className="space-y-3 rounded-xl border border-[#26262B] bg-[#121215] p-4">
            <div className="flex items-center justify-between border-b border-[#26262B] pb-2">
              <label className="text-[10px] font-bold uppercase text-[#00D2FF]">마스터 핫월렛</label>
              <span className="rounded bg-[#00D2FF]/10 px-2 py-0.5 text-[10px] font-bold text-[#00D2FF]">
                Sweep 수령 주소
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-[#8E8E93]">
                가스비 대납 및 Sweep 수령용 지갑
              </p>
              <div className="mt-1 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => void handleCopyMasterWallet()}
                  disabled={!masterHotWallet && !feeWalletAddress}
                  title="지갑 주소 복사"
                  className="flex-shrink-0 cursor-pointer text-[#00D2FF] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {masterWalletCopied ? <Check size={16} className="text-[#0ECB81]" /> : <Copy size={16} />}
                </button>
                <span className="break-all font-mono text-xs text-white">
                  {masterHotWallet || feeWalletAddress || "설정된 마스터 핫월렛 주소가 없습니다."}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border border-[#26262B] bg-[#1C1C21] p-2.5">
                <p className="text-[9px] font-bold uppercase text-[#8E8E93]">가스 지갑 BNB</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#30D5C8]">
                  {formatNumber(feeWalletBalance, 6)} BNB
                </p>
              </div>
              <div className="rounded-lg border border-[#26262B] bg-[#1C1C21] p-2.5">
                <p className="text-[9px] font-bold uppercase text-[#8E8E93]">핫월렛 USDT</p>
                <p className="mt-1 font-mono text-sm font-bold text-white">
                  {formatNumber(hotBalanceUSDT, 6)} USDT
                </p>
              </div>
            </div>

            {feeWalletBalance < estimatedGasNeed && userWallets.length > 0 && (
              <p className="mt-2 flex items-start gap-1 text-[10px] font-semibold text-[#FF453A]">
                <span>현재 BNB 잔액이 전체 스윕 예상 가스비보다 적습니다. 실행 전 충전이 필요할 수 있습니다.</span>
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-[#FF9F0A]/30 bg-[#1C1C21] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center space-x-1 text-[10px] font-bold uppercase text-[#8E8E93]">
                  <ShieldAlert size={12} className="text-[#FF9F0A]" />
                  <span>DB 기준 Sweep 대상 잔액</span>
                </p>
                <p className="mt-1 font-mono text-xl font-extrabold text-white">
                  {formatNumber(totalSweepable, 6)} <span className="text-xs text-[#8E8E93]">USDT</span>
                </p>
                <p className="mt-0.5 text-[10px] text-[#8E8E93]">{userWallets.length}개 사용자 지갑</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-[#8E8E93]">예상 가스비</p>
                <p className="mt-1 font-mono text-sm font-bold text-[#FF9F0A]">
                  ~{formatNumber(estimatedGasNeed, 6)} BNB
                </p>
                <p className="mt-0.5 text-[10px] text-[#8E8E93]">{userWallets.length} x 0.0005 BNB</p>
              </div>
            </div>
          </div>

          {userWallets.length > 0 ? (
            <div className="max-h-40 overflow-x-auto overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#26262B] text-[#8E8E93]">
                    <th className="px-2 py-2 text-left font-semibold">사용자</th>
                    <th className="px-2 py-2 text-left font-semibold">지갑 주소</th>
                    <th className="px-2 py-2 text-right font-semibold">잔액 (USDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {userWallets.map((wallet) => (
                    <tr key={wallet.user_id} className="border-b border-[#26262B]/30">
                      <td className="px-2 py-1.5 text-[#EAECEF]">{wallet.email}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-[#8E8E93]">
                        {wallet.wallet_address}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-white">
                        {formatNumber(wallet.usdt_balance, 6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-[#8E8E93]">Sweep 대상 지갑이 없습니다.</p>
          )}

          {sweepMsg && (
            <div className={`flex items-start space-x-2 rounded-lg border p-3 text-xs ${
              sweepMsg.type === "ok"
                ? "border-[#30D5C8]/30 bg-[#30D5C8]/10 text-[#30D5C8]"
                : "border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF453A]"
            }`}
            >
              {sweepMsg.type === "ok"
                ? <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                : <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />}
              <span>{sweepMsg.text}</span>
            </div>
          )}

          <div className="space-y-1.5 rounded-xl border border-[#26262B] bg-[#121215] p-3 text-[11px] text-[#8E8E93]">
            <p className="font-semibold text-white">Sweep 체크리스트</p>
            <p>1. 먼저 `Dry Run`으로 실행 대상, 예상 스윕 수량, 필요 가스비를 확인하세요.</p>
            <p>2. 가스 지갑의 BNB가 부족하면 실제 Sweep은 중간에 실패할 수 있습니다.</p>
            <p>3. 실제 실행 후에는 성공한 건만 DB 잔액과 원장 이력이 갱신됩니다.</p>
          </div>

          <button
            onClick={() => void handleSweep(true)}
            disabled={loadingSweep !== null || totalSweepable <= 0}
            className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-[#26262B] py-3.5 text-xs font-bold text-white transition-all hover:bg-[#303038] disabled:opacity-40"
          >
            {loadingSweep === "dry-run" ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <>
                <Info size={16} />
                <span>Dry Run 실행</span>
              </>
            )}
          </button>

          <button
            onClick={() => void handleSweep(false)}
            disabled={loadingSweep !== null || totalSweepable <= 0}
            className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] py-3.5 text-xs font-bold text-white shadow-[0_0_15px_rgba(0,210,255,0.2)] transition-all hover:opacity-90 disabled:opacity-40"
          >
            {loadingSweep === "live" ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <>
                <span>Sweep 실제 실행</span>
                <ArrowRightLeft size={16} />
              </>
            )}
          </button>
        </div>

        <div className="space-y-5 rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider text-white">
              <Lock size={18} className="text-[#30D5C8]" />
              <span>2. Cold Vault 이체</span>
            </h4>
            <span className="rounded border border-[#BF5AF2]/20 bg-[#BF5AF2]/10 px-2 py-0.5 text-[10px] font-bold text-[#BF5AF2]">
              실트랜잭션
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#26262B] bg-[#121215] p-3">
              <p className="text-[10px] font-bold uppercase text-[#8E8E93]">핫월렛 USDT 잔액</p>
              <p className="mt-1 font-mono text-base font-extrabold text-[#30D5C8]">
                {formatNumber(hotBalanceUSDT, 6)} USDT
              </p>
              <p className="mt-0.5 text-[10px] text-[#8E8E93]">온체인 기준</p>
            </div>
            <div className="rounded-xl border border-[#26262B] bg-[#121215] p-3">
              <p className="text-[10px] font-bold uppercase text-[#8E8E93]">누적 Cold Vault USDT</p>
              <p className="mt-1 font-mono text-base font-extrabold text-[#BF5AF2]">
                {formatNumber(coldBalanceUSDT, 6)} USDT
              </p>
              <p className="mt-0.5 text-[10px] text-[#8E8E93]">로그 기준 누적값</p>
            </div>
          </div>

          <form onSubmit={(event) => void handleColdTransfer(event)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-[#8E8E93]">
                콜드월렛 주소 <span className="text-[#FF453A]">(필수)</span>
              </label>
              <div className="flex items-center space-x-2 rounded-xl border border-[#26262B] bg-[#1C1C21] p-2.5 transition-colors focus-within:border-[#30D5C8]">
                <ShieldCheck size={16} className="flex-shrink-0 text-[#30D5C8]" />
                <input
                  type="text"
                  value={coldVaultAddress}
                  onChange={(event) => setColdVaultAddress(event.target.value)}
                  placeholder="0x... 콜드월렛 주소 입력"
                  className="w-full bg-transparent font-mono text-xs text-white placeholder:text-[#555] focus:outline-none"
                />
              </div>
              {!coldVaultAddress && (
                <p className="text-[10px] text-[#FF9F0A]">
                  아직 콜드월렛 주소가 비어 있습니다. 전송 전에 정확한 주소를 입력해 주세요.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-[#8E8E93]">
                <label className="font-bold uppercase">전송 금액</label>
                {hotBalanceUSDT !== null && (
                  <button
                    type="button"
                    onClick={() => setVaultAmount(hotBalanceUSDT.toString())}
                    className="cursor-pointer font-bold text-[#00D2FF] hover:underline"
                  >
                    [최대값 입력]
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={vaultAmount}
                  onChange={(event) => setVaultAmount(event.target.value)}
                  placeholder="전송할 금액 입력"
                  className="w-full rounded-xl border border-[#26262B] bg-[#1C1C21] py-2.5 pl-3 pr-20 font-mono text-sm font-bold text-white outline-none placeholder:font-normal placeholder:text-[#555] focus:border-[#30D5C8]"
                />
                <select
                  value={vaultAsset}
                  onChange={(event) => setVaultAsset(event.target.value as "USDT" | "BNB")}
                  className="absolute right-2 top-2 rounded bg-[#26262B] px-2 py-1 text-xs font-bold text-[#30D5C8] focus:outline-none"
                >
                  <option value="USDT">USDT</option>
                  <option value="BNB">BNB</option>
                </select>
              </div>
            </div>

            {vaultMsg && (
              <div className={`flex items-start space-x-2 rounded-lg border p-3 text-xs ${
                vaultMsg.type === "ok"
                  ? "border-[#30D5C8]/30 bg-[#30D5C8]/10 text-[#30D5C8]"
                  : "border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF453A]"
              }`}
              >
                {vaultMsg.type === "ok"
                  ? <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
                  : <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />}
                <span>{vaultMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingVault || !coldVaultAddress}
              className="flex w-full cursor-pointer items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-[#30D5C8] to-[#BF5AF2] py-3.5 text-xs font-black text-white shadow-[0_0_15px_rgba(48,213,200,0.2)] transition-all hover:opacity-90 disabled:opacity-40"
            >
              {loadingVault ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <Lock size={16} />
                  <span>콜드월렛 이체 실행</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[#26262B] bg-[#16161A] p-6 shadow-lg">
        <h4 className="flex items-center space-x-2 text-sm font-bold uppercase tracking-wider text-white">
          <CheckCircle size={16} className="text-[#30D5C8]" />
          <span>Cold Vault 이체 로그</span>
        </h4>

        {vaultLogs.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#8E8E93]">
            <ArrowUpRight size={24} className="mx-auto mb-2 opacity-30" />
            아직 기록된 콜드월렛 이체 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#26262B] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  <th className="px-4 py-3">출발</th>
                  <th className="px-4 py-3">도착</th>
                  <th className="px-4 py-3">금액</th>
                  <th className="px-4 py-3">주소</th>
                  <th className="px-4 py-3">TX</th>
                  <th className="px-4 py-3 text-right">기록 시각</th>
                </tr>
              </thead>
              <tbody>
                {vaultLogs.map((log) => {
                  const txHash = getVaultTransferTxHash(log.note ?? "");
                  return (
                    <tr key={log.id} className="border-b border-[#26262B]/40 transition-all hover:bg-[#1C1C21]/30">
                      <td className="px-4 py-3 font-medium text-white">{log.from_label}</td>
                      <td className="px-4 py-3 font-medium text-[#BF5AF2]">{log.to_label}</td>
                      <td className="px-4 py-3 font-mono font-extrabold text-[#30D5C8]">
                        {formatNumber(log.amount, 6)} {log.asset}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[#8E8E93]">
                        {log.cold_vault_address
                          ? `${log.cold_vault_address.slice(0, 10)}...${log.cold_vault_address.slice(-6)}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px]">
                        {txHash ? (
                          <a
                            href={`https://bscscan.com/tx/${txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#00D2FF] underline underline-offset-2 hover:text-white"
                          >
                            {`${txHash.slice(0, 8)}...${txHash.slice(-6)}`}
                          </a>
                        ) : (
                          <span className="text-[#8E8E93]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[#8E8E93]">
                        {new Date(log.created_at).toLocaleString("ko-KR", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
