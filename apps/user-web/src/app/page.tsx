"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Home, Wallet, Gamepad2, Users, Settings, ArrowDownLeft, ArrowUpRight,
  RefreshCw, Copy, Check, Play, TrendingUp, Bell, ArrowRightLeft, Star,
  Zap, BarChart3, Info, LogOut
} from "lucide-react";

type TabType = "home" | "wallet" | "game" | "network" | "settings";
type NetworkTabType = "referral" | "sponsor";

interface DirectMember {
  id: string; nickname: string; status: "ACTIVE" | "PENDING";
  referralSeq: number; totalPurchase: number; isRollup: boolean;
}

interface SponsorMember {
  id: string; nickname: string; status: "ACTIVE" | "PENDING";
  tier: number; isRolledIn: boolean; originalRecommender?: string; salesVolume: number;
}

const MOCK_DIRECT: DirectMember[] = [
  { id: "u1", nickname: "User_01", status: "ACTIVE", referralSeq: 1, totalPurchase: 500, isRollup: false },
  { id: "u2", nickname: "User_02", status: "ACTIVE", referralSeq: 2, totalPurchase: 100, isRollup: false },
  { id: "u3", nickname: "User_03", status: "ACTIVE", referralSeq: 3, totalPurchase: 1000, isRollup: true },
  { id: "u4", nickname: "User_04", status: "ACTIVE", referralSeq: 4, totalPurchase: 100, isRollup: false },
  { id: "u5", nickname: "User_05", status: "ACTIVE", referralSeq: 5, totalPurchase: 500, isRollup: false },
  { id: "u6", nickname: "User_06", status: "PENDING", referralSeq: 6, totalPurchase: 1000, isRollup: true },
];

const MOCK_SPONSOR: SponsorMember[] = [
  { id: "u1", nickname: "User_01", status: "ACTIVE", tier: 1, isRolledIn: false, salesVolume: 500 },
  { id: "u2", nickname: "User_02", status: "ACTIVE", tier: 1, isRolledIn: false, salesVolume: 100 },
  { id: "u4", nickname: "User_04", status: "ACTIVE", tier: 1, isRolledIn: false, salesVolume: 100 },
  { id: "u5", nickname: "User_05", status: "ACTIVE", tier: 1, isRolledIn: false, salesVolume: 500 },
  { id: "u1-3", nickname: "User_01 (3rd)", status: "ACTIVE", tier: 1, isRolledIn: true, originalRecommender: "User_01", salesVolume: 1000 },
];

const STAR_COLORS = ["", "#FCD535", "#C0C0C0", "#CD7F32", "#0ECB81", "#BF5AF2", "#FF9F0A", "#F6465D"];
function StarBadge({ level }: { level: number }) {
  if (level === 0) return <span className="text-[10px] text-[#848E9C] font-semibold">Normal</span>;
  return (
    <span className="flex items-center space-x-0.5">
      {Array.from({ length: level }).map((_, i) => (
        <Star key={i} size={10} fill={STAR_COLORS[level]} color={STAR_COLORS[level]} />
      ))}
      <span className="text-[10px] font-bold ml-1" style={{ color: STAR_COLORS[level] }}>V{level}</span>
    </span>
  );
}

export default function MobileApp() {
  const supabase = createClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [networkTab, setNetworkTab] = useState<NetworkTabType>("referral");
  const [referralCopied, setReferralCopied] = useState(false);
  const [directTree] = useState([
    { id: 1, nickname: "User A", referralSeq: 1, status: "ACTIVE" },
    { id: 2, nickname: "User B", referralSeq: 2, status: "INACTIVE" }
  ]);
  const [sponsorTree] = useState([
    { id: 3, nickname: "User C", tier: 1, status: "ACTIVE" },
    { id: 4, nickname: "User D", tier: 2, status: "ACTIVE" }
  ]);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isUsdtToUrc, setIsUsdtToUrc] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [userEmail, setUserEmail] = useState("Loading...");
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserEmail(session.user.email || "Unknown");
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const beijingTime = new Date(utc + 3600000 * 8);
      const nextMidnight = new Date(beijingTime);
      nextMidnight.setHours(24, 0, 0, 0);
      const diff = nextMidnight.getTime() - beijingTime.getTime();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
      setCountdown(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const copyReferral = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://app.urc369.com";
    navigator.clipboard.writeText(`${origin}/register?ref=URC883920`);
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

  return (
    <div className="w-full max-w-md mx-auto bg-[#0B0E11] min-h-screen pb-20 relative font-sans text-[#EAECEF]">
      
      {/* ── TOP STATUS BAR ── */}
      <div className="sticky top-0 z-40 bg-[#0B0E11]/95 backdrop-blur-md border-b border-[#2B3139] px-5 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded bg-[#FCD535] flex items-center justify-center text-[#0B0E11] font-black text-xs">U</div>
          <span className="text-sm font-bold text-[#EAECEF]">URC369</span>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-[#1E2329] rounded px-2.5 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0ECB81] animate-pulse" />
            <span className="text-[10px] text-[#0ECB81] font-bold">UTC+8 {countdown}</span>
          </div>
          <button className="relative p-1.5 bg-[#1E2329] rounded">
            <Bell size={14} className="text-[#848E9C]" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#F6465D] rounded-full" />
          </button>
        </div>
      </div>

      {/* ── MAIN SCROLL AREA ── */}
      <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

        {/* ═══════════════ HOME ═══════════════ */}
        {activeTab === "home" && (
          <div className="p-5 space-y-5">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-[#1E2329] flex items-center justify-center font-black text-[#FCD535]">C</div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0ECB81] rounded-full border-2 border-[#0B0E11] flex items-center justify-center">
                    <Check size={8} className="text-[#0B0E11]" />
                  </div>
                </div>
                <div>
                  <h1 className="text-base font-extrabold text-[#EAECEF]">User (我)</h1>
                  <StarBadge level={2} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#848E9C]">邀请码</p>
                <button onClick={copyReferral} className="flex items-center space-x-1 bg-[#1E2329] px-2.5 py-1.5 rounded mt-0.5">
                  <span className="text-[10px] text-[#FCD535] font-mono font-bold">URC883920</span>
                  {referralCopied ? <Check size={10} className="text-[#0ECB81]" /> : <Copy size={10} className="text-[#848E9C]" />}
                </button>
              </div>
            </div>

            {/* Balance Card */}
            <div className="rounded-xl p-5 bg-[#1E2329]">
              <p className="text-xs text-[#848E9C] font-medium">总资产估值</p>
              <h2 className="text-3xl font-black text-[#EAECEF] mt-1 tracking-tight">$15,480<span className="text-xl text-[#848E9C]">.00</span></h2>
              <div className="flex items-center space-x-1.5 text-[#0ECB81] text-xs font-bold mt-1.5">
                <TrendingUp size={12} />
                <span>+12.4% (24h)</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-[#2B3139]">
                <div>
                  <p className="text-[10px] text-[#848E9C]">USDT</p>
                  <p className="text-sm font-bold text-[#EAECEF] mt-0.5">10,500.00</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#848E9C]">URC</p>
                  <p className="text-sm font-bold text-[#EAECEF] mt-0.5">4,980.00</p>
                </div>
              </div>
            </div>

            {/* Max-Out Gauge */}
            <div className="bg-[#1E2329] rounded-xl p-4">
              <div className="flex justify-between items-end mb-2">
                <div className="flex items-baseline space-x-1">
                  <span className="text-base font-bold text-[#EAECEF]">0</span>
                  <span className="text-[#848E9C] text-xs">/ 3,000</span>
                </div>
                <span className="text-[10px] text-[#FCD535]">剩余额度 3,000</span>
              </div>
              <div className="w-full bg-[#0B0E11] rounded-full h-2 mb-2">
                <div className="bg-[#FCD535] h-2 rounded-full" style={{ width: "0%" }}></div>
              </div>
              <div className="flex justify-between text-[10px] text-[#848E9C]">
                <span>累计提取</span>
                <span>0% 已用</span>
              </div>
            </div>

            {/* Quick Actions (Icons Only) */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: <ArrowDownLeft size={20} />, tab: "wallet" as TabType },
                { icon: <ArrowUpRight size={20} />, tab: "wallet" as TabType },
                { icon: <ArrowRightLeft size={20} />, tab: "wallet" as TabType },
                { icon: <Gamepad2 size={20} />, tab: "game" as TabType },
              ].map((a, i) => (
                <button key={i} onClick={() => setActiveTab(a.tab)}
                  className="bg-[#1E2329] hover:bg-[#2B3139] py-3 rounded-xl flex items-center justify-center text-[#FCD535] transition-colors">
                  {a.icon}
                </button>
              ))}
            </div>

            {/* Today's Bonus */}
            <div className="bg-[#1E2329] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap size={14} className="text-[#FCD535]" />
                  <span className="text-xs font-bold text-[#EAECEF]">今日奖励</span>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "直推奖 (20%)", value: "+$200.00" },
                  { label: "辅导奖 (10%)", value: "+$50.00" },
                  { label: "平级奖 (100%)", value: "+$50.00" },
                  { label: "分红奖 (4票)", value: "+$12.50" },
                ].map((b) => (
                  <div key={b.label} className="flex justify-between text-xs">
                    <span className="text-[#848E9C]">{b.label}</span>
                    <span className="font-bold text-[#0ECB81]">{b.value}</span>
                  </div>
                ))}
                <div className="border-t border-[#2B3139] pt-2 flex justify-between text-xs font-bold">
                  <span>今日总计</span>
                  <span className="text-[#FCD535]">+$312.50</span>
                </div>
              </div>
            </div>
            
          </div>
        )}

        {/* ═══════════════ WALLET ═══════════════ */}
        {activeTab === "wallet" && (
          <div className="p-5 space-y-5">
            <h1 className="text-xl font-black text-[#EAECEF]">钱包</h1>

            <div className="grid grid-cols-2 gap-3">
              {[
                { symbol: "USDT", balance: "10,500.00" },
                { symbol: "URC",  balance: "4,980.00" },
              ].map((t) => (
                <div key={t.symbol} className="bg-[#1E2329] rounded-xl p-4">
                  <span className="text-[10px] font-bold text-[#848E9C]">{t.symbol}</span>
                  <p className="text-lg font-bold text-[#EAECEF] mt-1">{t.balance}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#1E2329] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#EAECEF]">闪兑 (手续费 0.1%)</h3>
              <div className="bg-[#0B0E11] p-3 rounded-lg">
                <div className="flex justify-between text-[10px] text-[#848E9C] mb-1">
                  <span>支付</span>
                  <span>余额: {isUsdtToUrc ? "10,500.00 USDT" : "4,980.00 URC"}</span>
                </div>
                <div className="flex justify-between">
                  <input type="number" placeholder="0.00" value={fromAmount} onChange={(e) => handleSwapChange(e.target.value)}
                    className="bg-transparent text-xl font-bold text-[#EAECEF] outline-none w-1/2" />
                  <span className="text-[#FCD535] font-bold">{isUsdtToUrc ? "USDT" : "URC"}</span>
                </div>
              </div>
              <div className="flex justify-center -my-2 relative z-10">
                <button onClick={() => { setIsUsdtToUrc(!isUsdtToUrc); setFromAmount(""); setToAmount(""); }}
                  className="w-8 h-8 rounded-full bg-[#2B3139] flex items-center justify-center text-[#FCD535]">
                  <ArrowRightLeft size={12} className="rotate-90" />
                </button>
              </div>
              <div className="bg-[#0B0E11] p-3 rounded-lg">
                <div className="flex justify-between text-[10px] text-[#848E9C] mb-1">
                  <span>获得 (预计)</span>
                  <span>余额: {isUsdtToUrc ? "4,980.00 URC" : "10,500.00 USDT"}</span>
                </div>
                <div className="flex justify-between">
                  <input type="number" placeholder="0.00" value={toAmount} disabled
                    className="bg-transparent text-xl font-bold text-[#848E9C] outline-none w-1/2" />
                  <span className="text-[#FCD535] font-bold">{isUsdtToUrc ? "URC" : "USDT"}</span>
                </div>
              </div>
              <button className="w-full py-3 bg-[#FCD535] text-[#0B0E11] font-bold rounded-lg text-sm">确认兑换</button>
            </div>

            <div className="bg-[#1E2329] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#EAECEF]">提现 USDT (BSC)</h3>
              <div className="space-y-3">
                <div className="bg-[#0B0E11] p-3 rounded-lg">
                  <input type="number" placeholder="金额 (最小 $50)" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="bg-transparent w-full text-sm text-[#EAECEF] outline-none" />
                </div>
                <div className="bg-[#0B0E11] p-3 rounded-lg">
                  <input type="text" placeholder="BSC 提现地址" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="bg-transparent w-full text-sm text-[#EAECEF] outline-none" />
                </div>
                <button disabled={Number(withdrawAmount) < 50}
                  className={`w-full py-3 font-bold rounded-lg text-sm ${Number(withdrawAmount) >= 50 ? "bg-[#FCD535] text-[#0B0E11]" : "bg-[#2B3139] text-[#848E9C]"}`}>
                  申请提现
                </button>
              </div>
            </div>
            
            <div className="bg-[#1E2329] rounded-xl p-4 text-center">
              <h3 className="text-xs font-bold text-[#EAECEF] mb-3 text-left">充值 USDT (BSC)</h3>
              <div className="w-32 h-32 bg-white rounded-lg mx-auto mb-3 flex items-center justify-center p-2">
                {/* Mock QR */}
                <div className="w-full h-full bg-black"></div>
              </div>
              <p className="text-xs text-[#848E9C]">0xA3f2...d891</p>
            </div>

          </div>
        )}

        {/* ═══════════════ GAME ═══════════════ */}
        {activeTab === "game" && (
          <div className="p-5 space-y-5">
            <h1 className="text-xl font-black text-[#EAECEF]">游戏区</h1>
            
            <div className="bg-[#1E2329] rounded-xl p-5 flex justify-between items-center">
              <div>
                <p className="text-xs text-[#848E9C]">能量球余额</p>
                <h2 className="text-2xl font-bold text-[#FCD535] mt-1">540</h2>
              </div>
              <button className="px-4 py-2 bg-[#FCD535] text-[#0B0E11] font-bold rounded text-sm">购买</button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#848E9C]">我的设备</h3>
              {[
                { level: 1, price: "$100", rem: 6, total: 10, pct: 60 },
                { level: 3, price: "$1,000", rem: 88, total: 100, pct: 88 },
              ].map((m) => (
                <div key={m.level} className="bg-[#1E2329] rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-[#EAECEF]">{m.price} 节点</span>
                    <span className="text-[10px] text-[#FCD535]">剩余 {m.rem} 次</span>
                  </div>
                  <div className="w-full bg-[#0B0E11] rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-[#FCD535]" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#848E9C]">今日轮次</h3>
              {[
                { r: 1, t: "11:00-12:00", s: "进行中" },
                { r: 2, t: "14:00-15:00", s: "等待中" },
              ].map((r) => (
                <div key={r.r} className="bg-[#1E2329] rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.s === "进行中" ? "bg-[#0ECB81]/20 text-[#0ECB81]" : "bg-[#2B3139] text-[#848E9C]"}`}>{r.s}</span>
                    <p className="text-sm font-bold text-[#EAECEF] mt-2">{r.t}</p>
                  </div>
                  <button className={`px-4 py-2 rounded font-bold text-xs ${r.s === "进行中" ? "bg-[#FCD535] text-[#0B0E11]" : "bg-[#2B3139] text-[#848E9C]"}`}>
                    参与
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ NETWORK ═══════════════ */}
        {activeTab === "network" && (
          <div className="p-5 space-y-4">
            <h1 className="text-xl font-black text-[#EAECEF]">团队</h1>
            
            <div className="flex bg-[#1E2329] p-1 rounded-lg">
              <button onClick={() => setNetworkTab("referral")} className={`flex-1 py-2 text-xs font-bold rounded ${networkTab === "referral" ? "bg-[#2B3139] text-[#EAECEF]" : "text-[#848E9C]"}`}>直推</button>
              <button onClick={() => setNetworkTab("sponsor")} className={`flex-1 py-2 text-xs font-bold rounded ${networkTab === "sponsor" ? "bg-[#2B3139] text-[#EAECEF]" : "text-[#848E9C]"}`}>架构</button>
            </div>

            <div className="bg-[#1E2329] rounded-xl divide-y divide-[#2B3139]">
              {(networkTab === "referral" ? directTree : sponsorTree).map((m: any) => (
                <div key={m.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-[#EAECEF]">{m.nickname}</p>
                    <p className="text-[10px] text-[#848E9C] mt-1">{networkTab === "referral" ? `直推第${m.referralSeq}人` : `架构第${m.tier}代`}</p>
                  </div>
                  <span className={`text-[10px] ${m.status === "ACTIVE" ? "text-[#0ECB81]" : "text-[#848E9C]"}`}>{m.status === "ACTIVE" ? "活跃" : "未激活"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ SETTINGS ═══════════════ */}
        {activeTab === "settings" && (
          <div className="p-5 space-y-5">
            <h1 className="text-xl font-black text-[#EAECEF]">设置</h1>
            
            {/* User Profile Card */}
            <div className="bg-[#1E2329] rounded-xl p-4 flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-[#2B3139] flex justify-center items-center font-bold text-[#FCD535]">U</div>
              <div>
                <p className="font-bold text-[#EAECEF]">{userEmail}</p>
                <button onClick={handleLogout} className="text-xs text-[#F6465D] mt-1 flex items-center">
                  <LogOut size={12} className="mr-1" /> 退出登录
                </button>
              </div>
            </div>

            {/* Referral Link Card */}
            <div className="bg-[#1E2329] rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-[#FCD535]">
                <Users size={16} />
                <h3 className="font-bold text-[#EAECEF]">分享推荐链接</h3>
              </div>
              <p className="text-xs text-[#848E9C]">复制下方链接发送给好友，对方点击即可自动填入邀请码并跳转至注册页面。</p>
              
              <div className="flex items-center justify-between bg-[#0B0E11] p-3 rounded-lg border border-[#2B3139]">
                <span className="text-[10px] text-[#EAECEF] font-mono truncate mr-2">
                  {typeof window !== "undefined" ? window.location.origin : "https://app.urc369.com"}/register?ref=URC883920
                </span>
                <button onClick={copyReferral} className="p-2 bg-[#2B3139] hover:bg-[#FCD535] hover:text-[#0B0E11] rounded text-[#848E9C] transition-colors flex-shrink-0">
                  {referralCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* ── BOTTOM NAV ── */}
      <nav className="fixed bottom-0 w-full max-w-md bg-[#0B0E11] border-t border-[#2B3139] pb-safe z-50">
        <div className="flex justify-around items-center p-3">
          {[
            { id: "home", icon: <Home size={22} /> },
            { id: "wallet", icon: <Wallet size={22} /> },
            { id: "game", icon: <Gamepad2 size={22} /> },
            { id: "network", icon: <Users size={22} /> },
            { id: "settings", icon: <Settings size={22} /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id as TabType)}
              className={`p-2 transition-colors ${activeTab === t.id ? "text-[#FCD535]" : "text-[#848E9C] hover:text-[#EAECEF]"}`}>
              {t.icon}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
