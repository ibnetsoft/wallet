"use client";
// URC369 Wallet App - Production Vercel Build Trigger
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Home, Wallet, Gamepad2, Users, Settings, ArrowDownLeft, ArrowUpRight,
  RefreshCw, Copy, Check, Play, TrendingUp, Bell, ArrowRightLeft, Star,
  Zap, BarChart3, Info, LogOut, ShoppingBag, FileText, ClipboardPaste
} from "lucide-react";

type TabType = "home" | "wallet" | "products" | "game" | "network" | "settings";
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

const TetherLogo = () => (
  <svg className="w-10 h-10 flex-shrink-0" viewBox="0 0 2000 2000" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="1000" cy="1000" r="1000" fill="#26A17B"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M1286.7 608.2h-573.4v132.8h221.7v492.3c-232.7-7.7-407-52.6-407-107.5 0-61.9 221.8-112.3 495.4-112.3 273.7 0 495.5 50.4 495.5 112.3 0 54.9-174.4 99.8-407.1 107.5v329.8h-132.8v-329.8c-255-8.5-446-59.5-446-121.7 0-77.9 261.3-141.1 583.7-141.1 322.4 0 583.7 63.2 583.7 141.1 0 62.2-191 113.2-446 121.7v101.4h232.2V608.2z" fill="#FFFFFF"/>
  </svg>
);

const UrcLogo = () => (
  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FCD535] to-[#F39C12] flex items-center justify-center font-black text-[#0B0E11] text-xs shadow-md border border-[#FCD535]/40 flex-shrink-0">
    URC
  </div>
);

const UrdLogo = () => (
  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3498DB] to-[#2980B9] flex items-center justify-center font-black text-white text-xs shadow-md border border-[#3498DB]/40 flex-shrink-0">
    URD
  </div>
);

type Language = "ko" | "en" | "zh";

const I18N = {
  ko: {
    home: "홈", wallet: "지갑", products: "상품몰", game: "경기장", network: "조직도", settings: "설정",
    miningStatus: "게임기 구동 현황", dailyYield: "일일 수익률", gaugeTitle: "보너스 한도 달성률 (200% ~ 300%)",
    usdtBalance: "USDT 잔액", urcBalance: "URC 잔액", urdBalance: "URD 토큰 잔액",
    instantSwap: "실시간 스왑 (수수료 0.1%)", pay: "지불", receive: "수령 (예상)", confirmSwap: "실시간 스왑 실행",
    withdrawUsdt: "USDT 출금 (BSC)", applyWithdraw: "출금 신청", depositUsdt: "USDT 입금 (BSC)",
    gameNodes: "게임기 장비 (구매 시 URD 증정)", startGame: "게임 실행 (10 URD 소모)",
    node100: "$100 게임기 (1,500 URD 증정)", node500: "$500 게임기 (8,000 URD 증정)", node1000: "$1,000 게임기 (17,000 URD 증정)",
    directRef: "추천 계보", sponsorArch: "후원 계보",
    langSetting: "언어 설정 (Language)", shareRefLink: "내 추천 링크 공유", logout: "로그아웃",
    active: "활성", inactive: "미활성",
    shopTitle: "게임기 상품몰", buyProduct: "게임기 구매하기",
    myActiveNodes: "보유 게임기 현황",
    runningCount: "개 구동 중", runningStatus: "구동 중", cap: "한도", purchaseDate: "구매일", achievement: "달성율",
    node100Name: "$100 게임기", node500Name: "$500 게임기", node1000Name: "$1,000 게임기",
    confirmPurchaseTitle: "게임기 상품 구매 확인", confirmPurchaseMsg: "USDT로 선택하신 게임기 상품을 구매하시겠습니까?",
    confirm: "확인 구매", cancel: "취소",
    unpaidMembersTitle: "상품 미구매 추천 회원", unpaidMembersSub: "",
    directTreeSub: "직추천 조직", sponsorTreeSub: "후원 계보 조직",
    bet1minLimit: "마감 1분 전 게임 마감", round: "회차", round1: "1회차", round2: "2회차", round3: "3회차",
    betTime: "참여 가능 시간", aiDraw: "AI 당첨 발표", drawTime: "발표 시각", selectRound: "참여 회차 선택",
    selectBetCount: "게임 횟수 선택 (회당 10 URD)", totalCost: "총 소모", manualBetBtn: "게임 참여하기",
    autoBetRounds: "자동 참여 회차 (다중 선택)", dailyRepeat: "매일 반복 자동 참여",
    dailyRepeatSub: "매일 지정 시각에 자동으로 URD 게임 참여",
    saveAutoSettings: "⚡ 자동 게임 세팅 저장 및 시작", stopAutoSettings: "✓ 자동 게임 구동 중 (클릭 시 중지)",
    recentBets: "내 최근 게임 참여 내역", waitingAnnouncement: "대기 중 (발표 예정)",
    holdings: "보유 자산", initialBalance: "최초잔고", totalProfit: "총 수익", yieldRate: "수익률",
    deposit: "입금", withdraw: "출금", swap: "스왑", history: "내역", coinsCount: "3 종목",
    txHistoryTitle: "입출금 및 보너스 내역",
  },
  en: {
    home: "Home", wallet: "Wallet", products: "Shop", game: "Game Zone", network: "Network", settings: "Settings",
    miningStatus: "Game Machine Status", dailyYield: "Daily Yield Rate", gaugeTitle: "Bonus Cap Limit Progress (200% ~ 300%)",
    usdtBalance: "USDT Balance", urcBalance: "URC Balance", urdBalance: "URD Token Balance",
    instantSwap: "Instant Swap (0.1% Fee)", pay: "Pay", receive: "Receive (Est.)", confirmSwap: "Execute Swap",
    withdrawUsdt: "Withdraw USDT (BSC)", applyWithdraw: "Request Withdrawal", depositUsdt: "Deposit USDT (BSC)",
    gameNodes: "Game Equipment (Bonus URD on Purchase)", startGame: "Start Game (Cost 10 URD)",
    node100: "$100 Machine (1,500 URD Bonus)", node500: "$500 Machine (8,000 URD Bonus)", node1000: "$1,000 Machine (17,000 URD Bonus)",
    directRef: "Direct Referral Tree", sponsorArch: "Sponsor Tree",
    langSetting: "Language Settings", shareRefLink: "Share Referral Link", logout: "Log Out",
    active: "Active", inactive: "Inactive",
    shopTitle: "Game Machine Shop", buyProduct: "Buy Game Machine",
    myActiveNodes: "My Active Game Machines",
    runningCount: "Machines Running", runningStatus: "Running", cap: "Cap", purchaseDate: "Purchased", achievement: "Progress",
    node100Name: "$100 Machine", node500Name: "$500 Machine", node1000Name: "$1,000 Machine",
    confirmPurchaseTitle: "Confirm Game Machine Purchase", confirmPurchaseMsg: "Do you want to purchase the selected game machine with USDT?",
    confirm: "Confirm Purchase", cancel: "Cancel",
    unpaidMembersTitle: "Unpurchased Referral Members", unpaidMembersSub: "",
    directTreeSub: "Direct Referral Tree", sponsorTreeSub: "Sponsor Tree",
    bet1minLimit: "Game closes 1 min before deadline", round: "Round", round1: "Round 1", round2: "Round 2", round3: "Round 3",
    betTime: "Playable Time", aiDraw: "AI Draw Announcement", drawTime: "Draw Time", selectRound: "Select Round",
    selectBetCount: "Select Game Play Count (10 URD each)", totalCost: "Total Cost", manualBetBtn: "Join Game",
    autoBetRounds: "Auto Rounds (Multi-select)", dailyRepeat: "Daily Auto Repeat",
    dailyRepeatSub: "Automatically play URD game at scheduled times daily",
    saveAutoSettings: "⚡ Save & Start Auto Game", stopAutoSettings: "✓ Auto Game Running (Click to stop)",
    recentBets: "My Recent Game Records", waitingAnnouncement: "Waiting for Draw",
    holdings: "Holdings", initialBalance: "Initial Balance", totalProfit: "Total Profit", yieldRate: "Yield Rate",
    deposit: "Deposit", withdraw: "Withdraw", swap: "Swap", history: "History", coinsCount: "3 Assets",
    txHistoryTitle: "Transactions & Bonus History",
  },
  zh: {
    home: "首页", wallet: "钱包", products: "商城", game: "竞技场", network: "团队", settings: "设置",
    miningStatus: "游戏设备运行状态", dailyYield: "日收益率", gaugeTitle: "奖金封顶额度进度 (200% ~ 300%)",
    usdtBalance: "USDT 余额", urcBalance: "URC 余额", urdBalance: "URD 代币余额",
    instantSwap: "闪兑 (手续费 0.1%)", pay: "支付", receive: "获得 (预计)", confirmSwap: "确认兑换",
    withdrawUsdt: "提现 USDT (BSC)", applyWithdraw: "申请提现", depositUsdt: "充值 USDT (BSC)",
    gameNodes: "游戏设备 (购买赠送URD)", startGame: "启动游戏 (消耗 10 URD)",
    node100: "$100 游戏机 (赠 1,500 URD)", node500: "$500 游戏机 (赠 8,000 URD)", node1000: "$1,000 游戏机 (赠 17,000 URD)",
    directRef: "直推谱系", sponsorArch: "安置架构",
    langSetting: "语言设置 (Language)", shareRefLink: "分享推荐链接", logout: "退出登录",
    active: "活跃", inactive: "未激活",
    shopTitle: "游戏机商城", buyProduct: "购买游戏机",
    myActiveNodes: "我的运行游戏机",
    runningCount: "台运行中", runningStatus: "运行中", cap: "额度", purchaseDate: "购买日", achievement: "达成率",
    node100Name: "$100 游戏机", node500Name: "$500 游戏机", node1000Name: "$1,000 游戏机",
    confirmPurchaseTitle: "确认购买游戏机", confirmPurchaseMsg: "确定使用 USDT 购买所选游戏机吗？",
    confirm: "确认购买", cancel: "取消",
    unpaidMembersTitle: "未购设备推荐会员", unpaidMembersSub: "",
    directTreeSub: "直推谱系团队", sponsorTreeSub: "安置架构团队",
    bet1minLimit: "截止前1分钟停止游戏", round: "轮次", round1: "第1轮", round2: "第2轮", round3: "第3轮",
    betTime: "可游戏时间", aiDraw: "AI 抽奖公布", drawTime: "公布时间", selectRound: "选择游戏轮次",
    selectBetCount: "选择游戏次数 (每轮10 URD)", totalCost: "总消耗", manualBetBtn: "参与游戏",
    autoBetRounds: "自动参与轮次 (多选)", dailyRepeat: "每日重复自动游戏",
    dailyRepeatSub: "每日在指定时间自动参与URD游戏",
    saveAutoSettings: "⚡ 保存并启动自动游戏设置", stopAutoSettings: "✓ 自动游戏运行中 (点击停止)",
    recentBets: "我的近期游戏记录", waitingAnnouncement: "等待公布",
    holdings: "持有资产", initialBalance: "初始余额", totalProfit: "总收益", yieldRate: "收益率",
    deposit: "充值", withdraw: "提现", swap: "闪兑", history: "记录", coinsCount: "3 种资产",
    txHistoryTitle: "充提及奖金记录",
  }
};

interface ActiveMachine {
  id: string;
  level: number;
  name: string;
  price: number;
  urdBonus: number;
  payoutCap: number;
  accumulatedPayout: number;
  purchasedAt: string;
}

interface GameNotification {
  id: string;
  round: string;
  time: string;
  title: string;
  resultType: "USDT_WIN" | "COIN_WIN";
  rewardText: string;
  createdAt: string;
  read: boolean;
}

interface GameBetRecord {
  id: string;
  round: number;
  betsCount: number;
  urdSpent: number;
  status: "WAITING" | "COMPLETED";
  betAt: string;
}

interface UnpaidMember {
  id: string;
  nickname: string;
  email: string;
  joinedAt: string;
}

export default function MobileApp() {
  const supabase = createClient();
  const router = useRouter();
  const [lang, setLang] = useState<Language>("ko");
  const t = I18N[lang];
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [networkTab, setNetworkTab] = useState<NetworkTabType>("referral");
  const [referralCopied, setReferralCopied] = useState(false);

  // Pending Unpurchased Members List
  const [unpaidMembers, setUnpaidMembers] = useState<UnpaidMember[]>([
    { id: "u-1", nickname: "User B", email: "b_kim@urc369.com", joinedAt: "2026-07-21" },
    { id: "u-2", nickname: "User E", email: "yh_park@urc369.com", joinedAt: "2026-07-20" },
  ]);

  const handleDismissUnpaidMember = (id: string) => {
    setUnpaidMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // Notifications Modal & List State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications, setNotifications] = useState<GameNotification[]>([
    {
      id: "n-1",
      round: "1회차",
      time: "12:30",
      title: "🎉 1회차 AI 당첨 결과 발표",
      resultType: "USDT_WIN",
      rewardText: "USDT 102% 당첨! (+102.00 USDT 지불 완료)",
      createdAt: "12:30:05",
      read: false,
    },
    {
      id: "n-2",
      round: "2회차",
      time: "15:30",
      title: "🪙 2회차 AI 당첨 결과 발표",
      resultType: "COIN_WIN",
      rewardText: "코인 페이백 당첨! (+80.00 URC, +40.00 URD 지급 완료)",
      createdAt: "15:30:02",
      read: false,
    },
  ]);

  // Scheduled Game Engine States
  const [gameBetMode, setGameBetMode] = useState<"manual" | "auto">("manual");
  const [manualRound, setManualRound] = useState<number>(1);
  const [manualBetsCount, setManualBetsCount] = useState<number>(1);
  const [myBets, setMyBets] = useState<GameBetRecord[]>([
    { id: "b-1", round: 1, betsCount: 2, urdSpent: 20, status: "WAITING", betAt: "11:45" },
  ]);

  // Auto Betting Settings State
  const [autoSettings, setAutoSettings] = useState({
    enabled: false,
    dailyRepeat: true,
    rounds: [1, 2, 3],
    betsCount: 10, // Default 10 times = 100 URD
  });

  const [historyPage, setHistoryPage] = useState(1);

  const handleManualBet = () => {
    const cost = manualBetsCount * 10;
    if (urdBalance < cost) {
      alert(`URD 토큰이 부족합니다! (필요: ${cost} URD, 보유: ${urdBalance} URD)`);
      return;
    }

    setUrdBalance((prev) => prev - cost);
    const newBet: GameBetRecord = {
      id: `b-${Date.now()}`,
      round: manualRound,
      betsCount: manualBetsCount,
      urdSpent: cost,
      status: "WAITING",
      betAt: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    };

    setMyBets((prev) => [newBet, ...prev]);
    alert(`🎉 ${manualRound}회차 게임 참여 완료! (${manualBetsCount}회 / ${cost} URD 소모)\nAI 당첨 발표 시각에 결과가 발표됩니다.`);
  };

  const handleToggleAutoSettings = () => {
    const autoCost = autoSettings.betsCount * 10;
    if (!autoSettings.enabled) {
      if (urdBalance < autoCost) {
        alert(`⚡ URD 토큰이 부족하여 자동 게임을 시작할 수 없습니다! (필요: ${autoCost} URD, 보유: ${urdBalance} URD)`);
        // Add URD Depletion Notification to Bell
        const notif: GameNotification = {
          id: `n-${Date.now()}`,
          round: "자동 게임",
          time: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
          title: "⚠️ URD 토큰 소진으로 자동 게임 중단",
          resultType: "COIN_WIN",
          rewardText: `URD 토큰이 소진되어 자동 게임 참여가 중단되었습니다. (필요: ${autoCost} URD)`,
          createdAt: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
        return;
      }

      setAutoSettings((prev) => ({ ...prev, enabled: true }));
      setUrdBalance((prev) => prev - autoCost);
      alert(`⚡ 자동 게임 세팅이 활성화되었습니다!\n회당 ${autoSettings.betsCount}회 (${autoCost} URD 소모)로 매일 지정 회차에 자동으로 실행됩니다.`);
    } else {
      setAutoSettings((prev) => ({ ...prev, enabled: false }));
      alert("자동 게임 비활성화 완료");
    }
  };

  const toggleAutoRound = (roundNum: number) => {
    setAutoSettings((prev) => {
      const exists = prev.rounds.includes(roundNum);
      const nextRounds = exists ? prev.rounds.filter((r) => r !== roundNum) : [...prev.rounds, roundNum].sort();
      return { ...prev, rounds: nextRounds };
    });
  };

  // Purchased Active Game Machines
  const [myMachines, setMyMachines] = useState<ActiveMachine[]>([
    { id: "m-1", level: 1, name: "$100 노드", price: 100, urdBonus: 1500, payoutCap: 200, accumulatedPayout: 50, purchasedAt: "2026-07-21" },
    { id: "m-2", level: 3, name: "$1,000 노드", price: 1000, urdBonus: 17000, payoutCap: 3000, accumulatedPayout: 800, purchasedAt: "2026-07-21" },
  ]);

  // Purchase Confirmation Modal State
  const [confirmPurchaseModal, setConfirmPurchaseModal] = useState<{
    show: boolean;
    level: number;
    price: number;
    urdBonus: number;
    capRate: number;
  } | null>(null);

  const handleRequestPurchase = (level: number, price: number, urdBonus: number, capRate: number) => {
    if (usdtBalance < price) {
      alert(lang === "ko" ? "USDT 잔액이 부족합니다. 먼저 USDT를 입금해 주세요!" : lang === "en" ? "Insufficient USDT balance! Please deposit first." : "USDT 余额不足！请先充值。");
      return;
    }

    setConfirmPurchaseModal({ show: true, level, price, urdBonus, capRate });
  };

  const executePurchaseProduct = () => {
    if (!confirmPurchaseModal) return;
    const { price, urdBonus, capRate, level } = confirmPurchaseModal;

    if (usdtBalance < price) {
      alert(lang === "ko" ? "USDT 잔액이 부족합니다. 먼저 USDT를 입금해 주세요!" : lang === "en" ? "Insufficient USDT balance! Please deposit first." : "USDT 余额不足！请先充值。");
      setConfirmPurchaseModal(null);
      return;
    }

    const payoutCap = price * capRate;
    const nodeName = level === 1 ? t.node100Name : level === 2 ? t.node500Name : t.node1000Name;

    const newMachine: ActiveMachine = {
      id: `m-${Date.now()}`,
      level,
      name: nodeName,
      price,
      urdBonus,
      payoutCap,
      accumulatedPayout: 0,
      purchasedAt: new Date().toISOString().split("T")[0],
    };

    setUsdtBalance((prev) => prev - price);
    setUrdBalance((prev) => prev + urdBonus);
    setMyMachines((prev) => [...prev, newMachine]);
    setConfirmPurchaseModal(null);

    alert(lang === "ko" 
      ? `🎉 $${price.toLocaleString()} 게임기 구매 성공! ${urdBonus.toLocaleString()} URD 토큰이 즉시 지급되었습니다.` 
      : lang === "en" 
      ? `🎉 Purchased $${price.toLocaleString()} Node! +${urdBonus.toLocaleString()} URD credited.` 
      : `🎉 成功购买 $${price.toLocaleString()} 节点！赠送 ${urdBonus.toLocaleString()} URD 代币！`);
  };
  const [directTree] = useState([
    { id: 1, nickname: "User A", referralSeq: 1, status: "ACTIVE" },
    { id: 2, nickname: "User B", referralSeq: 2, status: "INACTIVE" }
  ]);
  const [sponsorTree] = useState([
    { id: 3, nickname: "User C", tier: 1, status: "ACTIVE" },
    { id: 4, nickname: "User D", tier: 2, status: "ACTIVE" }
  ]);
  const [userEmail, setUserEmail] = useState("user@urc369.com");
  const [countdown, setCountdown] = useState("");
  const [urdBalance, setUrdBalance] = useState(3000);
  const [usdtBalance, setUsdtBalance] = useState(10500.00);
  const [urcBalance, setUrcBalance] = useState(4980.00);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isUsdtToUrc, setIsUsdtToUrc] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawToken, setWithdrawToken] = useState<"USDT" | "URC">("USDT");
  const [depositToken, setDepositToken] = useState<"USDT" | "URC">("USDT");
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  
  const [userDepositAddress] = useState("0x3a9B8f5C01A29D478b1E4109C2d4317e1D4A8912");
  const [addressCopied, setAddressCopied] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const copyDepositAddress = () => {
    navigator.clipboard.writeText(userDepositAddress);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  // Game Play Modal Result State
  const [gameResultModal, setGameResultModal] = useState<{
    show: boolean;
    type: "USDT_WIN" | "COIN_WIN";
    usdtAmount?: number;
    urcAmount?: number;
    urdAmount?: number;
  } | null>(null);

  const [isPlayingGame, setIsPlayingGame] = useState(false);

  const handlePlayGame = (betAmount: number = 100) => {
    if (urdBalance < 10) {
      alert("URD代币不足！(单次游戏需消耗 10 URD)");
      return;
    }

    setIsPlayingGame(true);
    setUrdBalance((prev) => prev - 10);

    setTimeout(() => {
      // 50% random chance for USDT 102% vs Coin 120% (80% URC + 40% URD)
      const isUsdtWin = Math.random() > 0.5;

      if (isUsdtWin) {
        const rewardUsdt = betAmount * 1.02; // 102% payout
        setUsdtBalance((prev) => prev + rewardUsdt);
        setGameResultModal({
          show: true,
          type: "USDT_WIN",
          usdtAmount: rewardUsdt,
        });
      } else {
        const rewardUrc = betAmount * 0.80; // 80% URC
        const rewardUrd = betAmount * 0.40; // 40% URD
        setUrcBalance((prev) => prev + rewardUrc);
        setUrdBalance((prev) => prev + rewardUrd);
        setGameResultModal({
          show: true,
          type: "COIN_WIN",
          urcAmount: rewardUrc,
          urdAmount: rewardUrd,
        });
      }
      setIsPlayingGame(false);
    }, 1200);
  };

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
      const h = beijingTime.getHours().toString().padStart(2, "0");
      const m = beijingTime.getMinutes().toString().padStart(2, "0");
      const s = beijingTime.getSeconds().toString().padStart(2, "0");
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

  const handleConfirmSwap = () => {
    const val = Number(fromAmount);
    if (!val || val <= 0) {
      alert("请输入有效的兑换金额");
      return;
    }

    if (isUsdtToUrc) {
      if (val > usdtBalance) {
        alert("USDT 余额不足");
        return;
      }
      const received = val * 0.999;
      setUsdtBalance((prev) => prev - val);
      setUrcBalance((prev) => prev + received);
      alert(`成功将 ${val} USDT 闪兑为 ${received.toFixed(2)} URC !`);
    } else {
      if (val > urcBalance) {
        alert("URC 余额不足");
        return;
      }
      const received = val * 0.999;
      setUrcBalance((prev) => prev - val);
      setUsdtBalance((prev) => prev + received);
      alert(`成功将 ${val} URC 闪兑为 ${received.toFixed(2)} USDT !`);
    }

    setFromAmount("");
    setToAmount("");
  };

  const withdrawFee = Number(withdrawAmount) ? Number(withdrawAmount) * 0.03 : 0;
  const withdrawFinal = Number(withdrawAmount) ? Number(withdrawAmount) * 0.97 : 0;
  const totalAssetValuation = usdtBalance + urcBalance + urdBalance / 15;

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
          {activeTab === "game" && (
            <div className="flex items-center space-x-1.5 bg-[#1E2329] rounded px-2.5 py-1.5 border border-[#2B3139]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0ECB81] animate-pulse" />
              <span className="text-[10px] text-[#0ECB81] font-bold">UTC+8 {countdown}</span>
            </div>
          )}
          <button 
            onClick={() => setShowNotifModal(true)} 
            className="relative p-1.5 bg-[#1E2329] hover:bg-[#2B3139] rounded transition-colors"
          >
            <Bell size={14} className="text-[#FCD535]" />
            {notifications.some((n) => !n.read) && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#F6465D] rounded-full animate-ping" />
            )}
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-[#F6465D] rounded-full" />
          </button>
        </div>
      </div>

      {/* Wallet Network & Price Sub Header (Below grey line) */}
      {activeTab === "wallet" && (
        <div className="bg-[#161A1E] border-b border-[#2B3139] px-5 py-2.5 flex justify-between items-center text-xs">
          <div className="flex items-center space-x-1.5 font-mono">
            <span className="text-[#848E9C]">USDT</span>
            <span className="font-bold text-[#EAECEF]">$1.00</span>
            <span className="text-[#0ECB81] text-[10px] flex items-center font-bold ml-1">▲ 0.01%</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse" />
            <span className="text-[11px] font-bold text-[#EAECEF]">BSC Network</span>
          </div>
        </div>
      )}

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
            <div className="rounded-xl p-5 bg-[#1E2329] border border-[#2B3139]">
              <p className="text-xs text-[#848E9C] font-medium">
                {lang === "ko" ? "총 자산 평가액" : lang === "en" ? "Total Valuation" : "总资产估值"}
              </p>
              <h2 className="text-3xl font-black text-[#EAECEF] mt-1 tracking-tight font-mono">
                ${totalAssetValuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div className="flex items-center space-x-1.5 text-[#0ECB81] text-xs font-bold mt-1.5">
                <TrendingUp size={12} />
                <span>+12.4% (24h)</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-[#2B3139]">
                <div>
                  <p className="text-[10px] text-[#848E9C]">USDT</p>
                  <p className="text-sm font-bold font-mono text-[#EAECEF] mt-0.5">
                    {usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#848E9C]">URC</p>
                  <p className="text-sm font-bold font-mono text-[#EAECEF] mt-0.5">
                    {urcBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Purchased Game Machines Section */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-extrabold text-[#EAECEF] flex items-center space-x-1.5">
                  <Gamepad2 size={14} className="text-[#FCD535]" />
                  <span>{t.myActiveNodes}</span>
                </h3>
                <span className="text-[10px] text-[#848E9C]">
                  {myMachines.filter((m) => m.accumulatedPayout < m.payoutCap).length}{t.runningCount}
                </span>
              </div>

              {myMachines.filter((m) => m.accumulatedPayout < m.payoutCap).length === 0 ? (
                <div className="bg-[#1E2329] rounded-xl p-4 text-center border border-[#2B3139]">
                  <p className="text-xs text-[#848E9C]">
                    {lang === "ko" ? "구동 중인 게임기 노드가 없습니다." : lang === "en" ? "No active game nodes." : "暂无运行中的游戏节点设备。"}
                  </p>
                  <button 
                    onClick={() => setActiveTab("products")}
                    className="mt-2 text-xs font-bold text-[#FCD535] underline"
                  >
                    {lang === "ko" ? "상품몰에서 노드 구매하기 ➔" : lang === "en" ? "Buy Nodes in Shop ➔" : "前往商城购买节点 ➔"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {myMachines
                    .filter((m) => m.accumulatedPayout < m.payoutCap)
                    .map((m) => {
                      const pct = Math.min(100, Math.floor((m.accumulatedPayout / m.payoutCap) * 100));
                      return (
                        <div key={m.id} className="bg-[#1E2329] border border-[#2B3139] hover:border-[#FCD535]/50 rounded-xl p-3.5 space-y-2 transition-all">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-black text-[#FCD535] bg-[#FCD535]/10 px-2 py-0.5 rounded">
                                {m.level === 1 ? t.node100Name : m.level === 2 ? t.node500Name : t.node1000Name}
                              </span>
                              <span className="text-[10px] text-[#0ECB81] font-bold">● {t.runningStatus}</span>
                            </div>
                            <span className="text-[10px] font-mono text-[#848E9C]">
                              {t.cap}: ${m.accumulatedPayout.toFixed(0)} / ${m.payoutCap.toFixed(0)}
                            </span>
                          </div>

                          <div className="w-full bg-[#0B0E11] rounded-full h-1.5">
                            <div className="bg-[#0ECB81] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>

                          <div className="flex justify-between items-center text-[9px] text-[#848E9C]">
                            <span>{t.purchaseDate}: {m.purchasedAt}</span>
                            <span className="font-bold text-[#EAECEF]">{t.achievement} {pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Max-Out Gauge Card (Cumulative Payout Cap Progress) */}
            {(() => {
              const totalCap = myMachines.reduce((sum, m) => sum + m.payoutCap, 0);
              const totalPayout = myMachines.reduce((sum, m) => sum + m.accumulatedPayout, 0);
              const remainingCap = Math.max(0, totalCap - totalPayout);
              const progressPct = totalCap > 0 ? Math.min(100, Math.floor((totalPayout / totalCap) * 100)) : 0;

              return (
                <div className="bg-[#1E2329] border border-[#2B3139] rounded-xl p-4 space-y-2.5">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-[#848E9C]">
                        {lang === "ko" ? "누적 수당 수령액 / 총 한도" : lang === "en" ? "Total Payout / Cap" : "累计领奖 / 总额度"}
                      </p>
                      <div className="flex items-baseline space-x-1 mt-0.5">
                        <span className="text-lg font-black text-[#EAECEF]">${totalPayout.toLocaleString()}</span>
                        <span className="text-[#848E9C] text-xs font-bold">/ ${totalCap.toLocaleString()} USDT</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#848E9C]">
                        {lang === "ko" ? "수령 가능 잔여 한도" : lang === "en" ? "Remaining Cap" : "剩余可领额度"}
                      </p>
                      <span className="text-xs font-mono font-extrabold text-[#FCD535]">
                        ${remainingCap.toLocaleString()} USDT
                      </span>
                    </div>
                  </div>

                  {/* Progress Gauge Bar */}
                  <div className="w-full bg-[#0B0E11] rounded-full h-2.5 overflow-hidden border border-[#2B3139]">
                    <div 
                      className="bg-gradient-to-r from-[#FCD535] to-[#0ECB81] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-[#848E9C]">
                    <span>{lang === "ko" ? "전체 노드 통합 수당 달성률" : lang === "en" ? "Overall Node Cap Progress" : "全节点整合封顶进度"}</span>
                    <span className="font-extrabold text-[#0ECB81]">{progressPct}% {lang === "ko" ? "달성" : lang === "en" ? "Used" : "已用"}</span>
                  </div>
                </div>
              );
            })()}

            {/* Quick Actions (Icons Only) */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: <ArrowDownLeft size={20} />, onClick: () => { setActiveTab("wallet"); setShowDepositModal(true); } },
                { icon: <ArrowUpRight size={20} />, onClick: () => setActiveTab("wallet") },
                { icon: <ArrowRightLeft size={20} />, onClick: () => setActiveTab("wallet") },
                { icon: <Gamepad2 size={20} />, onClick: () => setActiveTab("game") },
              ].map((a, i) => (
                <button key={i} onClick={a.onClick}
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
                  <span className="text-xs font-bold text-[#EAECEF]">{lang === "ko" ? "오늘의 보너스" : lang === "en" ? "Today's Bonus" : "今日奖金"}</span>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: lang === "ko" ? "직추천 보너스 (20%)" : lang === "en" ? "Direct Bonus (20%)" : "直推奖 (20%)", value: "+$200.00" },
                  { label: lang === "ko" ? "육성 보너스 (10%)" : lang === "en" ? "Mentoring Bonus (10%)" : "育人奖 (10%)", value: "+$50.00" },
                  { label: lang === "ko" ? "엄마 보너스 (10%)" : lang === "en" ? "Mother Bonus (10%)" : "母体奖 (10%)", value: "+$50.00" },
                  { label: lang === "ko" ? "직급 보너스 (15%)" : lang === "en" ? "Rank Bonus (15%)" : "平级奖 (15%)", value: "+$50.00" },
                ].map((b) => (
                  <div key={b.label} className="flex justify-between text-xs">
                    <span className="text-[#848E9C]">{b.label}</span>
                    <span className="font-bold text-[#0ECB81]">{b.value}</span>
                  </div>
                ))}
                <div className="border-t border-[#2B3139] pt-2 flex justify-between text-xs font-bold">
                  <span>{lang === "ko" ? "오늘 총 보너스" : lang === "en" ? "Today's Total" : "今日总计"}</span>
                  <span className="text-[#FCD535]">+$350.00</span>
                </div>
              </div>
            </div>
            
          </div>
        )}

        {/* ═══════════════ WALLET ═══════════════ */}
        {activeTab === "wallet" && (
          <div className="p-5 space-y-5">
            {/* Main Asset Overview Card */}
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-5 space-y-5 shadow-lg">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-[#848E9C] font-bold">
                    {lang === "ko" ? "총 자산 평가액" : lang === "en" ? "Total Asset Valuation" : "总资产估值"}
                  </p>
                  <h2 className="text-3xl font-black text-[#EAECEF] tracking-tight font-mono mt-1">
                    ${totalAssetValuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h2>
                </div>
              </div>

              {/* 3-Column Stats: Initial Balance | Total Profit | Yield Rate */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#2B3139]/60">
                <div>
                  <p className="text-[10px] font-bold text-[#848E9C]">{t.initialBalance}</p>
                  <p className="text-xs font-bold text-[#EAECEF] mt-1">$10,000.00</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#848E9C]">{t.totalProfit}</p>
                  <p className="text-xs font-bold text-[#0ECB81] mt-1">+$500.00</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#848E9C]">{t.yieldRate}</p>
                  <p className="text-xs font-bold text-[#0ECB81] mt-1">+5.00%</p>
                </div>
              </div>

              {/* 4 Action Buttons: Deposit, Withdraw, Swap, History */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#FCD535] py-3 rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all group"
                >
                  <ArrowDownLeft size={18} className="text-[#0ECB81] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#EAECEF]">{t.deposit}</span>
                </button>

                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#FCD535] py-3 rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all group"
                >
                  <ArrowUpRight size={18} className="text-[#F6465D] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#EAECEF]">{t.withdraw}</span>
                </button>

                <button
                  onClick={() => setShowSwapModal(true)}
                  className="bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#FCD535] py-3 rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all group"
                >
                  <ArrowRightLeft size={18} className="text-[#FCD535] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#EAECEF]">{t.swap}</span>
                </button>

                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#FCD535] py-3 rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all group"
                >
                  <FileText size={18} className="text-[#848E9C] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#EAECEF]">{t.history}</span>
                </button>
              </div>
            </div>

            {/* Holdings Section (Attached Image 1 Style) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-extrabold text-[#EAECEF]">{t.holdings}</h3>
                <span className="text-[10px] text-[#848E9C] font-bold">{t.coinsCount}</span>
              </div>

              <div className="space-y-2.5">
                {/* Token 1: USDT (Tether) */}
                <div className="bg-[#1E2329] border border-[#2B3139] hover:border-[#26A17B]/60 rounded-2xl p-4 flex justify-between items-center transition-all">
                  <div className="flex items-center space-x-3">
                    <TetherLogo />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-extrabold text-[#EAECEF]">USDT</span>
                        <span className="text-[9px] font-extrabold text-[#26A17B] bg-[#26A17B]/10 border border-[#26A17B]/30 px-1.5 py-0.5 rounded">
                          STABLE
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#848E9C] mt-0.5">
                        {usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 4 })} USDT
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold font-mono text-[#EAECEF]">
                      ${usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] font-bold text-[#848E9C] mt-0.5">0.00%</p>
                  </div>
                </div>
                {/* Token 2: URC */}
                <div className="bg-[#1E2329] border border-[#2B3139] hover:border-[#FCD535]/60 rounded-2xl p-4 flex justify-between items-center transition-all">
                  <div className="flex items-center space-x-3">
                    <UrcLogo />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-extrabold text-[#EAECEF]">URC</span>
                        <span className="text-[9px] font-extrabold text-[#FCD535] bg-[#FCD535]/10 border border-[#FCD535]/30 px-1.5 py-0.5 rounded">
                          UTILITY
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#848E9C] mt-0.5">
                        {urcBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} URC
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold font-mono text-[#EAECEF]">
                      ${urcBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] font-bold text-[#0ECB81] mt-0.5">+12.40%</p>
                  </div>
                </div>

                {/* Token 3: URD */}
                <div className="bg-[#1E2329] border border-[#2B3139] hover:border-[#3498DB]/60 rounded-2xl p-4 flex justify-between items-center transition-all">
                  <div className="flex items-center space-x-3">
                    <UrdLogo />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-extrabold text-[#EAECEF]">URD</span>
                        <span className="text-[9px] font-extrabold text-[#3498DB] bg-[#3498DB]/10 border border-[#3498DB]/30 px-1.5 py-0.5 rounded">
                          GAME TOKEN
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#848E9C] mt-0.5">
                        {urdBalance.toLocaleString()} URD
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold font-mono text-[#EAECEF]">
                      ${(urdBalance / 15).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] font-bold text-[#848E9C] mt-0.5">0.00%</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* Deposit Modal Popup */}
        {showDepositModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative">
              <button 
                onClick={() => setShowDepositModal(false)}
                className="absolute top-3 right-3 text-[#848E9C] hover:text-[#EAECEF] text-sm font-bold p-1 hover:bg-[#2B3139] rounded"
              >
                ✕
              </button>
              
              <div className="flex items-center justify-center space-x-2 text-[#FCD535]">
                <Wallet size={20} />
                <h3 className="text-sm font-bold text-[#EAECEF]">
                  {depositToken} {lang === "ko" ? "입금 (BSC)" : lang === "en" ? "Deposit (BSC)" : "充值 (BSC)"}
                </h3>
              </div>

              {/* Deposit Token Selector (USDT & URC) */}
              <div className="grid grid-cols-2 gap-2 bg-[#0B0E11] p-1 rounded-xl border border-[#2B3139]">
                <button
                  type="button"
                  onClick={() => setDepositToken("USDT")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    depositToken === "USDT" ? "bg-[#26A17B] text-white" : "text-[#848E9C] hover:text-[#EAECEF]"
                  }`}
                >
                  USDT (Tether)
                </button>
                <button
                  type="button"
                  onClick={() => setDepositToken("URC")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    depositToken === "URC" ? "bg-[#FCD535] text-[#0B0E11]" : "text-[#848E9C] hover:text-[#EAECEF]"
                  }`}
                >
                  URC (Token)
                </button>
              </div>

              {/* Dynamic QR Code Image */}
              <div className="w-40 h-40 bg-white rounded-xl mx-auto p-2.5 flex items-center justify-center shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${userDepositAddress}`}
                  alt={`${depositToken} BSC Deposit QR Code`}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Deposit Address Display */}
              <div className="space-y-2">
                <p className="text-[10px] text-[#848E9C] text-center">
                  개인 전용 BSC (BEP-20) {depositToken} 입금 주소
                </p>

                <div className="bg-[#0B0E11] p-3 rounded-lg border border-[#2B3139] flex justify-between items-center space-x-2">
                  <span className="text-[10px] font-mono text-[#EAECEF] break-all select-all">
                    {userDepositAddress}
                  </span>
                  <button 
                    onClick={copyDepositAddress} 
                    className="p-1.5 bg-[#2B3139] hover:bg-[#FCD535] hover:text-[#0B0E11] rounded text-[#848E9C] transition-colors flex-shrink-0 flex items-center space-x-1"
                  >
                    {addressCopied ? <Check size={12} className="text-[#0ECB81]" /> : <Copy size={12} />}
                    <span className="text-[10px] font-bold">
                      {addressCopied ? (lang === "ko" ? "복사됨!" : lang === "en" ? "Copied!" : "已复制!") : (lang === "ko" ? "복사" : lang === "en" ? "Copy" : "复制")}
                    </span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowDepositModal(false)}
                className="w-full py-2.5 bg-[#FCD535] text-[#0B0E11] font-bold rounded-xl text-xs hover:opacity-90 transition-opacity"
              >
                {lang === "ko" ? "닫기" : lang === "en" ? "Close" : "关闭"}
              </button>
            </div>
          </div>
        )}

        {/* Withdraw Modal Popup */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative">
              <button 
                onClick={() => setShowWithdrawModal(false)}
                className="absolute top-3 right-3 text-[#848E9C] hover:text-[#EAECEF] text-sm font-bold p-1 hover:bg-[#2B3139] rounded"
              >
                ✕
              </button>

              <div className="flex items-center space-x-2 text-[#F6465D] border-b border-[#2B3139] pb-3">
                <ArrowUpRight size={18} />
                <h3 className="text-sm font-extrabold text-[#EAECEF]">
                  {withdrawToken} {lang === "ko" ? "출금 (BSC)" : lang === "en" ? "Withdrawal (BSC)" : "提现 (BSC)"}
                </h3>
              </div>

              <div className="space-y-3">
                {/* Select Coin to Withdraw (USDT & URC only, URD excluded) */}
                <div>
                  <label className="text-xs text-[#848E9C] font-bold">
                    {lang === "ko" ? "출금 자산 선택" : lang === "en" ? "Select Asset" : "选择提现资产"}
                  </label>
                  <select
                    value={withdrawToken}
                    onChange={(e) => setWithdrawToken(e.target.value as "USDT" | "URC")}
                    className="w-full mt-1 bg-[#0B0E11] border border-[#2B3139] rounded-xl px-3 py-2.5 text-xs text-[#FCD535] font-bold focus:outline-none focus:border-[#FCD535]"
                  >
                    <option value="USDT">USDT (Tether) - BSC BEP20</option>
                    <option value="URC">URC (Utility Token) - BSC BEP20</option>
                  </select>
                  <p className="text-[10px] text-[#848E9C] mt-1">※ URD 토큰은 출금이 불가능한 게임 전용 토큰입니다.</p>
                </div>

                {/* BSC Withdrawal Address with Square Paste Icon Button */}
                <div>
                  <label className="text-xs text-[#848E9C] font-bold">
                    BSC (BEP-20) {lang === "ko" ? "출금 주소" : lang === "en" ? "Withdrawal Address" : "提现地址"}
                  </label>
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="text"
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                      placeholder="0x로 시작하는 BSC 지갑 주소 입력"
                      className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-xl px-3 py-2.5 text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] font-mono"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setWithdrawAddress(text);
                        } catch (e) {
                          alert("클립보드 주소를 읽어올 수 없습니다.");
                        }
                      }}
                      className="p-2.5 bg-[#2B3139] hover:bg-[#FCD535] hover:text-[#0B0E11] text-[#FCD535] rounded-xl border border-[#2B3139] transition-all flex items-center justify-center flex-shrink-0"
                      title="클립보드 주소 붙여넣기"
                    >
                      <ClipboardPaste size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-[#848E9C] font-bold">
                      {lang === "ko" ? `출금 금액 (${withdrawToken})` : `Amount (${withdrawToken})`}
                    </label>
                    <span className="text-[#848E9C] text-[10px]">
                      {lang === "ko" ? "보유" : "Bal"}: {withdrawToken === "USDT" ? `${usdtBalance.toFixed(2)} USDT` : `${urcBalance.toFixed(2)} URC`}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`최소 30 ${withdrawToken}`}
                    className="w-full mt-1 bg-[#0B0E11] border border-[#2B3139] rounded-xl px-3 py-2.5 text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] font-mono"
                  />
                </div>

                <div className="bg-[#0B0E11] rounded-xl p-3 border border-[#2B3139] space-y-1 text-xs">
                  <div className="flex justify-between text-[#848E9C]">
                    <span>{lang === "ko" ? "출금 수수료 (3%)" : lang === "en" ? "Fee (3%)" : "手续费 (3%)"}</span>
                    <span>{withdrawFee.toFixed(2)} {withdrawToken}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#EAECEF] pt-1 border-t border-[#2B3139]">
                    <span>{lang === "ko" ? "실제 수령 금액" : lang === "en" ? "You Receive" : "实际到账"}</span>
                    <span className="text-[#0ECB81]">{withdrawFinal.toFixed(2)} {withdrawToken}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const currentBal = withdrawToken === "USDT" ? usdtBalance : urcBalance;
                    if (!withdrawAmount || Number(withdrawAmount) < 30) {
                      alert(`최소 출금 금액은 30 ${withdrawToken}입니다.`);
                      return;
                    }
                    if (Number(withdrawAmount) > currentBal) {
                      alert(`${withdrawToken} 잔액이 부족합니다.`);
                      return;
                    }

                    if (withdrawToken === "USDT") {
                      setUsdtBalance((prev) => prev - Number(withdrawAmount));
                    } else {
                      setUrcBalance((prev) => prev - Number(withdrawAmount));
                    }

                    setWithdrawAmount("");
                    setShowWithdrawModal(false);
                    alert(`✅ ${withdrawAmount} ${withdrawToken} 출금 신청이 성공적으로 접수되었습니다. (네트워크 승인 후 지급)`);
                  }}
                  className="w-full py-3 bg-[#FCD535] text-[#0B0E11] font-black rounded-xl text-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  {t.applyWithdraw}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Swap Modal Popup */}
        {showSwapModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative">
              <button 
                onClick={() => setShowSwapModal(false)}
                className="absolute top-3 right-3 text-[#848E9C] hover:text-[#EAECEF] text-sm font-bold p-1 hover:bg-[#2B3139] rounded"
              >
                ✕
              </button>

              <div className="flex items-center space-x-2 text-[#FCD535] border-b border-[#2B3139] pb-3">
                <ArrowRightLeft size={18} />
                <h3 className="text-sm font-extrabold text-[#EAECEF]">{t.instantSwap}</h3>
              </div>

              <div className="space-y-3">
                {/* From Token */}
                <div className="bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139] space-y-1">
                  <div className="flex justify-between items-center text-xs text-[#848E9C]">
                    <span>{t.pay}</span>
                    <span>{isUsdtToUrc ? `잔액: $${usdtBalance.toFixed(2)}` : `잔액: ${urcBalance.toFixed(2)}`}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={fromAmount}
                      onChange={(e) => {
                        setFromAmount(e.target.value);
                        setToAmount(e.target.value ? (Number(e.target.value) * 0.999).toFixed(2) : "");
                      }}
                      placeholder="0.00"
                      className="w-full bg-transparent text-lg font-black text-[#EAECEF] focus:outline-none font-mono"
                    />
                    <span className="text-xs font-bold text-[#FCD535] bg-[#FCD535]/10 px-2 py-1 rounded">
                      {isUsdtToUrc ? "USDT" : "URC"}
                    </span>
                  </div>
                </div>

                {/* Switch Button */}
                <div className="flex justify-center -my-2 relative z-10">
                  <button
                    onClick={() => { setIsUsdtToUrc(!isUsdtToUrc); setFromAmount(""); setToAmount(""); }}
                    className="p-2 bg-[#2B3139] hover:bg-[#FCD535] hover:text-[#0B0E11] text-[#FCD535] rounded-full border border-[#2B3139] transition-all"
                  >
                    <ArrowRightLeft size={14} />
                  </button>
                </div>

                {/* To Token */}
                <div className="bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139] space-y-1">
                  <div className="flex justify-between items-center text-xs text-[#848E9C]">
                    <span>{t.receive}</span>
                    <span>{isUsdtToUrc ? `잔액: ${urcBalance.toFixed(2)}` : `잔액: $${usdtBalance.toFixed(2)}`}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={toAmount}
                      placeholder="0.00"
                      className="w-full bg-transparent text-lg font-black text-[#0ECB81] focus:outline-none font-mono"
                    />
                    <span className="text-xs font-bold text-[#0ECB81] bg-[#0ECB81]/10 px-2 py-1 rounded">
                      {isUsdtToUrc ? "URC" : "USDT"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleConfirmSwap();
                    setShowSwapModal(false);
                  }}
                  className="w-full py-3 bg-[#FCD535] text-[#0B0E11] font-black rounded-xl text-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  {t.confirmSwap}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Modal Popup */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl relative">
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="absolute top-3 right-3 text-[#848E9C] hover:text-[#EAECEF] text-sm font-bold p-1 hover:bg-[#2B3139] rounded"
              >
                ✕
              </button>

              <div className="flex items-center justify-between border-b border-[#2B3139] pb-3">
                <div className="flex items-center space-x-2 text-[#848E9C]">
                  <FileText size={18} />
                  <h3 className="text-sm font-extrabold text-[#EAECEF]">{t.txHistoryTitle}</h3>
                </div>
                <span className="text-[10px] text-[#848E9C] font-mono">총 12건</span>
              </div>

              {/* Paginated History Item List */}
              {(() => {
                const historyList = [
                  { id: "h1", type: lang === "ko" ? "입금 완료" : "Deposit Completed", amount: "+500.00 USDT", time: "2026-07-21 14:20", status: "성공", isPlus: true },
                  { id: "h2", type: lang === "ko" ? "직추천 보너스" : "Direct Bonus", amount: "+200.00 USDT", time: "2026-07-21 12:30", status: "지급완료", isPlus: true },
                  { id: "h3", type: lang === "ko" ? "육성 보너스" : "Mentoring Bonus", amount: "+50.00 USDT", time: "2026-07-21 12:30", status: "지급완료", isPlus: true },
                  { id: "h4", type: lang === "ko" ? "엄마 보너스" : "Mother Bonus", amount: "+50.00 USDT", time: "2026-07-21 12:30", status: "지급완료", isPlus: true },
                  { id: "h5", type: lang === "ko" ? "직급 보너스 (15%)" : "Rank Bonus", amount: "+50.00 USDT", time: "2026-07-21 12:30", status: "지급완료", isPlus: true },
                  { id: "h6", type: lang === "ko" ? "게임기 장비 구매" : "Machine Purchased", amount: "-500.00 USDT", time: "2026-07-20 18:10", status: "완료", isPlus: false },
                  { id: "h7", type: lang === "ko" ? "USDT ➔ URC 스왑" : "USDT ➔ URC Swap", amount: "-100.00 USDT", time: "2026-07-19 11:05", status: "성공", isPlus: false },
                  { id: "h8", type: lang === "ko" ? "1회차 게임 당첨" : "Round 1 Game Win", amount: "+102.00 USDT", time: "2026-07-18 12:30", status: "지급완료", isPlus: true },
                  { id: "h9", type: lang === "ko" ? "게임기 장비 구매" : "Machine Purchased", amount: "-100.00 USDT", time: "2026-07-17 09:15", status: "완료", isPlus: false },
                  { id: "h10", type: lang === "ko" ? "입금 완료" : "Deposit Completed", amount: "+1,000.00 USDT", time: "2026-07-16 16:40", status: "성공", isPlus: true },
                  { id: "h11", type: lang === "ko" ? "직추천 보너스" : "Direct Bonus", amount: "+100.00 USDT", time: "2026-07-15 11:20", status: "지급완료", isPlus: true },
                  { id: "h12", type: lang === "ko" ? "3회차 게임 당첨" : "Round 3 Game Win", amount: "+50.00 USDT", time: "2026-07-14 18:30", status: "지급완료", isPlus: true },
                ];

                const itemsPerPage = 10;
                const totalPages = Math.ceil(historyList.length / itemsPerPage);
                const currentItems = historyList.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

                return (
                  <div className="space-y-3">
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {currentItems.map((tx) => (
                        <div key={tx.id} className="bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139] flex justify-between items-center hover:border-[#2B3139]/80 transition-colors">
                          <div>
                            <p className="text-xs font-bold text-[#EAECEF]">{tx.type}</p>
                            <p className="text-[10px] text-[#848E9C] mt-0.5 font-mono">{tx.time}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-mono font-bold ${tx.isPlus ? "text-[#0ECB81]" : "text-[#EAECEF]"}`}>
                              {tx.amount}
                            </p>
                            <span className="text-[9px] text-[#848E9C] font-bold">{tx.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls (10 items per page) */}
                    <div className="flex justify-between items-center pt-2 border-t border-[#2B3139] text-xs">
                      <button
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                        className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                          historyPage === 1
                            ? "bg-[#0B0E11] border-[#2B3139] text-[#848E9C] opacity-50 cursor-not-allowed"
                            : "bg-[#2B3139] border-[#2B3139] text-[#EAECEF] hover:bg-[#FCD535] hover:text-[#0B0E11]"
                        }`}
                      >
                        ◀ 이전 10개
                      </button>

                      <span className="text-[11px] font-mono text-[#848E9C]">
                        <strong className="text-[#FCD535]">{historyPage}</strong> / {totalPages} 페이지
                      </span>

                      <button
                        disabled={historyPage === totalPages}
                        onClick={() => setHistoryPage((prev) => Math.min(totalPages, prev + 1))}
                        className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                          historyPage === totalPages
                            ? "bg-[#0B0E11] border-[#2B3139] text-[#848E9C] opacity-50 cursor-not-allowed"
                            : "bg-[#2B3139] border-[#2B3139] text-[#EAECEF] hover:bg-[#FCD535] hover:text-[#0B0E11]"
                        }`}
                      >
                        다음 10개 ▶
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── NOTIFICATION MODAL (BELL 🔔) ── */}
        {showNotifModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#1E2329] border border-[#FCD535]/40 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-[0_0_40px_rgba(252,213,53,0.2)] relative">
              <button 
                onClick={() => setShowNotifModal(false)}
                className="absolute top-3 right-3 text-[#848E9C] hover:text-[#EAECEF] text-sm font-bold p-1 hover:bg-[#2B3139] rounded"
              >
                ✕
              </button>

              <div className="flex items-center space-x-2 text-[#FCD535]">
                <Bell size={18} />
                <h3 className="text-sm font-bold text-[#EAECEF]">
                  {lang === "ko" ? "AI 당첨 결과 알림" : lang === "en" ? "AI Draw Notifications" : "AI 中奖通知"}
                </h3>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#848E9C]">
                    {lang === "ko" ? "새로운 당첨 알림이 없습니다." : "No notifications available."}
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139] space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-extrabold text-[#FCD535] bg-[#FCD535]/10 px-2 py-0.5 rounded">{n.round}</span>
                        <span className="text-[#848E9C] font-mono">{n.time} ({n.createdAt})</span>
                      </div>
                      <p className="text-xs font-bold text-[#EAECEF] pt-0.5">{n.title}</p>
                      <p className={`text-[11px] font-semibold ${n.resultType === "USDT_WIN" ? "text-[#0ECB81]" : "text-[#FCD535]"}`}>
                        {n.rewardText}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => {
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  setShowNotifModal(false);
                }}
                className="w-full py-2.5 bg-[#FCD535] text-[#0B0E11] font-bold rounded-xl text-xs hover:opacity-90 transition-opacity"
              >
                {lang === "ko" ? "모두 확인" : lang === "en" ? "Mark All Read" : "全部已读"}
              </button>
            </div>
          </div>
        )}

        {/* ── PURCHASE CONFIRMATION MODAL ── */}
        {confirmPurchaseModal?.show && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#1E2329] border border-[#FCD535]/40 rounded-2xl p-6 max-w-xs w-full text-center space-y-4 shadow-[0_0_40px_rgba(252,213,53,0.2)] relative">
              <button 
                onClick={() => setConfirmPurchaseModal(null)}
                className="absolute top-3 right-3 text-[#848E9C] hover:text-[#EAECEF] text-sm font-bold p-1 hover:bg-[#2B3139] rounded"
              >
                ✕
              </button>
              
              <div className="w-14 h-14 mx-auto rounded-full bg-[#FCD535]/10 text-[#FCD535] flex items-center justify-center text-2xl border border-[#FCD535]/30">
                🛍️
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[#EAECEF]">{t.confirmPurchaseTitle}</h3>
                <p className="text-xs text-[#848E9C] mt-1.5">{t.confirmPurchaseMsg}</p>
              </div>

              <div className="bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139] space-y-1.5 text-left text-xs">
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">
                    {lang === "ko" ? "구매 상품:" : lang === "en" ? "Item:" : "购买设备:"}
                  </span>
                  <span className="font-bold text-[#FCD535]">
                    ${confirmPurchaseModal.price.toLocaleString()} {confirmPurchaseModal.level === 1 ? t.node100Name : confirmPurchaseModal.level === 2 ? t.node500Name : t.node1000Name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848E9C]">
                    {lang === "ko" ? "보너스 토큰:" : lang === "en" ? "Bonus Tokens:" : "赠送代币:"}
                  </span>
                  <span className="font-bold text-[#0ECB81]">+{confirmPurchaseModal.urdBonus.toLocaleString()} URD</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setConfirmPurchaseModal(null)}
                  className="py-2.5 bg-[#2B3139] text-[#EAECEF] font-bold rounded-xl text-xs hover:bg-[#3A424D] transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={executePurchaseProduct}
                  className="py-2.5 bg-[#FCD535] text-[#0B0E11] font-black rounded-xl text-xs hover:opacity-90 transition-opacity shadow-md"
                >
                  {t.confirm}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ PRODUCTS SHOP ═══════════════ */}
        {activeTab === "products" && (
          <div className="p-5 space-y-5">
            {/* Top USDT Balance & Quick Deposit Card */}
            <div className="bg-[#1E2329] rounded-xl p-5 border border-[#2B3139] flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-[#848E9C]">{t.usdtBalance}</p>
                <h2 className="text-2xl font-black text-[#EAECEF] mt-1 tracking-tight">
                  {usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-[#848E9C]">USDT</span>
                </h2>
              </div>
              <button 
                onClick={() => { setActiveTab("wallet"); setShowDepositModal(true); }}
                className="px-3.5 py-2 bg-[#FCD535] text-[#0B0E11] font-bold rounded-lg text-xs hover:opacity-90 transition-opacity flex items-center space-x-1"
              >
                <Wallet size={14} />
                <span>USDT {lang === "ko" ? "입금" : lang === "en" ? "Deposit" : "充值"}</span>
              </button>
            </div>

            {/* Product Nodes List */}
            <div className="space-y-3.5">
              <h3 className="text-xs font-extrabold text-[#848E9C] uppercase px-1">{t.buyProduct}</h3>

              {[
                { 
                  level: 1, 
                  price: 100, 
                  urdBonus: 1500, 
                  capRate: 2.0, 
                  capUsd: "$200 (200%)", 
                  desc: lang === "ko" ? "1,500 URD 토큰 증정 • 수당 캡 200% 달성 시 소멸" : lang === "en" ? "Bonus 1,500 URD • Expires at 200% Payout Cap" : "赠送 1,500 URD 代币 • 200% 封顶" 
                },
                { 
                  level: 2, 
                  price: 500, 
                  urdBonus: 8000, 
                  capRate: 2.5, 
                  capUsd: "$1,250 (250%)", 
                  desc: lang === "ko" ? "8,000 URD 토큰 증정 • 수당 캡 250% 달성 시 소멸" : lang === "en" ? "Bonus 8,000 URD • Expires at 250% Payout Cap" : "赠送 8,000 URD 代币 • 250% 封顶" 
                },
                { 
                  level: 3, 
                  price: 1000, 
                  urdBonus: 17000, 
                  capRate: 3.0, 
                  capUsd: "$3,000 (300%)", 
                  desc: lang === "ko" ? "17,000 URD 토큰 증정 • 수당 캡 300% 달성 시 소멸" : lang === "en" ? "Bonus 17,000 URD • Expires at 300% Payout Cap" : "赠送 17,000 URD 代币 • 300% 封顶" 
                },
              ].map((p) => (
                <div key={p.level} className="bg-[#1E2329] border border-[#2B3139] hover:border-[#FCD535] rounded-2xl p-5 space-y-4 transition-all shadow-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-2xl font-black text-[#FCD535]">${p.price.toLocaleString()}</span>
                      <h4 className="text-sm font-bold text-[#EAECEF] mt-1">{p.level === 1 ? t.node100Name : p.level === 2 ? t.node500Name : t.node1000Name}</h4>
                    </div>
                    <span className="bg-[#0ECB81]/10 text-[#0ECB81] border border-[#0ECB81]/30 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                      {t.cap}: {p.capUsd}
                    </span>
                  </div>

                  <p className="text-xs text-[#848E9C] bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139]">
                    {p.desc}
                  </p>

                  <button 
                    onClick={() => handleRequestPurchase(p.level, p.price, p.urdBonus, p.capRate)}
                    className="w-full py-3 bg-[#FCD535] text-[#0B0E11] font-black rounded-xl text-sm hover:opacity-90 active:scale-95 transition-all shadow-[0_0_20px_rgba(252,213,53,0.2)] flex items-center justify-center space-x-1.5"
                  >
                    <ShoppingBag size={16} />
                    <span>${p.price.toLocaleString()} USDT {t.buyProduct}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ GAME ═══════════════ */}
        {activeTab === "game" && (
          <div className="p-5 space-y-5">
            {/* 2-Column Balance Card: USDT (Left) | URD (Right) */}
            <div className="grid grid-cols-2 gap-3">
              {/* USDT Balance */}
              <div className="bg-[#1E2329] rounded-xl p-4 border border-[#2B3139]">
                <p className="text-xs font-bold text-[#848E9C]">USDT {lang === "ko" ? "보유량" : lang === "en" ? "Balance" : "余额"}</p>
                <h2 className="text-xl font-extrabold text-[#EAECEF] mt-1 tracking-tight">
                  {usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-[#848E9C]">USDT</span>
                </h2>
              </div>

              {/* URD Balance */}
              <div className="bg-[#1E2329] rounded-xl p-4 border border-[#2B3139]">
                <p className="text-xs font-bold text-[#848E9C]">URD {lang === "ko" ? "보유량" : lang === "en" ? "Balance" : "余额"}</p>
                <h2 className="text-xl font-extrabold text-[#FCD535] mt-1 tracking-tight">
                  {urdBalance.toLocaleString()} <span className="text-xs font-normal text-[#EAECEF]">URD</span>
                </h2>
              </div>
            </div>

            {/* Timetable Schedule Card */}
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-extrabold text-[#EAECEF] flex items-center justify-between">
                <span>🕒 {lang === "ko" ? "일일 3회차 AI 추첨 시간표" : lang === "en" ? "Daily 3-Round Timetable" : "每日 3 轮 AI 抽奖时间表"}</span>
                <span className="text-[10px] text-[#848E9C]">{t.bet1minLimit}</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0B0E11] text-[#848E9C] text-[10px] border-b border-[#2B3139]">
                      <th className="py-2 px-1">{t.round}</th>
                      <th className="py-2 px-1">{t.betTime}</th>
                      <th className="py-2 px-1">{t.aiDraw}</th>
                      <th className="py-2 px-1">{t.drawTime}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2B3139] text-[11px]">
                    {[
                      { r: t.round1, time: "11:00 ~ 12:00", label: t.aiDraw, draw: "12:30" },
                      { r: t.round2, time: "14:00 ~ 15:00", label: t.aiDraw, draw: "15:30" },
                      { r: t.round3, time: "17:00 ~ 18:00", label: t.aiDraw, draw: "18:30" },
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#2B3139]/40 transition-colors">
                        <td className="py-2.5 font-bold text-[#FCD535]">{item.r}</td>
                        <td className="py-2.5 text-[#EAECEF] font-mono">{item.time}</td>
                        <td className="py-2.5 text-[#0ECB81] font-semibold">{item.label}</td>
                        <td className="py-2.5 font-mono text-[#FCD535] font-bold">{item.draw}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mode Tabs (Manual Betting vs Auto Betting Settings) */}
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-[#0B0E11] p-1 rounded-xl border border-[#2B3139]">
                <button 
                  onClick={() => setGameBetMode("manual")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    gameBetMode === "manual" ? "bg-[#FCD535] text-[#0B0E11]" : "text-[#848E9C] hover:text-[#EAECEF]"
                  }`}
                >
                  🎲 {lang === "ko" ? "수동 배팅 참여" : lang === "en" ? "Manual Bet" : "手动下注"}
                </button>
                <button 
                  onClick={() => setGameBetMode("auto")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    gameBetMode === "auto" ? "bg-[#FCD535] text-[#0B0E11]" : "text-[#848E9C] hover:text-[#EAECEF]"
                  }`}
                >
                  ⚡ {lang === "ko" ? "자동 배팅 세팅" : lang === "en" ? "Auto Bet Settings" : "自动下注设置"}
                </button>
              </div>

              {/* Manual Betting Tab */}
              {gameBetMode === "manual" ? (
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <label className="text-xs text-[#848E9C] font-bold">{t.selectRound}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((rNum) => (
                        <button
                          key={rNum}
                          onClick={() => setManualRound(rNum)}
                          className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                            manualRound === rNum
                              ? "bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535]"
                              : "bg-[#0B0E11] border-[#2B3139] text-[#848E9C]"
                          }`}
                        >
                          {rNum === 1 ? t.round1 : rNum === 2 ? t.round2 : t.round3}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#848E9C] font-bold">{t.selectBetCount}</span>
                      <span className="text-[#FCD535] font-bold">{t.totalCost}: {manualBetsCount * 10} URD</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 5, 10].map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => setManualBetsCount(cnt)}
                          className={`py-2 rounded-lg text-xs font-bold border ${
                            manualBetsCount === cnt
                              ? "bg-[#FCD535] text-[#0B0E11] border-[#FCD535]"
                              : "bg-[#0B0E11] border-[#2B3139] text-[#848E9C]"
                          }`}
                        >
                          {cnt}{lang === "ko" ? "회" : lang === "en" ? " Times" : "次"} ({cnt * 10} URD)
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleManualBet}
                    className="w-full py-3.5 bg-[#FCD535] text-[#0B0E11] font-black rounded-xl text-sm hover:opacity-90 active:scale-95 transition-all shadow-[0_0_20px_rgba(252,213,53,0.2)] flex items-center justify-center space-x-2"
                  >
                    <Play size={16} />
                    <span>
                      {manualRound === 1 ? t.round1 : manualRound === 2 ? t.round2 : t.round3} {t.manualBetBtn} ({manualBetsCount * 10} URD {lang === "ko" ? "소모" : lang === "en" ? "Cost" : "消耗"})
                    </span>
                  </button>
                </div>
              ) : (
                /* Auto Game Tab */
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <label className="text-xs text-[#848E9C] font-bold">{t.autoBetRounds}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((rNum) => {
                        const checked = autoSettings.rounds.includes(rNum);
                        return (
                          <button
                            key={rNum}
                            onClick={() => toggleAutoRound(rNum)}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center space-x-1 ${
                              checked
                                ? "bg-[#0ECB81]/10 border-[#0ECB81] text-[#0ECB81]"
                                : "bg-[#0B0E11] border-[#2B3139] text-[#848E9C]"
                            }`}
                          >
                            <span>{checked ? "✓" : "○"}</span>
                            <span>{rNum === 1 ? t.round1 : rNum === 2 ? t.round2 : t.round3}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto Bets Count Selection (Requirement 5) */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#848E9C] font-bold">
                        {lang === "ko" ? "회당 자동 참여 횟수 설정 (1회당 10 URD)" : lang === "en" ? "Auto Play Count (10 URD each)" : "每轮自动游戏次数 (每轮10 URD)"}
                      </span>
                      <span className="text-[#FCD535] font-bold">
                        {lang === "ko" ? "회당 소모" : lang === "en" ? "Cost / Round" : "每轮消耗"}: {autoSettings.betsCount * 10} URD
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 5, 10, 20].map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => setAutoSettings((prev) => ({ ...prev, betsCount: cnt }))}
                          className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                            autoSettings.betsCount === cnt
                              ? "bg-[#FCD535] text-[#0B0E11] border-[#FCD535]"
                              : "bg-[#0B0E11] border-[#2B3139] text-[#848E9C]"
                          }`}
                        >
                          {cnt}{lang === "ko" ? "회" : lang === "en" ? " Times" : "次"} ({cnt * 10} URD)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Daily Auto Repeat Checkbox Toggle */}
                  <div className="bg-[#0B0E11] p-3.5 rounded-xl border border-[#2B3139] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#EAECEF]">{t.dailyRepeat}</p>
                      <p className="text-[10px] text-[#848E9C] mt-0.5">{t.dailyRepeatSub}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSettings.dailyRepeat}
                        onChange={(e) => setAutoSettings({ ...autoSettings, dailyRepeat: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#2B3139] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0ECB81]"></div>
                    </label>
                  </div>

                  <button
                    onClick={handleToggleAutoSettings}
                    className={`w-full py-3.5 font-black rounded-xl text-sm transition-all flex items-center justify-center space-x-2 ${
                      autoSettings.enabled
                        ? "bg-[#0ECB81] text-[#0B0E11]"
                        : "bg-[#FCD535] text-[#0B0E11]"
                    }`}
                  >
                    <span>{autoSettings.enabled ? t.stopAutoSettings : t.saveAutoSettings}</span>
                  </button>
                </div>
              )}
            </div>

            {/* My Betting History List */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-extrabold text-[#848E9C] uppercase px-1">{t.recentBets}</h3>
              <div className="space-y-2">
                {myBets.map((b) => (
                  <div key={b.id} className="bg-[#1E2329] border border-[#2B3139] rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#FCD535]">
                          {b.round === 1 ? t.round1 : b.round === 2 ? t.round2 : t.round3} {lang === "ko" ? "참여" : lang === "en" ? "Joined" : "参与"}
                        </span>
                        <span className="text-[10px] text-[#848E9C]">({b.betAt})</span>
                      </div>
                      <p className="text-[10px] text-[#848E9C] mt-0.5">
                        {b.betsCount}{lang === "ko" ? "회 배팅" : lang === "en" ? " Bets" : "次下注"} • {b.urdSpent} URD {lang === "ko" ? "소모" : lang === "en" ? "Cost" : "消耗"}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-[#FCD535] bg-[#FCD535]/10 px-2 py-1 rounded">
                      ● {lang === "ko" ? "대기 중" : lang === "en" ? "Waiting" : "等待中"} ({b.round === 1 ? "12:30" : b.round === 2 ? "15:30" : "18:30"} {lang === "ko" ? "발표" : lang === "en" ? "Draw" : "公布"})
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ═══════════════ NETWORK ═══════════════ */}
        {activeTab === "network" && (
          <div className="p-5 flex flex-col justify-between min-h-[calc(100vh-140px)]">
            <div className="space-y-4 flex-1 flex flex-col">
              {/* Tree Type Tabs: Direct Tree vs Sponsor Tree */}
              <div className="flex bg-[#1E2329] p-1 rounded-xl">
                <button 
                  onClick={() => setNetworkTab("referral")} 
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                    networkTab === "referral" ? "bg-[#FCD535] text-[#0B0E11]" : "text-[#848E9C] hover:text-[#EAECEF]"
                  }`}
                >
                  {t.directRef}
                </button>
                <button 
                  onClick={() => setNetworkTab("sponsor")} 
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                    networkTab === "sponsor" ? "bg-[#FCD535] text-[#0B0E11]" : "text-[#848E9C] hover:text-[#EAECEF]"
                  }`}
                >
                  {t.sponsorArch}
                </button>
              </div>

              {/* Frameless Expanded Tree Canvas (No outer borders, no scrollbars visible) */}
              <div className="w-full flex-1 overflow-x-auto overflow-y-auto py-6 flex justify-center items-start [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="min-w-[440px] px-2 flex flex-col items-center space-y-6">
                  
                  {/* Root Node: Me (User) */}
                  <div className="relative flex flex-col items-center">
                    <div className="bg-[#FCD535] text-[#0B0E11] rounded-2xl px-6 py-3 shadow-[0_0_25px_rgba(252,213,53,0.35)] text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <span className="text-sm font-black">👑 User ({lang === "ko" ? "나" : lang === "en" ? "Me" : "我"})</span>
                        <StarBadge level={2} />
                      </div>
                      <p className="text-[10px] font-bold opacity-80 mt-0.5">
                        {lang === "ko" ? "본인 계정 • 활성 (V2)" : lang === "en" ? "My Account • Active (V2)" : "本人账号 • 活跃 (V2)"}
                      </p>
                    </div>
                    {/* Down Branch Line */}
                    <div className="w-0.5 h-6 bg-[#FCD535]/60" />
                  </div>

                  {/* Level 1 Horizontal Branch Bar */}
                  <div className="relative w-full flex justify-center">
                    <div className="absolute top-0 w-3/4 h-0.5 bg-[#2B3139]" />
                    
                    <div className="w-full flex justify-between pt-4">
                      {/* Left Leg: User A */}
                      <div className="flex flex-col items-center w-1/2">
                        <div className="w-0.5 h-4 bg-[#2B3139] -mt-4 mb-1" />
                        <div className="bg-[#1E2329] border border-[#0ECB81] rounded-xl p-3 text-center min-w-[135px] shadow-md">
                          <p className="text-xs font-bold text-[#EAECEF]">User A</p>
                          <div className="flex items-center justify-center space-x-1 mt-1">
                            <span className="text-[9px] font-bold text-[#0ECB81] bg-[#0ECB81]/10 px-1.5 py-0.5 rounded">● {t.active}</span>
                            <span className="text-[9px] text-[#848E9C]">$500</span>
                          </div>
                        </div>

                        {/* Level 2 Sub-Legs */}
                        <div className="w-0.5 h-5 bg-[#2B3139] my-1" />
                        <div className="flex space-x-2">
                          <div className="bg-[#0B0E11] border border-[#2B3139] rounded-lg p-2 text-center min-w-[90px]">
                            <p className="text-[10px] font-bold text-[#EAECEF]">User C</p>
                            <span className="text-[8px] text-[#0ECB81]">● {t.active} ($100)</span>
                          </div>
                          <div className="bg-[#0B0E11] border border-[#2B3139] rounded-lg p-2 text-center min-w-[90px]">
                            <p className="text-[10px] font-bold text-[#EAECEF]">User D</p>
                            <span className="text-[8px] text-[#0ECB81]">● {t.active} ($1,000)</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Leg: User B */}
                      <div className="flex flex-col items-center w-1/2">
                        <div className="w-0.5 h-4 bg-[#2B3139] -mt-4 mb-1" />
                        <div className="bg-[#1E2329] border border-[#F6465D]/60 rounded-xl p-3 text-center min-w-[135px] shadow-md">
                          <p className="text-xs font-bold text-[#EAECEF]">User B</p>
                          <div className="flex items-center justify-center space-x-1 mt-1">
                            <span className="text-[9px] font-bold text-[#F6465D] bg-[#F6465D]/10 px-1.5 py-0.5 rounded">○ {t.inactive}</span>
                            <span className="text-[9px] text-[#848E9C]">
                              {lang === "ko" ? "미구매" : lang === "en" ? "Unpurchased" : "未购设备"}
                            </span>
                          </div>
                        </div>

                        {/* Level 2 Sub-Leg */}
                        <div className="w-0.5 h-5 bg-[#2B3139] my-1" />
                        <div className="bg-[#0B0E11] border border-[#2B3139] rounded-lg p-2 text-center min-w-[100px]">
                          <p className="text-[10px] font-bold text-[#EAECEF]">User E</p>
                          <span className="text-[8px] text-[#848E9C]">○ {t.inactive}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            </div>

            {/* Clean 1-Line Pending Unpurchased Members List (Positioned at bottom above nav) */}
            {unpaidMembers.length > 0 && (
              <div className="space-y-2 pt-2 mt-auto">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-extrabold text-[#F6465D] flex items-center space-x-1.5">
                    <span>⚠️ {t.unpaidMembersTitle}</span>
                    <span className="bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {unpaidMembers.length}
                    </span>
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {unpaidMembers.map((m) => (
                    <div key={m.id} className="bg-[#1E2329] border border-[#F6465D]/30 rounded-xl px-3.5 py-2.5 flex justify-between items-center shadow-sm">
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <span className="text-xs font-bold text-[#EAECEF] flex-shrink-0">{m.nickname}</span>
                        <span className="text-[11px] font-mono text-[#848E9C] truncate">
                          {m.email} • {m.joinedAt}
                        </span>
                      </div>

                      <button 
                        onClick={() => handleDismissUnpaidMember(m.id)}
                        className="p-1 text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2B3139] rounded transition-colors flex-shrink-0 text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══════════════ SETTINGS ═══════════════ */}
        {activeTab === "settings" && (
          <div className="p-5 space-y-5">
            {/* User Profile Card */}
            <div className="bg-[#1E2329] rounded-xl p-4 flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-[#2B3139] flex justify-center items-center font-bold text-[#FCD535]">U</div>
              <div>
                <p className="font-bold text-[#EAECEF]">{userEmail}</p>
                <button onClick={handleLogout} className="text-xs text-[#F6465D] mt-1 flex items-center">
                  <LogOut size={12} className="mr-1" /> {t.logout}
                </button>
              </div>
            </div>

            {/* Language Selector Card */}
            <div className="bg-[#1E2329] rounded-xl p-4 space-y-3 border border-[#2B3139]">
              <div className="flex items-center space-x-2 text-[#FCD535]">
                <Settings size={16} />
                <h3 className="font-bold text-[#EAECEF]">{t.langSetting}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { code: "ko", label: "🇰🇷 한국어" },
                  { code: "en", label: "🇺🇸 English" },
                  { code: "zh", label: "🇨🇳 中文" },
                ].map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code as Language)}
                    className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all border ${
                      lang === l.code
                        ? "bg-[#FCD535] text-[#0B0E11] border-[#FCD535]"
                        : "bg-[#0B0E11] text-[#848E9C] border-[#2B3139] hover:text-[#EAECEF]"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Referral Link Card */}
            <div className="bg-[#1E2329] rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 text-[#FCD535]">
                <Users size={16} />
                <h3 className="font-bold text-[#EAECEF]">{t.shareRefLink}</h3>
              </div>
              <p className="text-xs text-[#848E9C]">
                {lang === "ko" ? "아래 추천 링크를 복사하여 전달하면 상대방이 가입 페이지로 바로 이동합니다." : 
                 lang === "en" ? "Copy the referral link below. Clicking it pre-fills the referral code on signup." :
                 "复制下方链接发送给好友，对方点击即可自动填入邀请码并跳转至注册页面。"}
              </p>
              
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
        <div className="flex justify-around items-center py-2 px-1">
          {[
            { id: "home", label: t.home, icon: <Home size={18} /> },
            { id: "wallet", label: t.wallet, icon: <Wallet size={18} /> },
            { id: "products", label: t.products, icon: <ShoppingBag size={18} /> },
            { id: "game", label: t.game, icon: <Gamepad2 size={18} /> },
            { id: "network", label: t.network, icon: <Users size={18} /> },
            { id: "settings", label: t.settings, icon: <Settings size={18} /> },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex flex-col items-center space-y-0.5 p-1 transition-colors ${activeTab === tab.id ? "text-[#FCD535]" : "text-[#848E9C] hover:text-[#EAECEF]"}`}>
              {tab.icon}
              <span className="text-[9px] font-bold tracking-tight">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
