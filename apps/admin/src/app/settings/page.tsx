"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Settings, Shield, UserPlus, Trash2, Key,
  Wallet, Lock, CheckCircle, AlertTriangle, RefreshCw, Eye, EyeOff, Save, PlusCircle
} from "lucide-react";
import { Wallet as EthersWallet } from "ethers";
import { supabaseAdmin } from "../../lib/supabase";

interface MsgState { type: "ok" | "err"; text: string }

export default function SettingsPage() {
  // ── 수수료 설정 ──
  const [swapFee, setSwapFee] = useState("0.1");
  const [withdrawalFee, setWithdrawalFee] = useState("3.0");
  const [savingFees, setSavingFees] = useState(false);
  const [feeMsg, setFeeMsg] = useState<MsgState | null>(null);

  // ── 지갑 주소 설정 ──
  const [hotWallet, setHotWallet] = useState("");
  const [hotPrivateKey, setHotPrivateKey] = useState(""); // 핫월렛 개인키
  const [coldVault, setColdVault] = useState("");
  const [hotBalanceUSDT, setHotBalanceUSDT] = useState("");
  const [coldBalanceUSDT, setColdBalanceUSDT] = useState("");
  const [savingWallets, setSavingWallets] = useState(false);
  const [walletMsg, setWalletMsg] = useState<MsgState | null>(null);
  const [showHot, setShowHot] = useState(false);
  const [showHotPk, setShowHotPk] = useState(false);
  const [showCold, setShowCold] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // ── 자체 지갑 생성 모달 관련 ──
  const [generatedWallet, setGeneratedWallet] = useState<{ address: string; privateKey: string } | null>(null);

  // ── 서브 관리자 ──
  const [subAdmins, setSubAdmins] = useState<{ id: number; email: string; role: string; permissions: string[]; createdAt: string }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [perms, setPerms] = useState({ withdraw: false, wallet: false });
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminMsg, setAdminMsg] = useState<MsgState | null>(null);

  // ── 설정값 Supabase 로드 ──
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const { data } = await supabaseAdmin
        .from("system_settings")
        .select("key, value");

      if (data) {
        const map: Record<string, string> = {};
        data.forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
        setSwapFee(map["swap_fee_rate"] ?? "0.1");
        setWithdrawalFee(map["withdrawal_fee_rate"] ?? "3.0");
        setHotWallet(map["master_hot_wallet"] ?? "");
        setHotPrivateKey(map["master_hot_wallet_private_key"] ?? "");
        setColdVault(map["cold_vault_address"] ?? "");
        setHotBalanceUSDT(map["hot_balance_usdt"] ?? "0");
        setColdBalanceUSDT(map["cold_balance_usdt"] ?? "0");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // ── 지갑 자체 생성 로직 ──
  const handleGenerateWallet = () => {
    try {
      const randomWallet = EthersWallet.createRandom();
      setGeneratedWallet({
        address: randomWallet.address,
        privateKey: randomWallet.privateKey
      });
    } catch (err) {
      console.error("지갑 생성 실패:", err);
      alert("지갑 생성 과정에서 오류가 발생했습니다.");
    }
  };

  const applyGeneratedWallet = () => {
    if (!generatedWallet) return;
    setHotWallet(generatedWallet.address);
    setHotPrivateKey(generatedWallet.privateKey);
    setGeneratedWallet(null);
    setWalletMsg({ type: "ok", text: "자체 생성된 지갑 주소와 개인키가 입력란에 적용되었습니다. 하단의 저장 버튼을 꼭 눌러주세요." });
  };

  // ── 수수료 저장 ──
  const handleSaveFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFees(true);
    setFeeMsg(null);
    try {
      const rows = [
        { key: "swap_fee_rate", value: swapFee, updated_at: new Date().toISOString() },
        { key: "withdrawal_fee_rate", value: withdrawalFee, updated_at: new Date().toISOString() },
      ];
      const { error } = await supabaseAdmin
        .from("system_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      setFeeMsg({ type: "ok", text: `수수료율이 저장되었습니다. (출금 ${withdrawalFee}%, 스왑 ${swapFee}%)` });
    } catch (err: unknown) {
      setFeeMsg({ type: "err", text: err instanceof Error ? err.message : "저장 실패" });
    } finally {
      setSavingFees(false);
    }
  };

  // ── 지갑 주소 저장 ──
  const handleSaveWallets = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWallets(true);
    setWalletMsg(null);
    try {
      const rows = [
        { key: "master_hot_wallet", value: hotWallet.trim(), updated_at: new Date().toISOString() },
        { key: "master_hot_wallet_private_key", value: hotPrivateKey.trim(), updated_at: new Date().toISOString() },
        { key: "cold_vault_address", value: coldVault.trim(), updated_at: new Date().toISOString() },
        { key: "hot_balance_usdt", value: hotBalanceUSDT, updated_at: new Date().toISOString() },
        { key: "cold_balance_usdt", value: coldBalanceUSDT, updated_at: new Date().toISOString() },
      ];
      const { error } = await supabaseAdmin
        .from("system_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
      setWalletMsg({ type: "ok", text: "지갑 주소, 개인키 및 잔액 설정이 Supabase에 저장되었습니다." });
    } catch (err: unknown) {
      setWalletMsg({ type: "err", text: err instanceof Error ? err.message : "저장 실패" });
    } finally {
      setSavingWallets(false);
    }
  };

  // ── 서브 관리자 추가 ──
  const handleAddSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setAddingAdmin(true);
    setAdminMsg(null);
    try {
      const permList = ["회원 조회"];
      if (perms.withdraw) permList.push("출금 승인");
      if (perms.wallet) permList.push("지갑 모으기");

      setSubAdmins(prev => [...prev, {
        id: Date.now(),
        email: newEmail,
        role: "서브 관리자",
        permissions: permList,
        createdAt: new Date().toISOString().split("T")[0],
      }]);
      setNewEmail("");
      setNewPassword("");
      setPerms({ withdraw: false, wallet: false });
      setAdminMsg({ type: "ok", text: `${newEmail} 서브 관리자가 추가되었습니다.` });
    } catch (err: unknown) {
      setAdminMsg({ type: "err", text: err instanceof Error ? err.message : "추가 실패" });
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = (id: number) => {
    if (confirm("정말로 이 서브 관리자 계정을 삭제하시겠습니까?")) {
      setSubAdmins(prev => prev.filter(a => a.id !== id));
    }
  };

  const MsgBox = ({ msg }: { msg: MsgState }) => (
    <div className={`flex items-start space-x-2 p-3 rounded-lg text-xs mt-3 ${msg.type === "ok"
      ? "bg-[#30D5C8]/10 border border-[#30D5C8]/30 text-[#30D5C8]"
      : "bg-[#FF453A]/10 border border-[#FF453A]/30 text-[#FF453A]"}`}>
      {msg.type === "ok"
        ? <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
        : <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
      <span>{msg.text}</span>
    </div>
  );

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">시스템 환경 설정</h2>
          <p className="text-sm text-[#8E8E93] mt-1">
            369어드민 마스터 전용 설정 페이지입니다. 지갑 주소, 수수료율, 관리자 계정을 제어합니다.
          </p>
        </div>
        <button
          onClick={loadSettings}
          className="flex items-center space-x-1.5 px-3 py-2 bg-[#26262B] hover:bg-[#3A3A40] text-[#8E8E93] rounded-lg text-xs transition-colors"
        >
          <RefreshCw size={13} />
          <span>새로고침</span>
        </button>
      </div>

      {settingsLoading ? (
        <div className="flex items-center justify-center h-32 text-[#8E8E93] text-sm">
          <RefreshCw className="animate-spin mr-2" size={18} />
          Supabase에서 설정값 로드 중...
        </div>
      ) : (
        <>
          {/* ━━━━ 자체 지갑 생성 확인 팝업/모달 ━━━━ */}
          {generatedWallet && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="bg-[#16161A] border border-[#30D5C8] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
                <div className="flex items-center space-x-2 text-[#30D5C8]">
                  <PlusCircle size={20} />
                  <h3 className="text-base font-bold text-white">마스터 핫 지갑 자체 생성 완료</h3>
                </div>
                <p className="text-xs text-[#8E8E93] leading-relaxed">
                  임의의 보안 지갑 주소와 개인키가 코드로 즉시 생성되었습니다. 
                  <strong className="text-[#FF9F0A] block mt-1">⚠️ [중요] 개인키(Private Key)는 외부로 유출되지 않도록 안전하게 보관하세요!</strong>
                </p>
                <div className="p-3 bg-[#0C0C0E] border border-[#26262B] rounded-lg space-y-2">
                  <div>
                    <span className="text-[10px] text-[#8E8E93] block font-bold">생성된 지갑 주소</span>
                    <span className="text-xs font-mono text-[#30D5C8] break-all">{generatedWallet.address}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#8E8E93] block font-bold">생성된 개인키 (Private Key)</span>
                    <span className="text-xs font-mono text-[#BF5AF2] break-all">{generatedWallet.privateKey}</span>
                  </div>
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={applyGeneratedWallet}
                    className="flex-1 py-2.5 bg-[#30D5C8] hover:bg-[#25b5a9] text-[#0C0C0E] font-bold rounded-lg text-xs transition-colors"
                  >
                    이 지갑 정보 적용하기
                  </button>
                  <button
                    onClick={() => setGeneratedWallet(null)}
                    className="px-4 py-2.5 bg-[#26262B] hover:bg-[#3A3A40] text-white rounded-lg text-xs transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ━━━━ 섹션 1: 지갑 주소 관리 ━━━━ */}
          <div className="bg-[#16161A] border border-[#30D5C8]/30 rounded-2xl p-6 shadow-lg">
            <div className="flex items-start justify-between mb-4 border-b border-[#26262B] pb-4">
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
                  <Wallet size={16} className="mr-2 text-[#30D5C8]" />
                  마스터 지갑 주소 관리
                </h4>
                <p className="text-[11px] text-[#8E8E93] mt-1">
                  마스터 핫 지갑과 오프라인 콜드 금고 주소를 등록 및 변경합니다. 저장된 주소는 지갑 관리 페이지에 즉시 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateWallet}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#30D5C8]/10 hover:bg-[#30D5C8]/25 text-[#30D5C8] rounded-lg text-xs font-bold border border-[#30D5C8]/30 transition-colors"
              >
                <PlusCircle size={13} />
                <span>핫 지갑 자체 생성</span>
              </button>
            </div>

            <form onSubmit={handleSaveWallets} className="space-y-5">
              {/* 핫 지갑 주소 */}
              <div className="p-4 bg-[#0C0C0E] border border-[#26262B] rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <Wallet size={14} className="text-[#00D2FF]" />
                  <span className="text-xs font-bold text-white">마스터 핫 지갑 (온라인 운영용)</span>
                  {hotWallet
                    ? <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#30D5C8]/20 text-[#30D5C8] rounded font-bold">등록됨</span>
                    : <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#FF453A]/20 text-[#FF453A] rounded font-bold">미등록</span>
                  }
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold">BSC 지갑 주소 (0x...)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showHot ? "text" : "password"}
                      value={hotWallet}
                      onChange={e => setHotWallet(e.target.value)}
                      placeholder="0x... (BEP-20 마스터 핫 지갑 주소)"
                      className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#00D2FF] pl-3 pr-10 py-2.5 rounded-lg text-sm text-white font-mono outline-none placeholder:font-normal placeholder:text-[#444]"
                    />
                    <button type="button" onClick={() => setShowHot(v => !v)}
                      className="absolute right-3 text-[#8E8E93] hover:text-white transition-colors">
                      {showHot ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {hotWallet && (
                    <p className="text-[10px] text-[#8E8E93] font-mono truncate">
                      현재: {hotWallet.slice(0, 12)}...{hotWallet.slice(-8)}
                    </p>
                  )}
                </div>
                
                {/* 핫 지갑 개인키 */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold">핫 지갑 개인키 (Private Key)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showHotPk ? "text" : "password"}
                      value={hotPrivateKey}
                      onChange={e => setHotPrivateKey(e.target.value)}
                      placeholder="0x... (지갑 모으기 서명용 개인키)"
                      className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#00D2FF] pl-3 pr-10 py-2.5 rounded-lg text-sm text-white font-mono outline-none placeholder:font-normal placeholder:text-[#444]"
                    />
                    <button type="button" onClick={() => setShowHotPk(v => !v)}
                      className="absolute right-3 text-[#8E8E93] hover:text-white transition-colors">
                      {showHotPk ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[9px] text-[#FF9F0A]">※ 직접 입력하거나 상단의 [핫 지갑 자체 생성]을 통해 부여받은 키가 들어갑니다.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold">현재 잔액 기록 (USDT)</label>
                  <input
                    type="number"
                    min="0"
                    value={hotBalanceUSDT}
                    onChange={e => setHotBalanceUSDT(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#00D2FF] px-3 py-2.5 rounded-lg text-sm text-white font-mono outline-none"
                  />
                  <p className="text-[10px] text-[#8E8E93]">※ 실제 온체인 잔액을 수동으로 입력합니다. 자동 조회 기능은 추후 연동 예정</p>
                </div>
              </div>

              {/* 콜드 금고 주소 */}
              <div className="p-4 bg-[#0C0C0E] border border-[#26262B] rounded-xl space-y-3">
                <div className="flex items-center space-x-2">
                  <Lock size={14} className="text-[#BF5AF2]" />
                  <span className="text-xs font-bold text-white">오프라인 콜드 금고 (하드웨어 월렛)</span>
                  {coldVault
                    ? <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#BF5AF2]/20 text-[#BF5AF2] rounded font-bold">등록됨</span>
                    : <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#FF9F0A]/20 text-[#FF9F0A] rounded font-bold">미등록 (차후 등록)</span>
                  }
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold">콜드 월렛 BSC 주소 (0x...)</label>
                  <div className="relative flex items-center">
                    <input
                      type={showCold ? "text" : "password"}
                      value={coldVault}
                      onChange={e => setColdVault(e.target.value)}
                      placeholder="하드웨어 월렛 구매 후 등록 (Ledger, Trezor 등)"
                      className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#BF5AF2] pl-3 pr-10 py-2.5 rounded-lg text-sm text-white font-mono outline-none placeholder:font-normal placeholder:text-[#444]"
                    />
                    <button type="button" onClick={() => setShowCold(v => !v)}
                      className="absolute right-3 text-[#8E8E93] hover:text-white transition-colors">
                      {showCold ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {!coldVault && (
                    <div className="flex items-start space-x-1.5 mt-1">
                      <AlertTriangle size={12} className="text-[#FF9F0A] flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-[#FF9F0A]">
                        콜드 월렛 미등록 상태입니다. 하드웨어 월렛 구매 후 이곳에 주소를 등록하세요.
                      </p>
                    </div>
                  )}
                  {coldVault && (
                    <p className="text-[10px] text-[#8E8E93] font-mono truncate">
                      현재: {coldVault.slice(0, 12)}...{coldVault.slice(-8)}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold">콜드 금고 보관 기록 (USDT)</label>
                  <input
                    type="number"
                    min="0"
                    value={coldBalanceUSDT}
                    onChange={e => setColdBalanceUSDT(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#BF5AF2] px-3 py-2.5 rounded-lg text-sm text-white font-mono outline-none"
                  />
                  <p className="text-[10px] text-[#8E8E93]">※ 이체 로그 기반 누적 보관액 (수동 입력)</p>
                </div>
              </div>

              {walletMsg && <MsgBox msg={walletMsg} />}

              <button
                type="submit"
                disabled={savingWallets}
                className="w-full py-3 bg-gradient-to-r from-[#30D5C8] to-[#BF5AF2] hover:opacity-90 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 text-sm"
              >
                {savingWallets
                  ? <><RefreshCw size={15} className="animate-spin" /><span>저장 중...</span></>
                  : <><Save size={15} /><span>지갑 주소 설정 저장 (Supabase)</span></>
                }
              </button>
            </form>
          </div>

          {/* ━━━━ 섹션 2 & 3: 수수료 + 서브관리자 ━━━━ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              {/* 수수료 설정 */}
              <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center mb-6">
                  <Settings size={16} className="mr-2 text-[#FCD535]" />
                  플랫폼 수수료 설정
                </h4>
                <form onSubmit={handleSaveFees} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#8E8E93] uppercase font-bold">스왑 수수료율 (URC ↔ USDT)</label>
                    <div className="relative">
                      <input
                        type="number" step="0.01" min="0" max="100" required
                        value={swapFee}
                        onChange={e => setSwapFee(e.target.value)}
                        className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#FCD535] pl-3 pr-8 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                      />
                      <span className="absolute right-3 top-2.5 text-[#8E8E93] text-sm">%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#8E8E93] uppercase font-bold">출금 수수료율 (기본값 3%)</label>
                    <div className="relative">
                      <input
                        type="number" step="0.1" min="0" max="100" required
                        value={withdrawalFee}
                        onChange={e => setWithdrawalFee(e.target.value)}
                        className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#FCD535] pl-3 pr-8 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                      />
                      <span className="absolute right-3 top-2.5 text-[#8E8E93] text-sm">%</span>
                    </div>
                  </div>
                  {feeMsg && <MsgBox msg={feeMsg} />}
                  <button
                    type="submit"
                    disabled={savingFees}
                    className="w-full py-3 mt-2 bg-[#FCD535] hover:bg-[#F3BA2F] text-[#0B0E11] font-bold rounded-lg transition-colors text-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {savingFees
                      ? <><RefreshCw size={14} className="animate-spin" /><span>저장 중...</span></>
                      : "수수료율 저장 (Supabase)"
                    }
                  </button>
                </form>
              </div>

              {/* 서브 관리자 추가 */}
              <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center mb-6">
                  <UserPlus size={16} className="mr-2 text-[#BF5AF2]" />
                  서브 관리자 추가
                </h4>
                <form onSubmit={handleAddSubAdmin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#8E8E93] uppercase font-bold">계정 이메일</label>
                    <input
                      type="email" required value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="admin@urc369.com"
                      className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#BF5AF2] px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#8E8E93] uppercase font-bold">초기 비밀번호</label>
                    <input
                      type="password" required value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="********"
                      className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#BF5AF2] px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    />
                  </div>
                  <div className="space-y-2 pt-2 border-t border-[#26262B]">
                    <label className="text-[10px] text-[#8E8E93] uppercase font-bold">권한 설정</label>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" checked disabled className="accent-[#BF5AF2]" />
                      <span className="text-xs text-[#EAECEF]">유저 조회 (기본)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" checked={perms.withdraw}
                        onChange={e => setPerms({ ...perms, withdraw: e.target.checked })}
                        className="accent-[#BF5AF2]" />
                      <span className="text-xs text-[#EAECEF]">출금 승인 및 반려</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" checked={perms.wallet}
                        onChange={e => setPerms({ ...perms, wallet: e.target.checked })}
                        className="accent-[#BF5AF2]" />
                      <span className="text-xs text-[#FF453A] font-bold">지갑 모으기 권한 (위험)</span>
                    </div>
                  </div>
                  {adminMsg && <MsgBox msg={adminMsg} />}
                  <button
                    type="submit"
                    disabled={addingAdmin}
                    className="w-full py-3 mt-2 bg-[#BF5AF2] hover:bg-[#9A3FD0] text-white font-bold rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    {addingAdmin ? "추가 중..." : "계정 생성하기"}
                  </button>
                </form>
              </div>
            </div>

            {/* 관리자 계정 목록 */}
            <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg lg:col-span-2">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center mb-6">
                <Shield size={16} className="mr-2 text-[#30D5C8]" />
                관리자 계정 목록
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">계정 이메일</th>
                      <th className="py-3 px-4">역할</th>
                      <th className="py-3 px-4">보유 권한</th>
                      <th className="py-3 px-4 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 마스터 고정 */}
                    <tr className="border-b border-[#26262B]/40 bg-[#30D5C8]/5">
                      <td className="py-4 px-4 font-bold text-[#30D5C8]">
                        <div className="flex items-center space-x-2">
                          <Key size={12} />
                          <span>master@ibnetsoft.com</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF9F0A]/20 text-[#FF9F0A]">SUPER_ADMIN</span>
                      </td>
                      <td className="py-4 px-4 text-[#8E8E93] text-[10px]">ALL_ACCESS</td>
                      <td className="py-4 px-4 text-center text-[#8E8E93] text-[10px]">—</td>
                    </tr>
                    {subAdmins.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#8E8E93] text-xs">
                          등록된 서브 관리자가 없습니다.
                        </td>
                      </tr>
                    ) : subAdmins.map((admin) => (
                      <tr key={admin.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                        <td className="py-4 px-4 font-medium text-white">{admin.email}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#BF5AF2]/20 text-[#BF5AF2]">{admin.role}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1">
                            {admin.permissions.map(p => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[9px] bg-[#26262B] text-[#EAECEF]">{p}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button onClick={() => handleDeleteAdmin(admin.id)} className="text-[#FF453A] hover:opacity-80 p-1">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
