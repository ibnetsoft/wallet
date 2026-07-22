"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet, ArrowRightLeft, ShieldAlert, CheckCircle, RefreshCw,
  Lock, ArrowDownRight, ArrowUpRight, ShieldCheck, AlertTriangle, Info
} from "lucide-react";
import { supabaseAdmin } from "../../lib/supabase";

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

export default function WalletSweepPage() {
  const [loading, setLoading] = useState(true);

  // ── 실제 Supabase 데이터 ──
  const [userWallets, setUserWallets] = useState<UserWallet[]>([]);
  const [vaultLogs, setVaultLogs] = useState<VaultTransferLog[]>([]);

  // ── 설정값 (Supabase system_settings 또는 vault_settings에서 로드) ──
  const [masterHotWallet, setMasterHotWallet] = useState("");
  const [coldVaultAddress, setColdVaultAddress] = useState("");
  const [hotBalanceUSDT, setHotBalanceUSDT] = useState<number | null>(null);
  const [coldBalanceUSDT, setColdBalanceUSDT] = useState<number | null>(null);

  // ── 이체 폼 ──
  const [vaultAsset, setVaultAsset] = useState<"USDT" | "BNB">("USDT");
  const [vaultAmount, setVaultAmount] = useState("");
  const [loadingSweep, setLoadingSweep] = useState(false);
  const [loadingVault, setLoadingVault] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [vaultMsg, setVaultMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 유저 지갑 잔액 (wallets 테이블)
      const { data: wallets } = await supabaseAdmin
        .from("wallets")
        .select("user_id, usdt_balance, wallet_address, profiles(email)")
        .order("usdt_balance", { ascending: false })
        .limit(50);

      if (wallets) {
        setUserWallets(
          wallets.map((w: Record<string, unknown>) => ({
            user_id: w.user_id as string,
            email: ((w.profiles as Record<string, unknown>)?.email as string) ?? "—",
            wallet_address: (w.wallet_address as string) ?? "—",
            usdt_balance: (w.usdt_balance as number) ?? 0,
          }))
        );
      }

      // 2. 시스템 설정 (마스터 핫 지갑 주소, 콜드 금고 주소, 잔액)
      const { data: settings } = await supabaseAdmin
        .from("system_settings")
        .select("key, value");

      if (settings) {
        const map: Record<string, string> = {};
        settings.forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
        setMasterHotWallet(map["master_hot_wallet"] ?? "");
        setColdVaultAddress(map["cold_vault_address"] ?? "");
        setHotBalanceUSDT(map["hot_balance_usdt"] ? parseFloat(map["hot_balance_usdt"]) : null);
        setColdBalanceUSDT(map["cold_balance_usdt"] ? parseFloat(map["cold_balance_usdt"]) : null);
      }

      // 3. 콜드 금고 이체 로그
      const { data: logs } = await supabaseAdmin
        .from("vault_transfers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (logs) setVaultLogs(logs as VaultTransferLog[]);
    } catch (err) {
      console.error("데이터 로드 오류:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSweepable = userWallets.reduce((acc, w) => acc + (w.usdt_balance ?? 0), 0);

  // ── 스윕: 실제 블록체인 TX 없음 → Supabase에 sweep_requests 기록만 ──
  const handleSweep = async () => {
    if (totalSweepable <= 0) {
      setSweepMsg({ type: "err", text: "모으기 가능한 유저 잔액이 없습니다." });
      return;
    }
    if (!confirm(`유저 개별 지갑 총 ${totalSweepable.toLocaleString()} USDT를 마스터 핫 지갑으로 모으기 요청을 기록하시겠습니까?\n\n⚠️ 실제 블록체인 트랜잭션은 서버 측 스케줄러가 별도로 처리합니다.`)) return;

    setLoadingSweep(true);
    setSweepMsg(null);
    try {
      const { error } = await supabaseAdmin.from("sweep_requests").insert({
        total_amount: totalSweepable,
        target_wallet: masterHotWallet,
        status: "pending",
        requested_by: "admin",
      });
      if (error) throw error;
      setSweepMsg({ type: "ok", text: `✅ 스윕 요청(${totalSweepable.toLocaleString()} USDT)이 Supabase에 기록되었습니다. 서버 처리 후 반영됩니다.` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSweepMsg({ type: "err", text: `오류: ${msg}` });
    } finally {
      setLoadingSweep(false);
    }
  };

  // ── 콜드 금고 이체: 실제 블록체인 TX 없음 → vault_transfers에 기록 저장 ──
  const handleColdTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(vaultAmount);
    if (isNaN(val) || val <= 0) {
      setVaultMsg({ type: "err", text: "올바른 이체 수량을 입력해주세요." });
      return;
    }
    if (!coldVaultAddress || coldVaultAddress.trim() === "") {
      setVaultMsg({ type: "err", text: "콜드 금고 수신 지갑 주소를 입력해주세요." });
      return;
    }
    if (hotBalanceUSDT !== null && vaultAsset === "USDT" && val > hotBalanceUSDT) {
      setVaultMsg({ type: "err", text: `핫 지갑 잔액(${hotBalanceUSDT.toLocaleString()} USDT)을 초과합니다.` });
      return;
    }

    if (!confirm(
      `[마스터 핫 지갑 ➔ 오프라인 콜드 금고 이체 기록]\n\n이체 수량: ${val.toLocaleString()} ${vaultAsset}\n수신 지갑: ${coldVaultAddress}\n\n⚠️ 이 버튼은 Supabase에 이체 기록만 저장합니다.\n실제 블록체인 송금은 해당 지갑 앱에서 직접 실행하세요.\n\n계속하시겠습니까?`
    )) return;

    setLoadingVault(true);
    setVaultMsg(null);
    try {
      // 1. vault_transfers 기록 저장
      const { error: insertErr } = await supabaseAdmin.from("vault_transfers").insert({
        from_label: `마스터 핫 지갑 (${masterHotWallet.substring(0, 8)}...)`,
        to_label: `오프라인 콜드 금고`,
        amount: val,
        asset: vaultAsset,
        cold_vault_address: coldVaultAddress,
        note: "어드민 수동 이체 기록",
      });
      if (insertErr) throw insertErr;

      // 2. 콜드 금고 주소 업데이트 (변경된 경우)
      await supabaseAdmin
        .from("system_settings")
        .upsert({ key: "cold_vault_address", value: coldVaultAddress }, { onConflict: "key" });

      setVaultMsg({
        type: "ok",
        text: `📋 이체 기록(${val.toLocaleString()} ${vaultAsset} → 콜드 금고)이 저장되었습니다. 실제 블록체인 송금은 지갑 앱에서 직접 실행하세요.`,
      });
      setVaultAmount("");
      fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setVaultMsg({ type: "err", text: `오류: ${msg}` });
    } finally {
      setLoadingVault(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8E8E93] text-sm">
        <RefreshCw className="animate-spin mr-2" size={18} />
        Supabase에서 실제 데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Wallet className="text-[#00D2FF]" />
            <span>지갑 자산 모으기 &amp; 콜드 금고 이체 관리</span>
          </h2>
          <p className="text-sm text-[#8E8E93] mt-1">
            유저 지갑 자산 모으기(Sweep) 및 마스터 핫 지갑과 오프라인 콜드 금고(Cold Vault) 간의 안전 자산 이체 기록을 제어합니다.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center space-x-1.5 px-3 py-2 bg-[#26262B] hover:bg-[#3A3A40] text-[#8E8E93] rounded-lg text-xs transition-colors"
        >
          <RefreshCw size={13} />
          <span>새로고침</span>
        </button>
      </div>

      {/* ⚠️ 실제 데이터 안내 배너 */}
      <div className="flex items-start space-x-3 p-4 bg-[#FF9F0A]/10 border border-[#FF9F0A]/30 rounded-xl">
        <Info size={16} className="text-[#FF9F0A] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#EAECEF] leading-relaxed">
          <span className="font-bold text-[#FF9F0A]">[중요] </span>
          이 페이지의 모든 잔액과 지갑 주소는 <strong>Supabase의 실제 데이터</strong>입니다.
          &quot;스윕 실행&quot; 및 &quot;콜드 금고 이체&quot; 버튼은 <strong>블록체인에 직접 트랜잭션을 전송하지 않습니다.</strong>
          &nbsp;Supabase에 요청/기록을 저장하며, 실제 온체인 실행은 별도 지갑 앱(MetaMask, Trust Wallet 등)에서 직접 수행하세요.
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

          {/* 마스터 핫 지갑 주소 */}
          <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
            <label className="text-[10px] text-[#8E8E93] uppercase font-bold">마스터 핫 지갑 주소 (수신처)</label>
            <div className="flex items-center space-x-2 mt-2">
              <Wallet size={16} className="text-[#00D2FF] flex-shrink-0" />
              {masterHotWallet ? (
                <span className="text-white font-mono text-xs break-all">{masterHotWallet}</span>
              ) : (
                <span className="text-[#FF453A] text-xs">⚠️ 설정되지 않음 (system_settings 테이블에 master_hot_wallet 키 추가 필요)</span>
              )}
            </div>
          </div>

          {/* 모으기 가능 잔액 */}
          <div className="flex justify-between items-center p-4 bg-[#1C1C21] rounded-xl border border-[#FF9F0A]/30">
            <div>
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold flex items-center space-x-1">
                <ShieldAlert size={12} className="text-[#FF9F0A]" />
                <span>유저 지갑 총 잔액 (Supabase 실제값)</span>
              </p>
              <p className="text-xl font-extrabold text-white mt-1 font-mono">
                {totalSweepable.toLocaleString()} <span className="text-xs text-[#8E8E93]">USDT</span>
              </p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">{userWallets.length}개 유저 지갑 합산</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold">예상 가스비</p>
              <p className="text-sm font-bold text-[#FF9F0A] mt-1 font-mono">~0.04 BNB</p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">온체인 실제 소모</p>
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
            className="w-full py-3.5 bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] hover:opacity-90 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(0,210,255,0.2)] disabled:opacity-40 text-xs"
          >
            {loadingSweep ? <RefreshCw size={16} className="animate-spin" /> : (
              <>
                <span>스윕 요청 기록하기 (Supabase 저장)</span>
                <ArrowRightLeft size={16} />
              </>
            )}
          </button>
        </div>

        {/* Panel 2: Master Hot Wallet → Cold Vault Transfer */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Lock size={18} className="text-[#30D5C8]" />
              <span>2단계: 핫 지갑 ➔ 오프라인 콜드 금고 이체</span>
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#BF5AF2]/10 text-[#BF5AF2] rounded border border-[#BF5AF2]/20">기록만 저장</span>
          </div>

          {/* 핫/콜드 잔액 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold">핫 지갑 잔액</p>
              {hotBalanceUSDT !== null ? (
                <p className="text-base font-extrabold text-[#30D5C8] mt-1 font-mono">{hotBalanceUSDT.toLocaleString()} USDT</p>
              ) : (
                <p className="text-xs text-[#8E8E93] mt-1">미설정</p>
              )}
              <p className="text-[10px] text-[#8E8E93] mt-0.5">system_settings</p>
            </div>
            <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
              <p className="text-[10px] text-[#8E8E93] uppercase font-bold">콜드 금고 보관 기록</p>
              {coldBalanceUSDT !== null ? (
                <p className="text-base font-extrabold text-[#BF5AF2] mt-1 font-mono">{coldBalanceUSDT.toLocaleString()} USDT</p>
              ) : (
                <p className="text-xs text-[#8E8E93] mt-1">미설정</p>
              )}
              <p className="text-[10px] text-[#8E8E93] mt-0.5">누적 이체 기록 합산</p>
            </div>
          </div>

          <form onSubmit={handleColdTransfer} className="space-y-4">
            {/* 콜드 금고 수신 주소 */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">
                콜드 금고 수신 지갑 주소 <span className="text-[#FF453A]">(직접 입력)</span>
              </label>
              <div className="flex items-center space-x-2 p-2.5 bg-[#1C1C21] border border-[#26262B] focus-within:border-[#30D5C8] rounded-xl transition-colors">
                <ShieldCheck size={16} className="text-[#30D5C8] flex-shrink-0" />
                <input
                  type="text"
                  value={coldVaultAddress}
                  onChange={(e) => setColdVaultAddress(e.target.value)}
                  placeholder="0x... (실제 오프라인 콜드 지갑 주소 입력)"
                  className="bg-transparent border-none text-white font-mono text-xs focus:outline-none w-full placeholder:text-[#555]"
                />
              </div>
              {!coldVaultAddress && (
                <p className="text-[10px] text-[#FF9F0A]">⚠️ 주소가 비어 있습니다. 실제 콜드 지갑 주소를 입력하세요.</p>
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
                    className="text-[#00D2FF] font-bold hover:underline"
                  >
                    [전액 선택: {hotBalanceUSDT.toLocaleString()} USDT]
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0.01"
                  required
                  value={vaultAmount}
                  onChange={(e) => setVaultAmount(e.target.value)}
                  placeholder="이체할 수량 입력"
                  className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#30D5C8] pl-3 pr-20 py-2.5 rounded-xl text-sm font-bold text-white font-mono outline-none placeholder:font-normal placeholder:text-[#555]"
                />
                <select
                  value={vaultAsset}
                  onChange={(e) => setVaultAsset(e.target.value as "USDT" | "BNB")}
                  className="absolute right-2 top-2 bg-[#26262B] text-xs font-bold text-[#30D5C8] rounded px-2 py-1 border-none focus:outline-none"
                >
                  <option value="USDT">USDT</option>
                  <option value="BNB">BNB</option>
                </select>
              </div>
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
              disabled={loadingVault || !coldVaultAddress}
              className="w-full py-3.5 bg-gradient-to-r from-[#30D5C8] to-[#BF5AF2] hover:opacity-90 text-white font-black rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(48,213,200,0.2)] disabled:opacity-40 text-xs"
            >
              {loadingVault ? <RefreshCw size={16} className="animate-spin" /> : (
                <>
                  <Lock size={16} />
                  <span>이체 기록 저장 (실제 TX는 지갑 앱에서 직접 실행)</span>
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
          <span>콜드 금고 이체 기록 로그 (Supabase vault_transfers)</span>
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
                  <th className="py-3 px-4">도착 (콜드 금고)</th>
                  <th className="py-3 px-4">이체 수량</th>
                  <th className="py-3 px-4">수신 주소</th>
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
