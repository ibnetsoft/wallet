"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
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
  Play,
  TrendingUp,
  Award,
  Info,
  Layers,
  ArrowRightLeft,
  Star,
  GitBranch,
  Shield,
  Bell,
  ChevronRight,
  Zap,
  Trophy,
  BarChart3,
  UserPlus,
  ExternalLink,
} from "lucide-react";

/* ─────────────────────────── TYPES ─────────────────────────── */
type TabType = "home" | "wallet" | "game" | "network" | "settings";
type NetworkTabType = "referral" | "sponsor";

interface DirectMember {
  id: string;
  nickname: string;
  status: "ACTIVE" | "PENDING";
  referralSeq: number; // N번째 직추천 순번
  totalPurchase: number;
  isRollup: boolean; // referralSeq % 3 === 0
}

interface SponsorMember {
  id: string;
  nickname: string;
  status: "ACTIVE" | "PENDING";
  tier: number; // 1 = 내 후원 1대, 2 = 후원 2대
  isRolledIn: boolean; // 사위/며느리 (외부 롤업으로 유입)
  originalRecommender?: string; // 롤업 출처
  salesVolume: number;
}

/* ─────────────────────────── MOCK DATA ─────────────────────── */
const MOCK_DIRECT: DirectMember[] = [
  { id: "u1", nickname: "User_01", status: "ACTIVE", referralSeq: 1, totalPurchase: 500,  isRollup: false },
  { id: "u2", nickname: "User_02", status: "ACTIVE", referralSeq: 2, totalPurchase: 100,  isRollup: false },
  { id: "u3", nickname: "User_03", status: "ACTIVE", referralSeq: 3, totalPurchase: 1000, isRollup: true  }, // → B에게 롤업
  { id: "u4", nickname: "User_04", status: "ACTIVE", referralSeq: 4, totalPurchase: 100,  isRollup: false },
  { id: "u5", nickname: "User_05", status: "ACTIVE", referralSeq: 5, totalPurchase: 500,  isRollup: false },
  { id: "u6", nickname: "User_06", status: "PENDING",referralSeq: 6, totalPurchase: 1000, isRollup: true  }, // → B의 상위(A)에게 롤업
];

const MOCK_SPONSOR: SponsorMember[] = [
  // 직접 내 후원 1대 (식구)
  { id: "u1", nickname: "User_01", status: "ACTIVE",  tier: 1, isRolledIn: false, salesVolume: 500  },
  { id: "u2", nickname: "User_02", status: "ACTIVE",  tier: 1, isRolledIn: false, salesVolume: 100  },
  { id: "u4", nickname: "User_04", status: "ACTIVE",  tier: 1, isRolledIn: false, salesVolume: 100  },
  { id: "u5", nickname: "User_05", status: "ACTIVE",  tier: 1, isRolledIn: false, salesVolume: 500  },
  // 유입 사위/며느리: User_01의 3번째 직추천이 나에게 롤업
  { id: "u1-3", nickname: "User_01의 3번째 직추천", status: "ACTIVE", tier: 1, isRolledIn: true, originalRecommender: "User_01", salesVolume: 1000 },
];

/* ─────────────────────── STAR BADGE ───────────────────────── */
const STAR_COLORS = ["", "#FFD700", "#C0C0C0", "#CD7F32", "#00D2FF", "#BF5AF2", "#FF9F0A", "#FF453A"];
function StarBadge({ level }: { level: number }) {
  if (level === 0) return <span className="text-[10px] text-[#8E8E93] font-semibold">Normal</span>;
  return (
    <span className="flex items-center space-x-0.5">
      {Array.from({ length: level }).map((_, i) => (
        <Star key={i} size={10} fill={STAR_COLORS[level]} color={STAR_COLORS[level]} />
      ))}
      <span className="text-[10px] font-bold ml-1" style={{ color: STAR_COLORS[level] }}>{level}스타</span>
    </span>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
export default function MobileApp() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [networkTab, setNetworkTab] = useState<NetworkTabType>("referral");
  const [referralCopied, setReferralCopied] = useState(false);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isUsdtToUrc, setIsUsdtToUrc] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [directTree, setDirectTree] = useState<DirectMember[]>(MOCK_DIRECT);
  const [sponsorTree, setSponsorTree] = useState<SponsorMember[]>(MOCK_SPONSOR);
  const [userEmail, setUserEmail] = useState("Loading...");

  // Supabase Auth check
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "Unknown");
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // KST daily close countdown
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
      const nextClose = new Date(kstNow);
      nextClose.setUTCHours(15, 0, 0, 0); // 00:00 KST = 15:00 UTC
      if (kstNow.getUTCHours() >= 15) nextClose.setUTCDate(nextClose.getUTCDate() + 1);
      const diff = nextClose.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const copyReferral = () => {
    navigator.clipboard.writeText("https://app.urc369.com/ref/URC883920");
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const handleSwapChange = (val: string) => {
    setFromAmount(val);
    setToAmount(val && !isNaN(Number(val)) ? (Number(val) * 0.999).toFixed(4) : "");
  };

  const withdrawFee = Number(withdrawAmount) ? Number(withdrawAmount) * 0.05 : 0;
  const withdrawFinal = Number(withdrawAmount) ? Number(withdrawAmount) * 0.95 : 0;

  const fetchNetworkData = async () => {
    setLoadingNetwork(true);
    await new Promise(r => setTimeout(r, 800));
    setLoadingNetwork(false);
  };

  useEffect(() => { if (activeTab === "network") fetchNetworkData(); }, [activeTab]);

  /* ─────────── RENDER ─────────── */
  return (
    <div className="w-full max-w-md mx-auto bg-[#0A0A0C] min-h-screen pb-20 relative shadow-2xl border-x border-[#1C1C21] font-sans">

      {/* ── TOP STATUS BAR ── */}
      <div className="sticky top-0 z-40 bg-[#0A0A0C]/90 backdrop-blur-md border-b border-[#1C1C21] px-5 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] flex items-center justify-center text-white font-black text-xs">U</div>
          <span className="text-sm font-bold text-white">URC369</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-[#1C1C21] border border-[#26262B] rounded-lg px-2.5 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#30D5C8] animate-pulse" />
            <span className="text-[10px] text-[#30D5C8] font-bold">일마감 {countdown}</span>
          </div>
          <button className="relative p-1.5 bg-[#1C1C21] border border-[#26262B] rounded-lg">
            <Bell size={14} className="text-[#8E8E93]" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#FF453A] rounded-full" />
          </button>
        </div>
      </div>

      {/* ── MAIN SCROLL AREA ── */}
      <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

        {/* ═══════════════ HOME ═══════════════ */}
        {activeTab === "home" && (
          <div className="p-5 space-y-5">

            {/* Profile */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] flex items-center justify-center font-black text-white">C</div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#30D5C8] rounded-full border-2 border-[#0A0A0C] flex items-center justify-center">
                    <Check size={8} className="text-black" />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#8E8E93]">Welcome back</p>
                  <h1 className="text-base font-extrabold text-white">C (나)</h1>
                  <StarBadge level={2} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#8E8E93]">추천 코드</p>
                <button onClick={copyReferral} className="flex items-center space-x-1 bg-[#1C1C21] border border-[#26262B] px-2.5 py-1.5 rounded-lg mt-0.5">
                  <span className="text-[10px] text-[#FF9F0A] font-mono font-bold">URC883920</span>
                  {referralCopied ? <Check size={10} className="text-[#30D5C8]" /> : <Copy size={10} className="text-[#8E8E93]" />}
                </button>
              </div>
            </div>

            {/* Balance Card */}
            <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#141418] to-[#0D0D10] border border-[#2C2C35]"
              style={{ boxShadow: "0 0 40px rgba(0,210,255,0.07)" }}>
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#00D2FF]/5 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-[#BF5AF2]/5 blur-2xl" />
              <div className="relative">
                <p className="text-xs text-[#8E8E93] uppercase tracking-widest font-semibold">Total Assets</p>
                <h2 className="text-4xl font-black text-white mt-1 tracking-tight">$15,480<span className="text-2xl text-[#8E8E93]">.00</span></h2>
                <div className="flex items-center space-x-1.5 text-[#30D5C8] text-xs font-bold mt-1.5">
                  <TrendingUp size={12} />
                  <span>+12.4% last 24h</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-[#26262B]/60">
                  <div>
                    <p className="text-[9px] text-[#8E8E93] uppercase tracking-wider">USDT</p>
                    <p className="text-sm font-bold text-white mt-0.5">10,500.00</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#8E8E93] uppercase tracking-wider">URC</p>
                    <p className="text-sm font-bold text-white mt-0.5">4,980.00</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { icon: <ArrowDownLeft size={18} />, label: "입금", color: "#30D5C8", tab: "wallet" as TabType },
                { icon: <ArrowUpRight size={18} />, label: "출금", color: "#FF9F0A", tab: "wallet" as TabType },
                { icon: <ArrowRightLeft size={18} />, label: "스왑", color: "#BF5AF2", tab: "wallet" as TabType },
                { icon: <Gamepad2 size={18} />, label: "게임", color: "#00D2FF", tab: "game" as TabType },
              ].map((a) => (
                <button key={a.label} onClick={() => setActiveTab(a.tab)}
                  className="bg-[#141418] hover:bg-[#1C1C21] border border-[#26262B] p-3 rounded-2xl flex flex-col items-center space-y-1.5 transition-all active:scale-95">
                  <span style={{ color: a.color }}>{a.icon}</span>
                  <span className="text-[10px] font-bold text-[#AEAEB2]">{a.label}</span>
                </button>
              ))}
            </div>

            {/* Today's Bonus Summary */}
            <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap size={14} className="text-[#FF9F0A]" />
                  <span className="text-xs font-bold text-white">오늘의 보너스 현황</span>
                </div>
                <span className="text-[10px] text-[#8E8E93]">일마감까지 {countdown}</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: "추천보너스 (20%)", value: "+$200.00", color: "#30D5C8" },
                  { label: "육성보너스 (10%)", value: "+$50.00",  color: "#BF5AF2" },
                  { label: "엄마보너스 (100% 매칭)", value: "+$50.00", color: "#FF9F0A" },
                  { label: "최탄보너스 (티켓 4장)", value: "+$12.50", color: "#FFD700" },
                ].map((b) => (
                  <div key={b.label} className="flex justify-between text-xs">
                    <span className="text-[#8E8E93]">{b.label}</span>
                    <span className="font-bold" style={{ color: b.color }}>{b.value}</span>
                  </div>
                ))}
                <div className="border-t border-[#26262B]/60 pt-2 flex justify-between text-xs font-black text-white">
                  <span>오늘 누계</span>
                  <span className="text-[#30D5C8]">+$312.50</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">최근 활동</h3>
              <div className="bg-[#141418] border border-[#26262B] rounded-2xl divide-y divide-[#26262B]/60 overflow-hidden">
                {[
                  { label: "추천보너스 수령", sub: "User_01 구매", amount: "+$200.00", color: "#30D5C8", bg: "#30D5C8" },
                  { label: "USDT 출금 요청", sub: "어제 14:42", amount: "-$50.00", color: "#FF9F0A", bg: "#FF9F0A" },
                  { label: "USDT 입금 감지", sub: "어제 09:15", amount: "+$1,000.00", color: "#30D5C8", bg: "#30D5C8" },
                ].map((item, i) => (
                  <div key={i} className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={{ background: `${item.bg}15`, color: item.bg }}>
                        {item.amount.startsWith("+") ? "↓" : "↑"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{item.label}</p>
                        <p className="text-[10px] text-[#8E8E93] mt-0.5">{item.sub}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold" style={{ color: item.color }}>{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════ WALLET ═══════════════ */}
        {activeTab === "wallet" && (
          <div className="p-5 space-y-5">
            <h1 className="text-xl font-black text-white">지갑</h1>

            {/* Balance Overview */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { symbol: "USDT", balance: "10,500.00", color: "#26A17B", sub: "사용가능" },
                { symbol: "URC",  balance: "4,980.00",  color: "#BF5AF2", sub: "사용가능" },
              ].map((t) => (
                <div key={t.symbol} className="bg-[#141418] border border-[#26262B] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${t.color}20`, color: t.color }}>{t.symbol}</span>
                    <BarChart3 size={12} className="text-[#8E8E93]" />
                  </div>
                  <p className="text-lg font-black text-white">{t.balance}</p>
                  <p className="text-[10px] text-[#8E8E93] mt-0.5">{t.sub}</p>
                </div>
              ))}
            </div>

            {/* Swap */}
            <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft size={14} className="text-[#BF5AF2]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">즉시 스왑 (수수료 0.1%)</h3>
              </div>
              <div className="bg-[#0A0A0C] border border-[#26262B] p-3.5 rounded-xl">
                <div className="flex justify-between text-[10px] text-[#8E8E93] mb-2">
                  <span>From</span>
                  <span>잔고: {isUsdtToUrc ? "10,500.00 USDT" : "4,980.00 URC"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <input type="number" placeholder="0.00" value={fromAmount} onChange={(e) => handleSwapChange(e.target.value)}
                    className="bg-transparent text-2xl font-black text-white focus:outline-none w-1/2" />
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: isUsdtToUrc ? "#26A17B40" : "#BF5AF240", color: isUsdtToUrc ? "#26A17B" : "#BF5AF2" }}>
                    {isUsdtToUrc ? "USDT" : "URC"}
                  </span>
                </div>
              </div>
              <div className="flex justify-center">
                <button onClick={() => { setIsUsdtToUrc(!isUsdtToUrc); setFromAmount(""); setToAmount(""); }}
                  className="w-9 h-9 rounded-full bg-[#26262B] border border-[#3E3E45] flex items-center justify-center text-[#BF5AF2] hover:scale-110 transition-transform">
                  <ArrowRightLeft size={14} className="rotate-90" />
                </button>
              </div>
              <div className="bg-[#0A0A0C] border border-[#26262B] p-3.5 rounded-xl">
                <div className="flex justify-between text-[10px] text-[#8E8E93] mb-2">
                  <span>To (예상)</span>
                  <span>잔고: {isUsdtToUrc ? "4,980.00 URC" : "10,500.00 USDT"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <input type="number" placeholder="0.00" value={toAmount} disabled
                    className="bg-transparent text-2xl font-black text-[#AEAEB2] focus:outline-none w-1/2" />
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ background: isUsdtToUrc ? "#BF5AF240" : "#26A17B40", color: isUsdtToUrc ? "#BF5AF2" : "#26A17B" }}>
                    {isUsdtToUrc ? "URC" : "USDT"}
                  </span>
                </div>
              </div>
              {fromAmount && (
                <div className="flex justify-between text-[10px] text-[#8E8E93] px-1">
                  <span>수수료 (0.1%)</span>
                  <span className="text-[#FF9F0A]">-{(Number(fromAmount) * 0.001).toFixed(4)}</span>
                </div>
              )}
              <button className="w-full py-3.5 bg-gradient-to-r from-[#BF5AF2] to-[#9A3FD0] text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 active:scale-95 transition-transform shadow-lg">
                <RefreshCw size={14} />
                <span>스왑 실행</span>
              </button>
            </div>

            {/* Withdraw */}
            <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <ArrowUpRight size={14} className="text-[#FF9F0A]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">USDT 출금 (수수료 5%)</h3>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold">출금 금액 (최소 $50)</label>
                  <input type="number" placeholder="50.00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full mt-1.5 bg-[#0A0A0C] border border-[#26262B] focus:border-[#00D2FF] p-3 rounded-xl text-sm text-white font-bold focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-[#8E8E93] uppercase font-bold">BSC 주소</label>
                  <input type="text" placeholder="0x..." value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="w-full mt-1.5 bg-[#0A0A0C] border border-[#26262B] focus:border-[#00D2FF] p-3 rounded-xl text-sm text-white font-bold focus:outline-none transition-colors" />
                </div>
                {Number(withdrawAmount) >= 50 && (
                  <div className="p-3 bg-[#0A0A0C] border border-[#26262B] rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#8E8E93]">요청 금액</span>
                      <span className="text-white font-bold">${Number(withdrawAmount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8E8E93]">수수료 (5%)</span>
                      <span className="text-[#FF453A] font-bold">-${withdrawFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#26262B]/60 pt-1.5 font-black">
                      <span className="text-white">실수령액</span>
                      <span className="text-[#30D5C8]">${withdrawFinal.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <button disabled={Number(withdrawAmount) < 50}
                  className={`w-full py-3.5 font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition-all active:scale-95 ${Number(withdrawAmount) >= 50 ? "bg-gradient-to-r from-[#00D2FF] to-[#0099CC] text-black shadow-lg" : "bg-[#26262B] text-[#8E8E93] cursor-not-allowed"}`}>
                  <ArrowUpRight size={14} />
                  <span>출금 신청</span>
                </button>
              </div>
            </div>

            {/* Deposit QR section */}
            <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <ArrowDownLeft size={14} className="text-[#30D5C8]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">USDT 입금 (BSC)</h3>
              </div>
              <div className="bg-[#0A0A0C] border border-[#26262B] rounded-xl p-3 text-center">
                <div className="w-20 h-20 bg-white rounded-xl mx-auto mb-2 flex items-center justify-center">
                  <div className="w-16 h-16 grid grid-cols-4 grid-rows-4 gap-0.5">
                    {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className={`rounded-sm ${[0,1,4,6,9,12,14,15].includes(i) ? "bg-black" : "bg-gray-300"}`} />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-[#8E8E93] font-mono break-all">0xA3f2...d891</p>
              </div>
              <p className="text-[10px] text-[#FF453A] text-center">⚠️ BSC 네트워크 USDT만 입금 가능합니다</p>
            </div>

          </div>
        )}

        {/* ═══════════════ GAME ═══════════════ */}
        {activeTab === "game" && (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black text-white">369 게임</h1>
              <div className="bg-[#BF5AF2]/10 border border-[#BF5AF2]/20 px-3 py-1.5 rounded-xl">
                <span className="text-xs text-[#BF5AF2] font-bold">최탄 4장 보유</span>
              </div>
            </div>

            {/* Powerball Balance */}
            <div className="bg-gradient-to-br from-[#141418] to-[#0D0D10] border border-[#2C2C35] rounded-2xl p-5 flex items-center justify-between"
              style={{ boxShadow: "0 0 30px rgba(191,90,242,0.08)" }}>
              <div>
                <p className="text-xs text-[#8E8E93] uppercase font-semibold">파워볼 잔고</p>
                <h2 className="text-3xl font-black text-white mt-1">540<span className="text-lg text-[#8E8E93] ml-1">개</span></h2>
                <p className="text-[10px] text-[#8E8E93] mt-1">게임기 입장 1회 = 파워볼 3개</p>
              </div>
              <button className="px-4 py-2.5 bg-gradient-to-r from-[#BF5AF2] to-[#9A3FD0] text-white text-xs font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg">
                구매하기
              </button>
            </div>

            {/* Game Machines */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">내 게임기</h3>
              <div className="space-y-2.5">
                {[
                  { level: 1, price: "$100", entries: "10회", remaining: 6, pct: 60, tickets: 0 },
                  { level: 3, price: "$1,000", entries: "100회", remaining: 88, pct: 88, tickets: 3 },
                ].map((m) => (
                  <div key={m.level} className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-[#BF5AF2]/15 text-[#BF5AF2] rounded">{m.level}단계</span>
                        <span className="text-sm font-bold text-white">{m.price} 게임기</span>
                      </div>
                      <span className="text-[10px] text-[#FF9F0A] font-bold">최탄 {m.tickets}장</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#8E8E93]">잔여 입장</span>
                        <span className="text-white font-bold">{m.remaining} / {parseInt(m.entries)} 회</span>
                      </div>
                      <div className="w-full bg-[#26262B] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-[#BF5AF2] to-[#00D2FF] transition-all" style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Game Rounds */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">오늘의 게임 라운드 (베이징 기준)</h3>
              <div className="space-y-2.5">
                {[
                  { round: 1, time: "11:00 ~ 12:00", kst: "KST 12:00~13:00", announce: "12:30 AI 발표", status: "진행 중" },
                  { round: 2, time: "14:00 ~ 15:00", kst: "KST 15:00~16:00", announce: "15:30 AI 발표", status: "대기 중" },
                  { round: 3, time: "17:00 ~ 18:00", kst: "KST 18:00~19:00", announce: "18:30 AI 발표", status: "대기 중" },
                ].map((r) => (
                  <div key={r.round} className="bg-[#141418] border border-[#26262B] rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${r.status === "진행 중" ? "bg-[#30D5C8]/15 text-[#30D5C8]" : "bg-[#26262B] text-[#8E8E93]"}`}>
                          {r.round}회차 · {r.status}
                        </span>
                        <p className="text-sm font-bold text-white mt-1.5">{r.time}</p>
                        <p className="text-[10px] text-[#8E8E93]">{r.kst}</p>
                      </div>
                      <p className="text-[10px] text-[#8E8E93]">{r.announce}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#26262B]/60 pt-3">
                      <span className="text-[10px] text-[#8E8E93]">$100 티켓 + 파워볼 3개</span>
                      <button className={`px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center space-x-1 active:scale-95 transition-all ${r.status === "진행 중" ? "bg-[#00D2FF] text-black" : "bg-[#26262B] text-[#8E8E93] cursor-not-allowed"}`}>
                        <Play size={10} fill="currentColor" />
                        <span>참가</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ NETWORK (조직) ═══════════════ */}
        {activeTab === "network" && (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black text-white">조직 관리</h1>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">369 Pass-up 계보 시스템</p>
              </div>
              <button onClick={fetchNetworkData} disabled={loadingNetwork}
                className="p-2.5 bg-[#141418] border border-[#26262B] rounded-xl text-[#00D2FF] hover:bg-[#1C1C21] transition-colors">
                <RefreshCw size={14} className={loadingNetwork ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "직추천 수", value: "6명", color: "#00D2FF" },
                { label: "후원 1대", value: "5명", color: "#BF5AF2" },
                { label: "누적 매출", value: "$3,200", color: "#FF9F0A" },
              ].map((s) => (
                <div key={s.label} className="bg-[#141418] border border-[#26262B] rounded-xl p-3 text-center">
                  <p className="text-sm font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[9px] text-[#8E8E93] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Sub-tab Toggle */}
            <div className="flex bg-[#141418] p-1 rounded-2xl border border-[#26262B]">
              <button onClick={() => setNetworkTab("referral")}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${networkTab === "referral" ? "bg-[#00D2FF] text-black shadow-lg" : "text-[#8E8E93] hover:text-white"}`}>
                추천 계보도
              </button>
              <button onClick={() => setNetworkTab("sponsor")}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${networkTab === "sponsor" ? "bg-[#BF5AF2] text-white shadow-lg" : "text-[#8E8E93] hover:text-white"}`}>
                후원 계보도
              </button>
            </div>

            {/* ── 추천 계보도 ── */}
            {networkTab === "referral" && (
              <div className="space-y-3">
                {/* Guide Box */}
                <div className="p-3.5 bg-[#141418] border border-[#00D2FF]/20 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-[#00D2FF]">
                    <Info size={13} />
                    <span className="text-xs font-bold">추천계보 안내</span>
                  </div>
                  <p className="text-[10px] text-[#8E8E93] leading-relaxed">
                    내가 직접 추천한 1대 라인 전체 목록입니다. 추천 순서에 관계없이 <span className="text-white font-bold">모든 직추천 1대 매출의 20%</span>를 추천보너스로 수령합니다.
                    단, <span className="text-[#FF9F0A] font-bold">3, 6, 9번째(3의 배수) 회원</span>은 후원 계보에서 상위 스폰서에게 롤업(Pass-Up)됩니다.
                  </p>
                </div>

                {/* Member List */}
                <div className="bg-[#141418] border border-[#26262B] rounded-2xl overflow-hidden divide-y divide-[#26262B]/60">
                  {directTree.map((m) => (
                    <div key={m.id} className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${m.isRollup ? "bg-[#FF9F0A]/10 border border-[#FF9F0A]/30" : "bg-[#141418] border border-[#26262B]"}`}>
                          <span className={m.isRollup ? "text-[#FF9F0A]" : "text-white"}>{m.referralSeq}</span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-xs font-bold ${m.isRollup ? "text-[#FF9F0A]" : "text-white"}`}>{m.nickname}</span>
                            {m.isRollup && (
                              <span className="text-[8px] bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/20 px-1.5 py-0.5 rounded font-bold">롤업↑</span>
                            )}
                          </div>
                          <p className="text-[10px] text-[#8E8E93] mt-0.5">
                            {m.referralSeq}번째 직추천 · 구매 ${m.totalPurchase.toLocaleString()}
                            {m.isRollup && <span className="text-[#FF9F0A] ml-1">→ 상위 스폰서 후원 배속</span>}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 ${m.status === "ACTIVE" ? "bg-[#30D5C8]/10 text-[#30D5C8]" : "bg-[#26262B] text-[#8E8E93]"}`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rollup Legend */}
                <div className="flex items-center space-x-3 px-1">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-3 h-3 rounded bg-[#26262B]" />
                    <span className="text-[10px] text-[#8E8E93]">일반 후원 식구</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-3 h-3 rounded bg-[#FF9F0A]/20 border border-[#FF9F0A]/40" />
                    <span className="text-[10px] text-[#8E8E93]">3배수 롤업 대상</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── 후원 계보도 ── */}
            {networkTab === "sponsor" && (
              <div className="space-y-3">
                {/* Guide Box */}
                <div className="p-3.5 bg-[#141418] border border-[#BF5AF2]/20 rounded-2xl space-y-2">
                  <div className="flex items-center space-x-2 text-[#BF5AF2]">
                    <Info size={13} />
                    <span className="text-xs font-bold">후원계보 (369 Pass-Up) 안내</span>
                  </div>
                  <p className="text-[10px] text-[#8E8E93] leading-relaxed">
                    <span className="text-white font-bold">내 후원 1대</span>는 ① 3배수가 아닌 내 직추천 식구들 + ② 내 하위 조직에서 나에게 롤업된 사위/며느리로 구성됩니다.
                    후원 1대의 매출 10% → <span className="text-[#BF5AF2] font-bold">육성보너스</span>, 수령 즉시 내 직추천 스폰서에게 → <span className="text-[#FF9F0A] font-bold">엄마보너스 100% 매칭</span>.
                  </p>
                </div>

                {/* Placement Tree Visual */}
                <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-5">
                  <p className="text-[10px] text-[#8E8E93] uppercase font-bold tracking-wider text-center mb-5">후원 계보 시각화</p>

                  {/* Me (Root) */}
                  <div className="flex flex-col items-center">
                    <div className="bg-gradient-to-r from-[#00D2FF]/20 to-[#BF5AF2]/20 border-2 border-[#00D2FF] rounded-2xl px-6 py-2.5 text-center">
                      <span className="text-xs font-black text-[#00D2FF]">나 (C)</span>
                      <p className="text-[9px] text-[#8E8E93] mt-0.5">직급: 2스타</p>
                    </div>

                    {/* Vertical line */}
                    <div className="w-px h-6 bg-gradient-to-b from-[#00D2FF] to-[#26262B]" />

                    {/* Tier 1 Members */}
                    <div className="w-full">
                      <p className="text-center text-[9px] text-[#BF5AF2] font-bold mb-3 uppercase tracking-wider">후원 1대 (육성보너스 10% 수령)</p>
                      <div className="space-y-2">
                        {sponsorTree.filter(m => m.tier === 1).map((m) => (
                          <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border ${m.isRolledIn ? "bg-[#FF9F0A]/5 border-[#FF9F0A]/30" : "bg-[#0A0A0C] border-[#26262B]"}`}>
                            <div className="flex items-center space-x-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${m.isRolledIn ? "bg-[#FF9F0A]/15 text-[#FF9F0A]" : "bg-[#1C1C21] text-white"}`}>
                                {m.isRolledIn ? "↘" : "●"}
                              </div>
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <span className={`text-xs font-bold ${m.isRolledIn ? "text-[#FF9F0A]" : "text-white"}`}>{m.nickname}</span>
                                  {m.isRolledIn && <span className="text-[8px] bg-[#FF9F0A]/15 text-[#FF9F0A] border border-[#FF9F0A]/20 px-1.5 py-0.5 rounded font-bold">사위/며느리</span>}
                                </div>
                                {m.isRolledIn && m.originalRecommender && (
                                  <p className="text-[9px] text-[#8E8E93] mt-0.5">원추천인: {m.originalRecommender}</p>
                                )}
                                <p className="text-[9px] text-[#8E8E93] mt-0.5">
                                  매출 ${m.salesVolume.toLocaleString()} · 육성보너스 ${(m.salesVolume * 0.1).toFixed(0)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold block ${m.status === "ACTIVE" ? "bg-[#30D5C8]/10 text-[#30D5C8]" : "bg-[#26262B] text-[#8E8E93]"}`}>
                                {m.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mama Bonus Note */}
                    <div className="mt-4 w-full p-3 bg-[#FF9F0A]/5 border border-[#FF9F0A]/20 rounded-xl">
                      <div className="flex items-start space-x-2">
                        <Zap size={12} className="text-[#FF9F0A] mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-[#8E8E93] leading-relaxed">
                          <span className="text-[#FF9F0A] font-bold">엄마보너스</span>: 내가 육성보너스를 받을 때마다, 내 직추천 스폰서(B)에게 동일 금액의 100%가 자동 지급됩니다.
                          또한 내가 롤업시킨 3,6,9번째 회원들이 육성보너스를 받을 때도 나에게 100% 매칭됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rollup Example */}
                <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-white">롤업(Pass-Up) 예시</h4>
                  <div className="space-y-2 text-[10px]">
                    {[
                      { seq: "1,2,4,5...", dest: "나 (C)", color: "#30D5C8", desc: "내 식구 (후원 1대 직접 배속)" },
                      { seq: "3번째", dest: "나의 스폰서 B", color: "#FF9F0A", desc: "상위 1대에게 시집/장가" },
                      { seq: "6번째", dest: "B의 스폰서 A", color: "#BF5AF2", desc: "상위 2대에게 시집/장가" },
                      { seq: "9번째", dest: "A의 스폰서", color: "#FF453A", desc: "상위 3대에게 시집/장가" },
                    ].map((ex) => (
                      <div key={ex.seq} className="flex items-center justify-between p-2.5 bg-[#0A0A0C] rounded-xl border border-[#26262B]/60">
                        <div className="flex items-center space-x-2">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black" style={{ background: `${ex.color}20`, color: ex.color }}>{ex.seq}</span>
                          <span className="text-[#8E8E93]">{ex.desc}</span>
                        </div>
                        <span className="font-bold" style={{ color: ex.color }}>→ {ex.dest}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SETTINGS ═══════════════ */}
        {activeTab === "settings" && (
          <div className="p-5 space-y-5">
            <h1 className="text-xl font-black text-white">설정</h1>

            {/* User Profile Card */}
            <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] flex items-center justify-center font-black text-xl text-white">C</div>
              <div className="flex-1">
                <p className="text-sm font-black text-white">C (나)</p>
                <p className="text-[10px] text-[#8E8E93] mt-0.5">{userEmail}</p>
                <div className="flex items-center space-x-2 mt-1.5">
                  <StarBadge level={2} />
                  <span className="text-[9px] text-[#8E8E93]">누적 $3,200</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#8E8E93]" />
            </div>

            {/* Rank Progress */}
            <div className="bg-[#141418] border border-[#26262B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Trophy size={14} className="text-[#FFD700]" />
                <h3 className="text-xs font-bold text-white">직급 현황</h3>
              </div>
              <div className="space-y-2">
                {[
                  { stars: 1, label: "1스타", req: 1000, done: true },
                  { stars: 2, label: "2스타", req: 3000, done: true },
                  { stars: 3, label: "3스타", req: 10000, done: false, current: 3200 },
                ].map((r) => (
                  <div key={r.stars} className={`flex items-center justify-between p-2.5 rounded-xl border ${r.done ? "bg-[#30D5C8]/5 border-[#30D5C8]/20" : "bg-[#0A0A0C] border-[#26262B]"}`}>
                    <div className="flex items-center space-x-2">
                      <StarBadge level={r.stars} />
                      {!r.done && r.current && (
                        <div className="flex-1 ml-2">
                          <div className="w-24 bg-[#26262B] rounded-full h-1">
                            <div className="h-1 rounded-full bg-gradient-to-r from-[#BF5AF2] to-[#00D2FF]" style={{ width: `${(r.current / r.req) * 100}%` }} />
                          </div>
                          <p className="text-[9px] text-[#8E8E93] mt-0.5">${r.current.toLocaleString()} / ${r.req.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                    {r.done ? <Check size={14} className="text-[#30D5C8]" /> : <span className="text-[10px] text-[#8E8E93]">${r.req.toLocaleString()} 달성 필요</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* PWA Install Guide */}
            <div className="bg-gradient-to-br from-[#141418] to-[#0D0D10] border border-[#26262B] rounded-2xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-[#00D2FF]">
                <Layers size={14} />
                <h3 className="text-xs font-bold">홈 화면에 추가 (PWA)</h3>
              </div>
              <div className="space-y-3 text-[10px] text-[#8E8E93]">
                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#1C1C21] text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <p className="text-white font-semibold mb-0.5">iOS (Safari)</p>
                    <p>하단 [공유] 버튼 → [홈 화면에 추가] 탭</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#1C1C21] text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <p className="text-white font-semibold mb-0.5">Android (Chrome)</p>
                    <p>우측 상단 메뉴 → [앱 설치] 또는 [홈 화면에 추가]</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu List */}
            <div className="bg-[#141418] border border-[#26262B] rounded-2xl divide-y divide-[#26262B]/60 overflow-hidden">
              {[
                { icon: <Shield size={14} />, label: "보안 설정", color: "#00D2FF" },
                { icon: <Bell size={14} />, label: "알림 설정", color: "#BF5AF2" },
                { icon: <ExternalLink size={14} />, label: "이용약관 / 개인정보", color: "#8E8E93" },
              ].map((m) => (
                <button key={m.label} className="w-full flex items-center justify-between p-4 hover:bg-[#1C1C21] transition-colors">
                  <div className="flex items-center space-x-3">
                    <span style={{ color: m.color }}>{m.icon}</span>
                    <span className="text-sm text-white font-semibold">{m.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-[#8E8E93]" />
                </button>
              ))}
            </div>

            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="w-full py-3.5 bg-[#FF453A]/10 border border-[#FF453A]/25 text-[#FF453A] font-bold rounded-xl text-sm hover:bg-[#FF453A]/20 active:scale-95 transition-all"
            >
              로그아웃
            </button>
          </div>
        )}

      </main>

      {/* ── BOTTOM NAV BAR ── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-16 bg-[#141418]/95 backdrop-blur-xl border-t border-[#26262B] flex justify-around items-center z-50 border-x border-x-[#26262B]">
        {([
          { id: "home",    icon: <Home size={20} />,     label: "홈"   },
          { id: "wallet",  icon: <Wallet size={20} />,   label: "지갑" },
          { id: "game",    icon: <Gamepad2 size={20} />, label: "게임" },
          { id: "network", icon: <Users size={20} />,    label: "조직" },
          { id: "settings",icon: <Settings size={20} />, label: "설정" },
        ] as { id: TabType; icon: React.ReactNode; label: string }[]).map((item) => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center space-y-1 px-3 py-2 rounded-xl transition-all active:scale-90 ${activeTab === item.id ? "text-[#00D2FF]" : "text-[#636366] hover:text-[#AEAEB2]"}`}>
            <div className={`transition-transform ${activeTab === item.id ? "scale-110" : ""}`}>{item.icon}</div>
            <span className={`text-[9px] font-bold transition-all ${activeTab === item.id ? "text-[#00D2FF]" : "text-[#636366]"}`}>{item.label}</span>
            {activeTab === item.id && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#00D2FF]" />}
          </button>
        ))}
      </nav>

    </div>
  );
}
