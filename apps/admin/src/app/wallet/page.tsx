"use client";

import React, { useState } from "react";
import { Wallet, ArrowRightLeft, ShieldAlert, CheckCircle, RefreshCw, Lock, ArrowDownRight, ArrowUpRight, ShieldCheck } from "lucide-react";

interface TargetWallet {
  id: string;
  email: string;
  address: string;
  balance: number;
  asset: string;
}

interface TransferLog {
  id: string;
  from: string;
  to: string;
  amount: string;
  txHash: string;
  time: string;
}

export default function WalletSweepPage() {
  const [loadingSweep, setLoadingSweep] = useState(false);
  const [loadingVault, setLoadingVault] = useState(false);
  
  // Wallets
  const [masterHotWallet, setMasterHotWallet] = useState("0x3a9B8f5C01A29D478b1E4109C2d4317e1D4A8912");
  const [coldVaultWallet, setColdVaultWallet] = useState("0x71A9f8c4B901D2837482910481948194819A2931");
  
  // Cold Vault Transfer Form
  const [vaultAsset, setVaultAsset] = useState<"USDT" | "BNB">("USDT");
  const [vaultAmount, setVaultAmount] = useState<string>("5000");
  
  // Balances
  const [hotBalanceUSDT, setHotBalanceUSDT] = useState<number>(1000);
  const [coldBalanceUSDT, setColdBalanceUSDT] = useState<number>(9500);

  const [userWallets] = useState<TargetWallet[]>([
    { id: "w-1", email: "user@urc369.com", address: "0x3a9B...A8912", balance: 10500.00, asset: "USDT" },
    { id: "w-2", email: "b_kim@urc369.com", address: "0xec65...5a8c", balance: 0.00, asset: "USDT" },
    { id: "w-3", email: "yh_park@urc369.com", address: "0x91ad...8e00", balance: 0.00, asset: "USDT" },
  ]);

  const [transferLogs, setTransferLogs] = useState<TransferLog[]>([
    {
      id: "tx-v101",
      from: "핫 지갑 (0x3a9B...)",
      to: "콜드 금고 (0x71A9...)",
      amount: "5,000.00 USDT",
      txHash: "0xec8891...fa20",
      time: "오늘 10:30"
    }
  ]);

  const totalSweepable = userWallets.reduce((acc, w) => acc + w.balance, 0);

  // 1. User Wallets -> Master Hot Wallet Sweep
  const handleSweep = async () => {
    if (!confirm(`유저 개별 지갑의 총 ${totalSweepable.toLocaleString()} USDT 자산을 마스터 핫 지갑으로 일괄 모으시겠습니까?\n(예상 가스비: 약 0.04 BNB 소모)`)) return;
    
    setLoadingSweep(true);
    setTimeout(() => {
      alert("✅ 유저 지갑 ➔ 마스터 핫 지갑 자산 일괄 모으기(Sweep) 트랜잭션이 바이낸스 스마트 체인에 정상 전송되었습니다!");
      setHotBalanceUSDT(prev => prev + totalSweepable);
      setLoadingSweep(false);
    }, 1200);
  };

  // 2. Master Hot Wallet -> Cold Vault Transfer (대표님 요청 핵심!)
  const handleColdTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(vaultAmount);
    if (isNaN(val) || val <= 0) {
      alert("올바른 이체 수량을 입력해주세요.");
      return;
    }

    if (!confirm(`[마스터 핫 지갑 ➔ 오프라인 콜드 금고 안전 이체]\n\n이체 자산: ${val.toLocaleString()} ${vaultAsset}\n수신 콜드 지갑: ${coldVaultWallet}\n\n정말로 핫 지갑에서 콜드 오프라인 금고로 자산을 보관 이체하시겠습니까?`)) {
      return;
    }

    setLoadingVault(true);
    setTimeout(() => {
      if (vaultAsset === "USDT") {
        setHotBalanceUSDT(prev => Math.max(0, prev - val));
        setColdBalanceUSDT(prev => prev + val);
      }
      
      const newLog: TransferLog = {
        id: `tx-v${Date.now().toString().slice(-4)}`,
        from: "마스터 핫 지갑",
        to: "오프라인 콜드 금고",
        amount: `${val.toLocaleString()} ${vaultAsset}`,
        txHash: `0x${Math.random().toString(16).substring(2, 12)}...`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setTransferLogs([newLog, ...transferLogs]);
      alert(`🧊 [마스터 핫 지갑 ➔ 콜드 금고] ${val.toLocaleString()} ${vaultAsset} 이체가 정상 완료되었습니다!`);
      setLoadingVault(false);
    }, 1500);
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
          <Wallet className="text-[#00D2FF]" />
          <span>지갑 자산 모으기 & 콜드 금고 이체 관리</span>
        </h2>
        <p className="text-sm text-[#8E8E93] mt-1">
          유저 지갑 자산 모으기(Sweep) 및 마스터 핫 지갑과 오프라인 콜드 금고(Cold Vault) 간의 안전 자산 이체를 제어합니다.
        </p>
      </div>

      {/* Main Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel 1: User Wallets -> Master Hot Wallet Sweep */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <ArrowDownRight size={18} className="text-[#00D2FF]" />
              <span>1단계: 유저 지갑 ➔ 마스터 핫 지갑 자산 모으기 (Sweep)</span>
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#30D5C8]/10 text-[#30D5C8] rounded border border-[#30D5C8]/20">BSC BEP-20</span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#121215] rounded-xl border border-[#26262B]">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">마스터 핫 지갑 주소 (수신처)</label>
              <div className="flex items-center space-x-2 mt-2">
                <Wallet size={18} className="text-[#00D2FF] flex-shrink-0" />
                <input 
                  type="text" 
                  value={masterHotWallet} 
                  onChange={(e) => setMasterHotWallet(e.target.value)}
                  className="bg-transparent border-none text-white font-mono text-xs focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-[#1C1C21] rounded-xl border border-[#FF9F0A]/30">
              <div>
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold flex items-center space-x-1">
                  <ShieldAlert size={12} className="text-[#FF9F0A]" />
                  <span>모으기 대기 유저 자산</span>
                </p>
                <p className="text-xl font-extrabold text-white mt-1 font-mono">{totalSweepable.toLocaleString()} <span className="text-xs text-[#8E8E93]">USDT</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold">예상 네트워크 가스비</p>
                <p className="text-sm font-bold text-[#FF9F0A] mt-1 font-mono">~0.04 BNB</p>
              </div>
            </div>

            <button 
              onClick={handleSweep}
              disabled={loadingSweep}
              className="w-full py-3.5 bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] hover:opacity-90 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(0,210,255,0.2)] disabled:opacity-50 text-xs"
            >
              {loadingSweep ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <span>마스터 핫 지갑으로 자산 모으기 실행</span>
                  <ArrowRightLeft size={16} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Panel 2: Master Hot Wallet -> Cold Vault Transfer (★ 대표님 지적 사항) */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-6">
          <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Lock size={18} className="text-[#30D5C8]" />
              <span>2단계: 마스터 핫 지갑 ➔ 오프라인 콜드 금고 이체</span>
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#BF5AF2]/10 text-[#BF5AF2] rounded border border-[#BF5AF2]/20">보안 오프라인 금고</span>
          </div>

          <form onSubmit={handleColdTransfer} className="space-y-4">
            {/* Current Balances Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold">핫 지갑 잔액</p>
                <p className="text-base font-extrabold text-[#30D5C8] mt-1 font-mono">{hotBalanceUSDT.toLocaleString()} USDT</p>
              </div>
              <div className="p-3 bg-[#121215] rounded-xl border border-[#26262B]">
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold">콜드 금고 보관액</p>
                <p className="text-base font-extrabold text-[#BF5AF2] mt-1 font-mono">{coldBalanceUSDT.toLocaleString()} USDT</p>
              </div>
            </div>

            {/* Target Cold Vault Address */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">오프라인 콜드 금고 주소 (수신처)</label>
              <div className="flex items-center space-x-2 p-2.5 bg-[#1C1C21] border border-[#26262B] rounded-xl">
                <ShieldCheck size={16} className="text-[#30D5C8] flex-shrink-0" />
                <input 
                  type="text" 
                  value={coldVaultWallet} 
                  onChange={(e) => setColdVaultWallet(e.target.value)}
                  className="bg-transparent border-none text-white font-mono text-xs focus:outline-none w-full"
                />
              </div>
            </div>

            {/* Transfer Amount Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] text-[#8E8E93]">
                <label className="uppercase font-bold">보관 이체 수량</label>
                <button 
                  type="button" 
                  onClick={() => setVaultAmount(hotBalanceUSDT.toString())}
                  className="text-[#00D2FF] font-bold hover:underline"
                >
                  [전액 선택]
                </button>
              </div>
              <div className="relative">
                <input 
                  type="number"
                  step="100"
                  min="1"
                  required
                  value={vaultAmount}
                  onChange={(e) => setVaultAmount(e.target.value)}
                  className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#30D5C8] pl-3 pr-16 py-2.5 rounded-xl text-sm font-bold text-white font-mono outline-none"
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

            {/* Action Submit Button */}
            <button 
              type="submit"
              disabled={loadingVault}
              className="w-full py-3.5 bg-gradient-to-r from-[#30D5C8] to-[#BF5AF2] hover:opacity-90 text-white font-black rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(48,213,200,0.2)] disabled:opacity-50 text-xs"
            >
              {loadingVault ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <Lock size={16} />
                  <span>콜드 금고로 안전 보관 이체 실행</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-4">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
          <CheckCircle size={16} className="text-[#30D5C8]" />
          <span>지갑 간 이체 및 보관 이력 로그</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">이체 ID</th>
                <th className="py-3 px-4">출발 지갑</th>
                <th className="py-3 px-4">도착 지갑</th>
                <th className="py-3 px-4">이체 수량</th>
                <th className="py-3 px-4">Tx 해시</th>
                <th className="py-3 px-4 text-right">이체 시간</th>
              </tr>
            </thead>
            <tbody>
              {transferLogs.map((log) => (
                <tr key={log.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                  <td className="py-3 px-4 font-mono font-bold text-[#00D2FF]">{log.id}</td>
                  <td className="py-3 px-4 text-white font-medium">{log.from}</td>
                  <td className="py-3 px-4 text-white font-medium">{log.to}</td>
                  <td className="py-3 px-4 font-mono font-extrabold text-[#30D5C8]">{log.amount}</td>
                  <td className="py-3 px-4 font-mono text-[#8E8E93]">{log.txHash}</td>
                  <td className="py-3 px-4 text-right text-[#8E8E93]">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
