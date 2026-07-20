"use client";

import React, { useState } from "react";
import { Wallet, ArrowRightLeft, ShieldAlert, CheckCircle, RefreshCw } from "lucide-react";

export default function WalletSweepPage() {
  const [loading, setLoading] = useState(false);
  const [masterWallet, setMasterWallet] = useState("0x3a9B8f5C...e1D4A");
  
  // Mock data for user wallets
  const [userWallets] = useState([
    { id: 1, email: "active_whale@example.com", address: "0xec65...5a8c", balance: 1450.50, asset: "USDT" },
    { id: 2, email: "trader_vip@example.com", address: "0x91ad...8e00", balance: 520.00, asset: "USDT" },
    { id: 3, email: "crypto_guy@example.com", address: "0x88c2...fa90", balance: 35.00, asset: "USDT" },
    { id: 4, email: "new_user99@example.com", address: "0x44d1...1b23", balance: 100.00, asset: "USDT" },
  ]);

  const totalSweepable = userWallets.reduce((acc, w) => acc + w.balance, 0);

  const handleSweep = async () => {
    if (!confirm(`총 ${totalSweepable} USDT를 마스터 지갑으로 모으시겠습니까?\n(예상 가스비: 약 0.04 BNB 소모)`)) return;
    
    setLoading(true);
    // TODO: Call actual sweep API
    setTimeout(() => {
      alert("성공적으로 지갑 모으기(Sweep) 트랜잭션이 네트워크에 전송되었습니다!");
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">지갑 모으기 (Wallet Sweep)</h2>
        <p className="text-sm text-[#8E8E93] mt-1">유저 개별 지갑에 예치된 자산을 마스터 지갑으로 일괄 전송합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sweep Action Panel */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">스윕(Sweep) 컨트롤 패널</h4>
            <div className="flex items-center space-x-2 text-xs font-semibold px-2.5 py-1 bg-[#30D5C8]/10 text-[#30D5C8] rounded-lg">
              <CheckCircle size={14} />
              <span>네트워크 정상 (BSC)</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-[#121215] rounded-xl border border-[#26262B]">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">마스터 지갑 (수신처)</label>
              <div className="flex items-center space-x-3 mt-2">
                <Wallet size={20} className="text-[#00D2FF]" />
                <input 
                  type="text" 
                  value={masterWallet} 
                  onChange={(e) => setMasterWallet(e.target.value)}
                  className="bg-transparent border-none text-white font-mono text-sm focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-[#1C1C21] rounded-xl border border-[#FF9F0A]/30">
              <div>
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold flex items-center space-x-1">
                  <ShieldAlert size={12} className="text-[#FF9F0A]" />
                  <span>모으기 대기 자산 (총합)</span>
                </p>
                <p className="text-2xl font-extrabold text-white mt-1">{totalSweepable.toLocaleString()} <span className="text-sm text-[#8E8E93]">USDT</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#8E8E93] uppercase font-bold">예상 가스비 (Admin 부담)</p>
                <p className="text-sm font-bold text-[#FF9F0A] mt-1">~0.04 BNB</p>
              </div>
            </div>

            <button 
              onClick={handleSweep}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] hover:opacity-90 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(0,210,255,0.2)] disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <>
                  <span>마스터 지갑으로 즉시 전송</span>
                  <ArrowRightLeft size={18} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Wallets List */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">대상 지갑 목록</h4>
          
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {userWallets.map(w => (
              <div key={w.id} className="p-3 bg-[#121215]/60 rounded-xl border border-[#26262B]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-white truncate w-32">{w.email}</span>
                  <span className="text-xs font-bold text-[#30D5C8]">{w.balance} {w.asset}</span>
                </div>
                <div className="text-[10px] text-[#8E8E93] font-mono bg-[#1C1C21] p-1.5 rounded truncate">
                  {w.address}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
