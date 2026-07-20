"use client";

import React, { useState } from "react";
import { 
  Home, 
  Wallet, 
  Gamepad2, 
  Users, 
  Settings, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCw, 
  Copy, 
  Check, 
  AlertCircle,
  Play,
  TrendingUp,
  Award,
  ChevronRight,
  Info,
  Layers,
  ArrowRightLeft
} from "lucide-react";

type TabType = "home" | "wallet" | "game" | "network" | "settings";
type NetworkTabType = "direct" | "placement";

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [networkTab, setNetworkTab] = useState<NetworkTabType>("direct");
  const [referralCopied, setReferralCopied] = useState(false);
  
  // Wallet States
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isUsdtToUrc, setIsUsdtToUrc] = useState(true);

  // Withdraw States
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  const handleSwapAmountChange = (val: string) => {
    setFromAmount(val);
    if (!val || isNaN(Number(val))) {
      setToAmount("");
      return;
    }
    const num = Number(val);
    if (isUsdtToUrc) {
      // 0.1% fee
      setToAmount((num * 0.999).toFixed(4));
    } else {
      setToAmount((num * 0.999).toFixed(4));
    }
  };

  const copyReferral = () => {
    navigator.clipboard.writeText("REF-URC-883920");
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  // Re-calculate withdrawal fee
  const getWithdrawalFee = () => {
    const amt = Number(withdrawAmount);
    if (!amt || isNaN(amt)) return 0;
    return amt * 0.05;
  };

  const getWithdrawalFinal = () => {
    const amt = Number(withdrawAmount);
    if (!amt || isNaN(amt)) return 0;
    return amt * 0.95;
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#0C0C0E] min-h-screen pb-20 flex flex-col justify-between relative shadow-2xl border-x border-[#1C1C21]">
      
      {/* 1. Main View Port */}
      <main className="flex-1 p-5 overflow-y-auto no-scrollbar">
        
        {/* ==================== HOME TAB ==================== */}
        {activeTab === "home" && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] flex items-center justify-center font-bold text-sm text-white">
                  C
                </div>
                <div>
                  <h2 className="text-sm text-[#8E8E93]">Welcome back</h2>
                  <h1 className="text-base font-bold text-white">C (Me) <span className="text-[10px] bg-[#30D5C8]/10 text-[#30D5C8] px-1.5 py-0.5 rounded ml-1 font-semibold">Active</span></h1>
                </div>
              </div>
              <span className="text-xs bg-[#1C1C21] border border-[#26262B] p-2 rounded-xl text-[#FF9F0A] font-mono">Referral ID: REF-URC-883920</span>
            </div>

            {/* Total Balance Card */}
            <div className="bg-gradient-to-br from-[#1C1C21] to-[#121215] border border-[#2C2C32] rounded-3xl p-6 relative overflow-hidden shadow-xl">
              <div className="space-y-1">
                <span className="text-xs text-[#8E8E93] uppercase tracking-wider font-semibold">Total Assets</span>
                <h2 className="text-3xl font-extrabold text-white">$15,480.00</h2>
                <div className="flex items-center space-x-1.5 text-[#30D5C8] text-xs font-semibold mt-1">
                  <TrendingUp size={14} />
                  <span>+12.4% last 24h</span>
                </div>
              </div>

              {/* Assets Breakdown */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-[#26262B]/50">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8E8E93] uppercase">USDT Balance</span>
                  <p className="text-sm font-bold text-white">10,500.00 USDT</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8E8E93] uppercase">URC Balance</span>
                  <p className="text-sm font-bold text-white">4,980.00 URC</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setActiveTab("wallet")} className="bg-[#16161A] hover:bg-[#1C1C21] border border-[#26262B] p-3 rounded-2xl flex flex-col items-center space-y-1.5 transition-all">
                <ArrowDownLeft size={20} className="text-[#00D2FF]" />
                <span className="text-xs font-semibold text-white">Deposit</span>
              </button>
              <button onClick={() => setActiveTab("wallet")} className="bg-[#16161A] hover:bg-[#1C1C21] border border-[#26262B] p-3 rounded-2xl flex flex-col items-center space-y-1.5 transition-all">
                <ArrowUpRight size={20} className="text-[#FF9F0A]" />
                <span className="text-xs font-semibold text-white">Withdraw</span>
              </button>
              <button onClick={() => setActiveTab("game")} className="bg-[#16161A] hover:bg-[#1C1C21] border border-[#26262B] p-3 rounded-2xl flex flex-col items-center space-y-1.5 transition-all">
                <Gamepad2 size={20} className="text-[#BF5AF2]" />
                <span className="text-xs font-semibold text-white">369 Game</span>
              </button>
            </div>

            {/* Game machine purchase summary */}
            <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-[#26262B] pb-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">My Active Game Machines</span>
                <span className="text-[10px] bg-[#BF5AF2]/10 text-[#BF5AF2] px-2 py-0.5 rounded font-bold">110 Entries Total</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8E8E93]">1단계 ($100)</span>
                  <span className="text-white font-bold">1대 (10회)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8E8E93]">3단계 ($1,000)</span>
                  <span className="text-white font-bold">1대 (100회)</span>
                </div>
                <div className="flex justify-between border-t border-[#26262B]/50 pt-2 text-white font-bold">
                  <span>Total Remaining Allowance</span>
                  <span className="text-[#00D2FF]">94 / 110 Entries Left</span>
                </div>
              </div>
            </div>

            {/* Recent activity list */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Activity</h3>
              <div className="bg-[#16161A] border border-[#26262B] rounded-2xl divide-y divide-[#26262B]">
                <div className="p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-full bg-[#30D5C8]/10 text-[#30D5C8] flex items-center justify-center font-bold">In</span>
                    <div>
                      <p className="font-semibold text-white">USDT Swapped from URC</p>
                      <p className="text-[10px] text-[#8E8E93] mt-0.5">Today, 15:10</p>
                    </div>
                  </div>
                  <p className="font-bold text-[#30D5C8]">+99.90 USDT</p>
                </div>
                <div className="p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-full bg-[#FF9F0A]/10 text-[#FF9F0A] flex items-center justify-center font-bold">Out</span>
                    <div>
                      <p className="font-semibold text-white">USDT Withdrawal Request</p>
                      <p className="text-[10px] text-[#8E8E93] mt-0.5">Yesterday, 14:42</p>
                    </div>
                  </div>
                  <p className="font-bold text-[#FF9F0A]">-50.00 USDT</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== WALLET TAB ==================== */}
        {activeTab === "wallet" && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Wallet Manager</h1>
            
            {/* Swap Section */}
            <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Instant Swap (0.1% Fee)</h3>
              
              <div className="bg-[#0C0C0E] border border-[#26262B] p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between text-xs text-[#8E8E93]">
                  <span>From</span>
                  <span>Balance: {isUsdtToUrc ? "10,500.00 USDT" : "4,980.00 URC"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={fromAmount}
                    onChange={(e) => handleSwapAmountChange(e.target.value)}
                    className="bg-transparent text-xl font-bold text-white focus:outline-none w-1/2" 
                  />
                  <span className={`px-2.5 py-1 rounded text-xs font-bold text-white ${isUsdtToUrc ? "bg-[#26A17B]" : "bg-[#BF5AF2]"}`}>
                    {isUsdtToUrc ? "USDT" : "URC"}
                  </span>
                </div>
              </div>

              {/* Swap direction toggle button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button 
                  onClick={() => { setIsUsdtToUrc(!isUsdtToUrc); setFromAmount(""); setToAmount(""); }}
                  className="w-8 h-8 rounded-full bg-[#26262B] border border-[#3E3E45] flex items-center justify-center text-[#00D2FF] hover:bg-[#3E3E45] transition-all"
                >
                  <ArrowRightLeft size={14} className="rotate-90" />
                </button>
              </div>

              <div className="bg-[#0C0C0E] border border-[#26262B] p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between text-xs text-[#8E8E93]">
                  <span>To</span>
                  <span>Balance: {isUsdtToUrc ? "4,980.00 URC" : "10,500.00 USDT"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    value={toAmount}
                    disabled
                    className="bg-transparent text-xl font-bold text-[#AEAEB2] focus:outline-none w-1/2" 
                  />
                  <span className={`px-2.5 py-1 rounded text-xs font-bold text-white ${isUsdtToUrc ? "bg-[#BF5AF2]" : "bg-[#26A17B]"}`}>
                    {isUsdtToUrc ? "URC" : "USDT"}
                  </span>
                </div>
              </div>

              <button className="w-full py-3 bg-[#BF5AF2] hover:bg-[#BF5AF2]/90 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-lg">
                <RefreshCw size={14} />
                <span>Swap Tokens</span>
              </button>
            </div>

            {/* Withdraw Section */}
            <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">USDT Withdrawal (5% Fee)</h3>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-semibold">Withdraw Amount</label>
                  <input 
                    type="number" 
                    placeholder="Min $50.00" 
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-[#0C0C0E] border border-[#26262B] p-3 rounded-xl text-sm text-white font-semibold focus:outline-none focus:border-[#00D2FF]" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#8E8E93] uppercase font-semibold">Destination BSC Address</label>
                  <input 
                    type="text" 
                    placeholder="0x..." 
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="w-full bg-[#0C0C0E] border border-[#26262B] p-3 rounded-xl text-sm text-white font-semibold focus:outline-none focus:border-[#00D2FF]" 
                  />
                </div>
                
                {/* Real-time Withdrawal Preview */}
                {Number(withdrawAmount) >= 50 && (
                  <div className="p-3 bg-[#0C0C0E] border border-[#26262B] rounded-xl text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#8E8E93]">Withdrawal Fee (5%):</span>
                      <span className="text-[#FF9F0A] font-semibold">${getWithdrawalFee().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#26262B]/50 pt-2 font-bold text-white">
                      <span>Final Est. Amount:</span>
                      <span className="text-[#30D5C8]">${getWithdrawalFinal().toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <button 
                  disabled={Number(withdrawAmount) < 50}
                  className={`w-full py-3 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-lg ${
                    Number(withdrawAmount) >= 50 ? "bg-[#00D2FF] text-[#0C0C0E] hover:opacity-90" : "bg-[#26262B] text-[#8E8E93] cursor-not-allowed"
                  }`}
                >
                  <ArrowUpRight size={14} />
                  <span>Submit Withdrawal</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== GAME TAB ==================== */}
        {activeTab === "game" && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">369 Powerball Game</h1>
            
            {/* Powerball balance & Purchase */}
            <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-4 flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-wider">My Powerball Balance</span>
                <h2 className="text-2xl font-extrabold text-white">540 Balls</h2>
              </div>
              <button className="px-3 py-2 bg-[#BF5AF2] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all">
                Buy Powerball
              </button>
            </div>

            {/* Game Room / Round List */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Beijing Schedule Rounds (Daily)</h3>
              
              <div className="space-y-3">
                {/* Round 1 */}
                <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-4 space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[9px] bg-[#30D5C8]/10 text-[#30D5C8] border border-[#30D5C8]/20 px-2 py-0.5 rounded font-semibold uppercase">1회차</span>
                      <h4 className="text-sm font-bold text-white mt-1">11:00 ~ 12:00 (KST 12:00 ~ 13:00)</h4>
                    </div>
                    <span className="text-[10px] text-[#8E8E93]">AI 발표: 12:30</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-[#26262B]/50 pt-3">
                    <span className="text-[#8E8E93]">Req: $100 Ticket + 3 Powerball</span>
                    <button className="px-3.5 py-1.5 bg-[#00D2FF] text-[#0C0C0E] font-bold rounded-lg flex items-center space-x-1 hover:opacity-90">
                      <Play size={10} fill="#0C0C0E" />
                      <span>Enter</span>
                    </button>
                  </div>
                </div>

                {/* Round 2 */}
                <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-4 space-y-3 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[9px] bg-[#30D5C8]/10 text-[#30D5C8] border border-[#30D5C8]/20 px-2 py-0.5 rounded font-semibold uppercase">2회차</span>
                      <h4 className="text-sm font-bold text-white mt-1">14:00 ~ 15:00 (KST 15:00 ~ 16:00)</h4>
                    </div>
                    <span className="text-[10px] text-[#8E8E93]">AI 발표: 15:30</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-[#26262B]/50 pt-3">
                    <span className="text-[#8E8E93]">Req: $100 Ticket + 3 Powerball</span>
                    <button className="px-3.5 py-1.5 bg-[#00D2FF] text-[#0C0C0E] font-bold rounded-lg flex items-center space-x-1 hover:opacity-90">
                      <Play size={10} fill="#0C0C0E" />
                      <span>Enter</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== NETWORK (조직) TAB ==================== */}
        {activeTab === "network" && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">My Network</h1>
            <p className="text-xs text-[#8E8E93] -mt-4">369 Game compensation plan trees.</p>

            {/* Network Sub-Tabs */}
            <div className="flex bg-[#16161A] p-1 rounded-xl border border-[#26262B]">
              <button 
                onClick={() => setNetworkTab("direct")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  networkTab === "direct" ? "bg-[#00D2FF] text-[#0C0C0E]" : "text-[#8E8E93] hover:text-white"
                }`}
              >
                추천 계보도 (Direct)
              </button>
              <button 
                onClick={() => setNetworkTab("placement")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  networkTab === "placement" ? "bg-[#BF5AF2] text-white" : "text-[#8E8E93] hover:text-white"
                }`}
              >
                후원 계보도 (Placement)
              </button>
            </div>

            {/* Tab 1: 추천계보도 (Direct Referral Line) */}
            {networkTab === "direct" && (
              <div className="space-y-4">
                <div className="p-4 bg-[#16161A] border border-[#26262B] rounded-2xl text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-[#00D2FF] mb-1">
                    <Info size={14} />
                    <span className="font-bold">추천계보 가이드</span>
                  </div>
                  <p className="text-[#8E8E93] leading-relaxed">
                    내가 직접 추천한 회원은 가입 순서에 관계없이 모두 내 하위 **1대 직급 라인**에 포함됩니다. 추천 보너스(20%)의 지급 기준이 됩니다.
                  </p>
                </div>

                {/* Direct Line Nodes List */}
                <div className="bg-[#16161A] border border-[#26262B] rounded-2xl divide-y divide-[#26262B] overflow-hidden">
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-full bg-[#121214] border border-[#26262B] flex items-center justify-center text-white font-semibold">1</span>
                      <div>
                        <p className="font-bold text-white">User_01</p>
                        <p className="text-[10px] text-[#8E8E93] mt-0.5">추천 순서: 1번째 (일반후원)</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-[#30D5C8]/10 text-[#30D5C8] px-2 py-0.5 rounded font-bold">Active</span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-full bg-[#121214] border border-[#26262B] flex items-center justify-center text-white font-semibold">2</span>
                      <div>
                        <p className="font-bold text-white">User_02</p>
                        <p className="text-[10px] text-[#8E8E93] mt-0.5">추천 순서: 2번째 (일반후원)</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-[#30D5C8]/10 text-[#30D5C8] px-2 py-0.5 rounded font-bold">Active</span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-full bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 flex items-center justify-center text-[#FF9F0A] font-semibold">3</span>
                      <div>
                        <p className="font-bold text-[#FF9F0A]">User_03 (롤업)</p>
                        <p className="text-[10px] text-[#FF9F0A]/80 mt-0.5">추천 순서: 3번째 ➔ 스폰서 B에게 롤업</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-[#FF9F0A]/10 text-[#FF9F0A] px-2 py-0.5 rounded font-bold border border-[#FF9F0A]/20">Pass-up</span>
                  </div>
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <span className="w-8 h-8 rounded-full bg-[#121214] border border-[#26262B] flex items-center justify-center text-white font-semibold">4</span>
                      <div>
                        <p className="font-bold text-white">User_04</p>
                        <p className="text-[10px] text-[#8E8E93] mt-0.5">추천 순서: 4번째 (일반후원)</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-[#30D5C8]/10 text-[#30D5C8] px-2 py-0.5 rounded font-bold">Active</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: 후원계보도 (Placement Roll-up Tree) */}
            {networkTab === "placement" && (
              <div className="space-y-4">
                <div className="p-4 bg-[#16161A] border border-[#26262B] rounded-2xl text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-[#BF5AF2] mb-1">
                    <Info size={14} />
                    <span className="font-bold">후원계보 (369 패스업) 가이드</span>
                  </div>
                  <p className="text-[#8E8E93] leading-relaxed">
                    내 직접 추천인 중 **3의 배수(3, 6, 9...)**는 내 스폰서 B의 하위 후원으로 배정됩니다. 또한, 내 하위 회원의 3배수 가입자(`User_01-3`)는 나(C)에게 패스업되어 붙습니다.
                  </p>
                </div>

                {/* Placement Tree Visualizer (High-fidelity Layout mock) */}
                <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex flex-col items-center">
                  <span className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-wider mb-4">후원 계보 시각화</span>
                  
                  {/* Tree Structure */}
                  <div className="flex flex-col items-center w-full">
                    {/* Level 0: C (Me) */}
                    <div className="bg-[#00D2FF]/10 border border-[#00D2FF] p-2.5 px-6 rounded-xl text-center">
                      <span className="text-xs font-bold text-[#00D2FF]">C (Me)</span>
                    </div>

                    {/* Connection line */}
                    <div className="w-[2px] h-6 bg-[#26262B]" />

                    {/* Level 1 Row */}
                    <div className="flex justify-between w-full px-4 relative">
                      {/* Horizonal connector bar */}
                      <div className="absolute top-0 left-12 right-12 h-[2px] bg-[#26262B]" />
                      
                      {/* Node 1: User_01 */}
                      <div className="flex flex-col items-center w-[28%] relative">
                        <div className="absolute top-0 w-[2px] h-3 bg-[#26262B] -mt-3" />
                        <div className="bg-[#1C1C21] border border-[#2C2C32] p-2 rounded-lg text-center w-full">
                          <span className="text-[10px] font-bold text-white block">User_01</span>
                          <span className="text-[8px] text-[#8E8E93]">1대 후원</span>
                        </div>
                        <div className="w-[2px] h-5 bg-[#26262B]" />
                        {/* Node 1-3 Rollup Under Me */}
                        <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A] p-1.5 rounded text-center w-full">
                          <span className="text-[9px] font-bold text-[#FF9F0A] block">User_01-3</span>
                          <span className="text-[7px] text-[#FF9F0A]/80">롤업 패스업</span>
                        </div>
                      </div>

                      {/* Node 2: User_02 */}
                      <div className="flex flex-col items-center w-[28%]">
                        <div className="absolute top-0 w-[2px] h-3 bg-[#26262B] -mt-3" />
                        <div className="bg-[#1C1C21] border border-[#2C2C32] p-2 rounded-lg text-center w-full">
                          <span className="text-[10px] font-bold text-white block">User_02</span>
                          <span className="text-[8px] text-[#8E8E93]">1대 후원</span>
                        </div>
                      </div>

                      {/* Node 3: User_01-3 (Rolled up member from downline User_01) */}
                      <div className="flex flex-col items-center w-[28%] relative">
                        <div className="absolute top-0 w-[2px] h-3 bg-[#26262B] -mt-3" />
                        <div className="bg-[#1C1C21] border border-[#2C2C32] p-2 rounded-lg text-center w-full">
                          <span className="text-[10px] font-bold text-white block">User_04</span>
                          <span className="text-[8px] text-[#8E8E93]">1대 후원</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== SETTINGS TAB ==================== */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <h1 className="text-xl font-bold text-white">Settings</h1>

            {/* PWA Add to Home Screen Instructions */}
            <div className="bg-gradient-to-br from-[#16161A] to-[#121215] border border-[#26262B] rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-2 text-[#00D2FF]">
                <Layers size={18} />
                <span className="text-sm font-bold">PWA: 바탕화면 바로가기 추가</span>
              </div>
              
              <div className="space-y-3 text-xs text-[#8E8E93] leading-relaxed">
                <p>본 앱은 모바일 브라우저 환경에서 동작하는 **PWA(Progressive Web App)**입니다. 스마트폰 홈 화면에 바로가기를 추가하여 설치 후 더 편리하게 관리해 보세요.</p>
                
                <div className="border-t border-[#26262B]/50 pt-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-[#26262B] text-white flex items-center justify-center font-bold text-[10px]">1</span>
                    <p className="text-white font-semibold">iOS (Safari)</p>
                  </div>
                  <p className="pl-7">하단 툴바의 **[공유 버튼]** ➡️ **[홈 화면에 추가]** 클릭.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-[#26262B] text-white flex items-center justify-center font-bold text-[10px]">2</span>
                    <p className="text-white font-semibold">Android (Chrome)</p>
                  </div>
                  <p className="pl-7">우측 상단 메뉴 ➡️ **[앱 설치]** 또는 **[홈 화면에 추가]** 클릭.</p>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button className="w-full py-3 bg-[#FF453A]/10 border border-[#FF453A]/20 hover:bg-[#FF453A]/20 text-[#FF453A] font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all">
              <span>Log Out</span>
            </button>
          </div>
        )}

      </main>

      {/* 2. App Bottom Navigation Bar (PWA Style Footer) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#16161A] border-t border-[#26262B] flex justify-around items-center z-50 max-w-md mx-auto border-x">
        <button 
          onClick={() => setActiveTab("home")} 
          className={`flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === "home" ? "text-[#00D2FF]" : "text-[#8E8E93] hover:text-white"
          }`}
        >
          <Home size={18} />
          <span className="text-[9px] font-bold">홈</span>
        </button>

        <button 
          onClick={() => setActiveTab("wallet")} 
          className={`flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === "wallet" ? "text-[#00D2FF]" : "text-[#8E8E93] hover:text-white"
          }`}
        >
          <Wallet size={18} />
          <span className="text-[9px] font-bold">지갑</span>
        </button>

        <button 
          onClick={() => setActiveTab("game")} 
          className={`flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === "game" ? "text-[#00D2FF]" : "text-[#8E8E93] hover:text-white"
          }`}
        >
          <Gamepad2 size={18} />
          <span className="text-[9px] font-bold">게임</span>
        </button>

        <button 
          onClick={() => setActiveTab("network")} 
          className={`flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === "network" ? "text-[#00D2FF]" : "text-[#8E8E93] hover:text-white"
          }`}
        >
          <Users size={18} />
          <span className="text-[9px] font-bold">조직</span>
        </button>

        <button 
          onClick={() => setActiveTab("settings")} 
          className={`flex flex-col items-center justify-center space-y-1 transition-all ${
            activeTab === "settings" ? "text-[#00D2FF]" : "text-[#8E8E93] hover:text-white"
          }`}
        >
          <Settings size={18} />
          <span className="text-[9px] font-bold">설정</span>
        </button>
      </nav>

    </div>
  );
}
