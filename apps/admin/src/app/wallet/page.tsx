"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet, ArrowRightLeft, ShieldAlert, CheckCircle, RefreshCw,
  Lock, ArrowDownRight, ArrowUpRight, ShieldCheck, AlertTriangle, Info
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
  note: string | null;
  status?: "LEGACY" | "PROCESSING" | "BROADCAST" | "CONFIRMED" | "FAILED";
  tx_hash?: string | null;
  failure_reason?: string | null;
  requested_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
}

interface TransferConfiguration {
  enabled: boolean;
  sourceAddress: string | null;
  confirmationPhrase: string;
  network: string;
  armingIssues?: string[];
}

export default function WalletSweepPage() {
  const [loading, setLoading] = useState(true);

  // ── 실제 DB 데이터 ──
  const [userWallets, setUserWallets] = useState<UserWallet[]>([]);
  const [vaultLogs, setVaultLogs] = useState<VaultTransferLog[]>([]);

  // ── 설정값 (DB system_settings 또는 vault_settings에서 로드) ──
  const [masterHotWallet, setMasterHotWallet] = useState("");
  const [coldVaultAddress, setColdVaultAddress] = useState("");
  const [hotBalanceUSDT, setHotBalanceUSDT] = useState<number | null>(null);
  
  // ── 수수료 지갑 상태 ──
  const [feeWalletAddress, setFeeWalletAddress] = useState<string | null>(null);
  const [feeWalletBalance, setFeeWalletBalance] = useState<number>(0);

  // ── 이체 폼 ──
  const [vaultAmount, setVaultAmount] = useState("");
  const [vaultNote, setVaultNote] = useState("");
  const [transferConfirmation, setTransferConfirmation] = useState("");
  const [transferConfiguration, setTransferConfiguration] = useState<TransferConfiguration | null>(null);
  const [transferIdempotencyKey, setTransferIdempotencyKey] = useState<string | null>(null);
  const [bnbAmount, setBnbAmount] = useState("");
  const [bnbRecipientAddress, setBnbRecipientAddress] = useState("");
  const [bnbNote, setBnbNote] = useState("");
  const [bnbConfirmation, setBnbConfirmation] = useState("");
  const [bnbTransferConfiguration, setBnbTransferConfiguration] = useState<TransferConfiguration | null>(null);
  const [bnbTransferIdempotencyKey, setBnbTransferIdempotencyKey] = useState<string | null>(null);
  const [loadingSweep, setLoadingSweep] = useState(false);
  const [loadingVault, setLoadingVault] = useState(false);
  const [loadingBnbTransfer, setLoadingBnbTransfer] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [vaultMsg, setVaultMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [bnbTransferMsg, setBnbTransferMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── 자체 지갑 생성 상태 ──


  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statusRes = await fetch("/api/wallet/status");
      const statusData = await statusRes.json();
      
      if (statusData.success) {
        // 1. 유저 지갑 및 잔고 설정
        const mappedWallets = statusData.usersWithBalances.map((u: any) => {
          const usdtBalanceObj = u.user_balances?.find((b: any) => b.asset_id === 2);
          const usdt_balance = usdtBalanceObj ? parseFloat(usdtBalanceObj.available_balance) : 0;
          
          const wallet_address = u.user_wallets && u.user_wallets.length > 0
            ? u.user_wallets[0].address
            : "—";

          return {
            user_id: u.id,
            email: u.email ?? "—",
            wallet_address: wallet_address,
            usdt_balance: usdt_balance
          };
        });
        mappedWallets.sort((a: any, b: any) => b.usdt_balance - a.usdt_balance);
        setUserWallets(mappedWallets);

        // 2. 시스템 설정 설정
        if (statusData.settings) {
          const map: Record<string, string> = {};
          statusData.settings.forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
          setColdVaultAddress(map["cold_vault_address"] ?? "");
        }
        if (statusData.walletSnapshot?.address) {
          setMasterHotWallet(statusData.walletSnapshot.address);
        }
        if (typeof statusData.walletSnapshot?.usdtBalance === "number") {
          setHotBalanceUSDT(statusData.walletSnapshot.usdtBalance);
        }

        // 3. 콜드 금고 이체 로그
        if (statusData.logs) setVaultLogs(statusData.logs as VaultTransferLog[]);
      }

      // 4. 수수료 지갑 잔액 조회
      try {
        const feeRes = await fetch("/api/wallet/fee-status");
        const feeData = await feeRes.json();
        if (feeData.success) {
          setFeeWalletAddress(feeData.address);
          setFeeWalletBalance(feeData.balance);
          if (typeof feeData.usdtBalance === "number") {
            setHotBalanceUSDT(feeData.usdtBalance);
          }
        }
      } catch (err) {
        console.error("Fee wallet fetch error:", err);
      }

      // 5. External transfer configuration. This never includes a private key.
      try {
        const transferRes = await fetch("/api/wallet/transfers", { cache: "no-store" });
        const transferData = await transferRes.json();
        if (transferData.success) {
          setTransferConfiguration(transferData as TransferConfiguration);
          if (transferData.sourceAddress) {
            setMasterHotWallet(transferData.sourceAddress);
          }
        }

        const bnbTransferRes = await fetch("/api/wallet/bnb-transfers", { cache: "no-store" });
        const bnbTransferData = await bnbTransferRes.json();
        if (bnbTransferData.success) {
          setBnbTransferConfiguration(bnbTransferData as TransferConfiguration);
          if (bnbTransferData.sourceAddress) {
            setMasterHotWallet(bnbTransferData.sourceAddress);
          }
        }
      } catch (err) {
        console.error("External transfer configuration fetch error:", err);
      }
    } catch (err) {
      console.error("데이터 로드 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSweepable = userWallets.reduce((acc, w) => acc + (w.usdt_balance ?? 0), 0);



  // ── 스윕: API를 통해 DB 트랜잭션 수행 ──
  const handleSweep = async () => {
    if (totalSweepable <= 0) {
      setSweepMsg({ type: "err", text: "모으기 가능한 유저 잔액이 없습니다." });
      return;
    }
    if (!masterHotWallet) {
      setSweepMsg({ type: "err", text: "마스터 핫 지갑 주소가 생성되지 않았습니다." });
      return;
    }
    if (!confirm(`유저 개별 지갑 총 ${totalSweepable.toLocaleString()} USDT를 자체발행한 회사지갑(${masterHotWallet})으로 즉시 모으기(Sweep)하시겠습니까?\n\n⚠️ 이 작업은 즉시 유저 잔액을 차감하고 회사 지갑 잔액으로 병합합니다.`)) return;

    setLoadingSweep(true);
    setSweepMsg(null);
    try {
      const res = await fetch("/api/wallet/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSweepMsg({ 
        type: "ok", 
        text: `✅ 지갑 모으기(${totalSweepable.toLocaleString()} USDT)가 성공적으로 완료되어 회사 지갑 잔고에 반영되었습니다!` 
      });
      fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSweepMsg({ type: "err", text: `오류: ${msg}` });
    } finally {
      setLoadingSweep(false);
    }
  };

  // ── 마스터 핫 지갑에서 외부 BSC 지갑으로 실제 USDT 전송 ──
  const handleColdTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(vaultAmount);
    if (!Number.isFinite(val) || val <= 0) {
      setVaultMsg({ type: "err", text: "올바른 이체 수량을 입력해주세요." });
      return;
    }
    if (!coldVaultAddress || coldVaultAddress.trim() === "") {
      setVaultMsg({ type: "err", text: "콜드 금고 수신 지갑 주소를 입력해주세요." });
      return;
    }
    if (hotBalanceUSDT !== null && val > hotBalanceUSDT) {
      setVaultMsg({ type: "err", text: `핫 지갑 잔액(${hotBalanceUSDT.toLocaleString()} USDT)을 초과합니다.` });
      return;
    }
    if (transferConfirmation !== transferConfiguration?.confirmationPhrase) {
      setVaultMsg({ type: "err", text: `확인 문구 ${transferConfiguration?.confirmationPhrase ?? "SEND USDT"}를 정확히 입력해주세요.` });
      return;
    }

    if (!confirm(
      `[실제 BSC USDT 전송]\n\n전송 수량: ${val.toLocaleString()} USDT\n수신 지갑: ${coldVaultAddress}\n네트워크: BSC (BEP-20)\n\n이 작업은 되돌릴 수 없습니다. 주소와 네트워크를 다시 확인하세요.\n\n실제 전송을 진행하시겠습니까?`
    )) return;

    setLoadingVault(true);
    setVaultMsg(null);
    try {
      // Reuse the key after an uncertain network response so retrying the same
      // form cannot create a second on-chain transfer.
      const idempotencyKey = transferIdempotencyKey ?? crypto.randomUUID();
      setTransferIdempotencyKey(idempotencyKey);
      const res = await fetch("/api/wallet/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: coldVaultAddress,
          amount: vaultAmount,
          note: vaultNote,
          confirmation: transferConfirmation,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.transfer?.status === "FAILED") {
          setTransferIdempotencyKey(null);
        }
        throw new Error(data.error || "외부 지갑 전송에 실패했습니다.");
      }

      setVaultMsg({
        type: "ok",
        text: data.transfer.status === "CONFIRMED"
          ? `전송이 1회 블록 확정되었습니다. TX: ${data.transfer.txHash}`
          : `전송이 네트워크에 제출되었습니다. BSCScan에서 TX 상태를 확인하세요: ${data.transfer.txHash}`,
      });
      setVaultAmount("");
      setVaultNote("");
      setTransferConfirmation("");
      setTransferIdempotencyKey(null);
      fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setVaultMsg({ type: "err", text: `오류: ${msg}` });
    } finally {
      setLoadingVault(false);
    }
  };

  const handleBnbTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(bnbAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBnbTransferMsg({ type: "err", text: "Enter a positive BNB amount." });
      return;
    }
    if (!bnbRecipientAddress.trim()) {
      setBnbTransferMsg({ type: "err", text: "Enter a BSC recipient address." });
      return;
    }
    if (amount >= feeWalletBalance) {
      setBnbTransferMsg({ type: "err", text: "Leave BNB for the network fee; the full wallet balance cannot be sent." });
      return;
    }
    if (bnbConfirmation !== bnbTransferConfiguration?.confirmationPhrase) {
      setBnbTransferMsg({
        type: "err",
        text: `Type ${bnbTransferConfiguration?.confirmationPhrase ?? "SEND BNB"} exactly to confirm.`,
      });
      return;
    }
    if (!confirm(
      `[BSC BNB transfer]\n\nAmount: ${amount.toLocaleString()} BNB\nRecipient: ${bnbRecipientAddress}\nNetwork: BSC\n\nThis action is irreversible. Verify the address and network before continuing.\n\nProceed with the real transfer?`
    )) return;

    setLoadingBnbTransfer(true);
    setBnbTransferMsg(null);
    try {
      const idempotencyKey = bnbTransferIdempotencyKey ?? crypto.randomUUID();
      setBnbTransferIdempotencyKey(idempotencyKey);
      const res = await fetch("/api/wallet/bnb-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAddress: bnbRecipientAddress,
          amount: bnbAmount,
          note: bnbNote,
          confirmation: bnbConfirmation,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.transfer?.status === "FAILED") {
          setBnbTransferIdempotencyKey(null);
        }
        throw new Error(data.error || "BNB transfer failed.");
      }

      setBnbTransferMsg({
        type: "ok",
        text: data.transfer.status === "CONFIRMED"
          ? `BNB transfer confirmed after one BSC block. TX: ${data.transfer.txHash}`
          : `BNB transfer was broadcast. Check the BSCScan transaction status: ${data.transfer.txHash}`,
      });
      setBnbAmount("");
      setBnbNote("");
      setBnbConfirmation("");
      setBnbTransferIdempotencyKey(null);
      fetchData();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setBnbTransferMsg({ type: "err", text: `Error: ${message}` });
    } finally {
      setLoadingBnbTransfer(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8E8E93] text-sm">
        <RefreshCw className="animate-spin mr-2" size={18} />
        DB에서 실제 데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans relative">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Wallet className="text-[#00D2FF]" />
            <span>지갑 자산 모으기 &amp; 콜드 금고 이체 관리</span>
          </h2>
          <p className="text-sm text-[#8E8E93] mt-1">
            유저 지갑 자산 모으기(Sweep)와 마스터 핫 지갑의 BSC USDT 외부 전송을 관리합니다.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center space-x-1.5 px-3 py-2 bg-[#26262B] hover:bg-[#3A3A40] text-[#8E8E93] rounded-lg text-xs transition-colors cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>새로고침</span>
        </button>
      </div>

      {/* ⚠️ 실제 자산 전송 안내 배너 */}
      <div className="flex items-start space-x-3 p-4 bg-[#FF453A]/10 border border-[#FF453A]/30 rounded-xl">
        <Info size={16} className="text-[#FF9F0A] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#EAECEF] leading-relaxed">
          <span className="font-bold text-[#FF453A]">[실제 자산 전송] </span>
          외부 지갑 전송은 BSC(BEP-20)에서 <strong>실제 USDT 트랜잭션을 전송</strong>합니다.
          수신 주소와 네트워크를 반드시 재확인하고, 전송 뒤에는 BSCScan 트랜잭션 해시로 확정 상태를 확인하세요.
        </div>
      </div>

      {/* Main Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Panel 1: User Wallets → Master Hot Wallet Sweep */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <ArrowDownRight size={18} className="text-[#00D2FF]" />
              <span>1단계: 유저 지갑 ➔ 마스터 핫 지갑 모으기</span>
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#30D5C8]/10 text-[#30D5C8] rounded border border-[#30D5C8]/20">BSC BEP-20</span>
          </div>

          {/* 통합 마스터 핫 지갑 정보 */}
          <div className="p-4 bg-[#121215] rounded-xl border border-[#26262B] space-y-3">
            <div className="flex justify-between items-center border-b border-[#26262B] pb-2">
              <label className="text-[10px] text-[#00D2FF] uppercase font-bold">통합 마스터 핫 지갑 정보</label>
              <span className="text-[10px] px-2 py-0.5 bg-[#00D2FF]/10 text-[#00D2FF] rounded font-bold">마스터 지갑 단일화</span>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold flex items-center space-x-1">
                <span>마스터 지갑 주소 (USDT 수집 및 BNB 가스비 대납)</span>
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <Wallet size={16} className="text-[#00D2FF] flex-shrink-0" />
                <span className="text-white font-mono text-xs break-all">
                  {masterHotWallet || feeWalletAddress || "⚠️ 미등록 (시스템 설정에서 생성/등록 필요)"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-2.5 bg-[#1C1C21] rounded-lg border border-[#26262B]">
                <p className="text-[9px] text-[#8E8E93] uppercase font-bold">보유 BNB (가스비 잔액)</p>
                <p className="text-sm font-bold text-[#30D5C8] font-mono mt-1">
                  {feeWalletBalance.toFixed(4)} BNB
                </p>
              </div>
              <div className="p-2.5 bg-[#1C1C21] rounded-lg border border-[#26262B]">
                <p className="text-[9px] text-[#8E8E93] uppercase font-bold">보유 USDT (회사 자산)</p>
                <p className="text-sm font-bold text-white font-mono mt-1">
                  {hotBalanceUSDT !== null ? hotBalanceUSDT.toLocaleString() : "0"} USDT
                </p>
              </div>
            </div>

            {feeWalletBalance < (userWallets.length * 0.0005) && userWallets.length > 0 && (
              <p className="text-[10px] text-[#FF453A] font-semibold mt-2 flex items-start gap-1">
                <span>⚠️ 경고: 마스터 핫 지갑의 BNB 잔액이 부족하여 스윕이 실패할 수 있습니다. 위 주소로 BNB를 입금하세요.</span>
              </p>
            )}
          </div>

          {/* 모으기 가능 잔액 정보 */}
          <div className="p-4 bg-[#1C1C21] rounded-xl border border-[#FF9F0A]/30 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold flex items-center space-x-1">
                  <ShieldAlert size={12} className="text-[#FF9F0A]" />
                  <span>유저 지갑 총 잔액 (DB 실제값)</span>
                </p>
                <p className="text-xl font-extrabold text-white mt-1 font-mono">
                  {totalSweepable.toLocaleString()} <span className="text-xs text-[#8E8E93]">USDT</span>
                </p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">{userWallets.length}개 유저 지갑 합산</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold">총 필요 예상 가스비</p>
                <p className="text-sm font-bold text-[#FF9F0A] mt-1 font-mono">~{(userWallets.length * 0.0005).toFixed(4)} BNB</p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">{userWallets.length} x 0.0005 BNB</p>
              </div>
            </div>
          </div>

          {/* 유저 지갑 목록 */}
          {userWallets.length > 0 ? (
            <div className="overflow-x-auto max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#8E8E93] border-b border-[#26262B]">
                    <th className="py-2 px-2 text-left font-semibold">이메일</th>
                    <th className="py-2 px-2 text-right font-semibold">잔액 (USDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {userWallets.map((w) => (
                    <tr key={w.user_id} className="border-b border-[#26262B]/30">
                      <td className="py-1.5 px-2 text-[#EAECEF]">{w.email}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-white">{w.usdt_balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-[#8E8E93] text-center py-4">유저 지갑 데이터 없음</p>
          )}

          {sweepMsg && (
            <div className={`flex items-start space-x-2 p-3 rounded-lg text-xs ${sweepMsg.type === "ok" ? "bg-[#30D5C8]/10 border border-[#30D5C8]/30 text-[#30D5C8]" : "bg-[#FF453A]/10 border border-[#FF453A]/30 text-[#FF453A]"}`}>
              {sweepMsg.type === "ok" ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
              <span>{sweepMsg.text}</span>
            </div>
          )}

          <button
            onClick={handleSweep}
            disabled={loadingSweep || totalSweepable <= 0}
            className="w-full py-3.5 bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] hover:opacity-90 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(0,210,255,0.2)] disabled:opacity-40 text-xs cursor-pointer"
          >
            {loadingSweep ? <RefreshCw size={16} className="animate-spin" /> : (
              <>
                <span>온체인 스윕 실행하기</span>
                <ArrowRightLeft size={16} />
              </>
            )}
          </button>
        </div>

        {/* Panel 2: Master Hot Wallet → External USDT Transfer */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Lock size={18} className="text-[#30D5C8]" />
              <span>2단계: 핫 지갑 ➔ 외부 지갑 USDT 전송</span>
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${transferConfiguration?.enabled ? "bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/20" : "bg-[#FF9F0A]/10 text-[#FF9F0A] border-[#FF9F0A]/20"}`}>
              {transferConfiguration?.enabled ? "실제 전송 사용" : "전송 비활성"}
            </span>
          </div>

          {!transferConfiguration?.enabled && transferConfiguration?.armingIssues?.length ? (
            <p className="rounded-lg border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 px-3 py-2 text-[10px] leading-relaxed text-[#FF9F0A]">
              {transferConfiguration.armingIssues.join(" ")}
            </p>
          ) : null}

          {/* 핫/콜드 잔액 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold">핫 지갑 잔액</p>
              {hotBalanceUSDT !== null ? (
                <p className="text-base font-extrabold text-[#30D5C8] mt-1 font-mono">{hotBalanceUSDT.toLocaleString()} USDT</p>
              ) : (
                <p className="text-xs text-[#8E8E93] mt-1">미설정</p>
              )}
              <p className="text-[10px] text-[#8E8E93] mt-0.5">BSC 온체인 조회</p>
            </div>
            <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold">전송 네트워크</p>
              <p className="text-base font-extrabold text-[#BF5AF2] mt-1 font-mono">BSC</p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">USDT BEP-20 전용</p>
            </div>
          </div>

          <form onSubmit={handleColdTransfer} className="space-y-4">
            {/* 외부 수신 주소 */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">
                외부 수신 지갑 주소 <span className="text-[#FF453A]">(BSC BEP-20)</span>
              </label>
              <div className="flex items-center space-x-2 p-2.5 bg-[#1C1C21] border border-[#26262B] focus-within:border-[#30D5C8] rounded-xl transition-colors">
                <ShieldCheck size={16} className="text-[#30D5C8] flex-shrink-0" />
                <input
                  type="text"
                  value={coldVaultAddress}
                  onChange={(e) => {
                    setColdVaultAddress(e.target.value);
                    setTransferIdempotencyKey(null);
                  }}
                  placeholder="0x... (수신 BSC 지갑 주소 입력)"
                  className="bg-transparent border-none text-white font-mono text-xs focus:outline-none w-full placeholder:text-[#555]"
                />
              </div>
              {!coldVaultAddress && (
                <p className="text-[10px] text-[#FF9F0A]">주소가 비어 있습니다. 수신 BSC 지갑 주소를 입력하세요.</p>
              )}
            </div>

            {/* 이체 수량 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] text-[#8E8E93]">
                <label className="uppercase font-bold">이체 수량</label>
                {hotBalanceUSDT !== null && (
                  <button
                    type="button"
                    onClick={() => setVaultAmount(hotBalanceUSDT.toString())}
                    className="text-[#00D2FF] font-bold hover:underline cursor-pointer"
                  >
                    [전액 선택: {hotBalanceUSDT.toLocaleString()} USDT]
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
                  onChange={(e) => {
                    setVaultAmount(e.target.value);
                    setTransferIdempotencyKey(null);
                  }}
                  placeholder="이체할 수량 입력"
                  className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#30D5C8] pl-3 pr-20 py-2.5 rounded-xl text-sm font-bold text-white font-mono outline-none placeholder:font-normal placeholder:text-[#555]"
                />
                <span className="absolute right-3 top-3 text-xs font-bold text-[#30D5C8]">USDT</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">감사 메모 (선택)</label>
              <input
                type="text"
                maxLength={500}
                value={vaultNote}
                onChange={(e) => {
                  setVaultNote(e.target.value);
                  setTransferIdempotencyKey(null);
                }}
                placeholder="예: 2026-08 운영 자금 콜드월렛 이체"
                className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#30D5C8] px-3 py-2.5 rounded-xl text-xs text-white outline-none placeholder:text-[#555]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-[#FF9F0A] uppercase font-bold">
                확인 문구 입력: {transferConfiguration?.confirmationPhrase ?? "SEND USDT"}
              </label>
              <input
                type="text"
                autoComplete="off"
                value={transferConfirmation}
                onChange={(e) => setTransferConfirmation(e.target.value)}
                placeholder={transferConfiguration?.confirmationPhrase ?? "SEND USDT"}
                className="w-full bg-[#1C1C21] border border-[#FF9F0A]/40 focus:border-[#FF9F0A] px-3 py-2.5 rounded-xl text-xs font-mono text-white outline-none placeholder:text-[#555]"
              />
              <p className="text-[10px] text-[#8E8E93]">개인키는 서버 환경변수에만 보관되며 이 화면에는 표시되지 않습니다.</p>
            </div>

            {/* 오류/성공 메시지 */}
            {vaultMsg && (
              <div className={`flex items-start space-x-2 p-3 rounded-lg text-xs ${vaultMsg.type === "ok" ? "bg-[#30D5C8]/10 border border-[#30D5C8]/30 text-[#30D5C8]" : "bg-[#FF453A]/10 border border-[#FF453A]/30 text-[#FF453A]"}`}>
                {vaultMsg.type === "ok" ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
                <span>{vaultMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingVault || !coldVaultAddress || !transferConfiguration?.enabled}
              className="w-full py-3.5 bg-gradient-to-r from-[#FF453A] to-[#FF9F0A] hover:opacity-90 text-white font-black rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(255,69,58,0.2)] disabled:opacity-40 text-xs cursor-pointer"
            >
              {loadingVault ? <RefreshCw size={16} className="animate-spin" /> : (
                <>
                  <Lock size={16} />
                  <span>실제 USDT 전송 및 1회 블록 확정 대기</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Lock size={18} className="text-[#FF9F0A]" />
              <span>BSC BNB external transfer</span>
            </h4>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${bnbTransferConfiguration?.enabled ? "bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/20" : "bg-[#FF9F0A]/10 text-[#FF9F0A] border-[#FF9F0A]/20"}`}>
              {bnbTransferConfiguration?.enabled ? "LIVE TRANSFER" : "DISABLED"}
            </span>
          </div>

          {!bnbTransferConfiguration?.enabled && bnbTransferConfiguration?.armingIssues?.length ? (
            <p className="rounded-lg border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 px-3 py-2 text-[10px] leading-relaxed text-[#FF9F0A]">
              {bnbTransferConfiguration.armingIssues.join(" ")}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold">Available BNB</p>
              <p className="text-base font-extrabold text-[#FF9F0A] mt-1 font-mono">{feeWalletBalance.toFixed(6)} BNB</p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">On-chain balance</p>
            </div>
            <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold">Network</p>
              <p className="text-base font-extrabold text-[#BF5AF2] mt-1 font-mono">BSC</p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">Native BNB only</p>
            </div>
          </div>

          <p className="rounded-lg border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 px-3 py-2 text-[10px] leading-relaxed text-[#FF9F0A]">
            Do not send the full BNB balance. The server reserves the estimated BSC gas fee and blocks a transfer that would leave too little BNB.
          </p>

          <form onSubmit={handleBnbTransfer} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">Recipient BSC address</label>
              <div className="flex items-center space-x-2 p-2.5 bg-[#1C1C21] border border-[#26262B] focus-within:border-[#FF9F0A] rounded-xl transition-colors">
                <ShieldCheck size={16} className="text-[#FF9F0A] flex-shrink-0" />
                <input
                  type="text"
                  value={bnbRecipientAddress}
                  onChange={(e) => {
                    setBnbRecipientAddress(e.target.value);
                    setBnbTransferIdempotencyKey(null);
                  }}
                  placeholder="0x..."
                  className="bg-transparent border-none text-white font-mono text-xs focus:outline-none w-full placeholder:text-[#555]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">BNB amount</label>
              <div className="relative">
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  value={bnbAmount}
                  onChange={(e) => {
                    setBnbAmount(e.target.value);
                    setBnbTransferIdempotencyKey(null);
                  }}
                  placeholder="Enter BNB amount"
                  className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#FF9F0A] pl-3 pr-16 py-2.5 rounded-xl text-sm font-bold text-white font-mono outline-none placeholder:font-normal placeholder:text-[#555]"
                />
                <span className="absolute right-3 top-3 text-xs font-bold text-[#FF9F0A]">BNB</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">Audit note (optional)</label>
              <input
                type="text"
                maxLength={500}
                value={bnbNote}
                onChange={(e) => {
                  setBnbNote(e.target.value);
                  setBnbTransferIdempotencyKey(null);
                }}
                placeholder="Example: BNB operating wallet top-up"
                className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#FF9F0A] px-3 py-2.5 rounded-xl text-xs text-white outline-none placeholder:text-[#555]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-[#FF9F0A] uppercase font-bold">
                Confirmation: {bnbTransferConfiguration?.confirmationPhrase ?? "SEND BNB"}
              </label>
              <input
                type="text"
                autoComplete="off"
                value={bnbConfirmation}
                onChange={(e) => setBnbConfirmation(e.target.value)}
                placeholder={bnbTransferConfiguration?.confirmationPhrase ?? "SEND BNB"}
                className="w-full bg-[#1C1C21] border border-[#FF9F0A]/40 focus:border-[#FF9F0A] px-3 py-2.5 rounded-xl text-xs font-mono text-white outline-none placeholder:text-[#555]"
              />
            </div>

            {bnbTransferMsg && (
              <div className={`flex items-start space-x-2 p-3 rounded-lg text-xs ${bnbTransferMsg.type === "ok" ? "bg-[#30D5C8]/10 border border-[#30D5C8]/30 text-[#30D5C8]" : "bg-[#FF453A]/10 border border-[#FF453A]/30 text-[#FF453A]"}`}>
                {bnbTransferMsg.type === "ok" ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
                <span>{bnbTransferMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loadingBnbTransfer || !bnbRecipientAddress || !bnbTransferConfiguration?.enabled}
              className="w-full py-3.5 bg-gradient-to-r from-[#FF9F0A] to-[#FF453A] hover:opacity-90 text-white font-black rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(255,159,10,0.2)] disabled:opacity-40 text-xs cursor-pointer"
            >
              {loadingBnbTransfer ? <RefreshCw size={16} className="animate-spin" /> : (
                <>
                  <Lock size={16} />
                  <span>Send BNB and wait for one BSC block</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Transfer History Log */}
      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-4">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
          <CheckCircle size={16} className="text-[#30D5C8]" />
          <span>마스터 지갑 외부 전송 감사 로그</span>
        </h4>

        {vaultLogs.length === 0 ? (
          <div className="py-10 text-center text-[#8E8E93] text-xs">
            <ArrowUpRight size={24} className="mx-auto mb-2 opacity-30" />
            아직 이체 기록이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">출발 지갑</th>
                  <th className="py-3 px-4">도착 지갑</th>
                  <th className="py-3 px-4">이체 수량</th>
                  <th className="py-3 px-4">수신 주소</th>
                  <th className="py-3 px-4">상태</th>
                  <th className="py-3 px-4">트랜잭션</th>
                  <th className="py-3 px-4 text-right">이체 시각</th>
                </tr>
              </thead>
              <tbody>
                {vaultLogs.map((log) => (
                  <tr key={log.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                    <td className="py-3 px-4 text-white font-medium">{log.from_label}</td>
                    <td className="py-3 px-4 text-[#BF5AF2] font-medium">{log.to_label}</td>
                    <td className="py-3 px-4 font-mono font-extrabold text-[#30D5C8]">
                      {log.amount.toLocaleString()} {log.asset}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#8E8E93] text-[10px]">
                      {log.cold_vault_address
                        ? `${log.cold_vault_address.slice(0, 10)}...${log.cold_vault_address.slice(-6)}`
                        : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-bold ${
                        log.status === "CONFIRMED" ? "bg-[#30D5C8]/10 text-[#30D5C8]" :
                        log.status === "FAILED" ? "bg-[#FF453A]/10 text-[#FF453A]" :
                        log.status === "BROADCAST" ? "bg-[#FF9F0A]/10 text-[#FF9F0A]" :
                        "bg-[#26262B] text-[#8E8E93]"
                      }`}>{log.status ?? "LEGACY"}</span>
                    </td>
                    <td className="py-3 px-4">
                      {log.tx_hash ? (
                        <a
                          href={`https://bscscan.com/tx/${log.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#00D2FF] hover:underline font-mono text-[10px]"
                        >
                          {`${log.tx_hash.slice(0, 10)}...${log.tx_hash.slice(-6)}`}
                        </a>
                      ) : <span className="text-[#8E8E93]">-</span>}
                    </td>
                    <td className="py-3 px-4 text-right text-[#8E8E93]">
                      {new Date(log.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  );
}
