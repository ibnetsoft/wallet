"use client";
// BAO369 Wallet App - Production Vercel Build Trigger
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

const MOCK_DIRECT: DirectMember[] = [];

const MOCK_SPONSOR: SponsorMember[] = [];

const STAR_COLORS = ["", "#FCD535", "#C0C0C0", "#CD7F32", "#0ECB81", "#BF5AF2", "#FF9F0A", "#F6465D"];
function StarBadge({ level }: { level: number }) {
  if (level === 0) return <span className="text-[10px] text-[#0ECB81] font-semibold">Normal</span>;
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
  <img src="/tether.png" alt="USDT" className="w-10 h-10 object-contain rounded-full flex-shrink-0" />
);

const BaoLogo = () => (
  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F5A623] to-[#F39C12] flex items-center justify-center font-black text-white text-[12px] shadow-md border border-[#F5A623]/40 flex-shrink-0">
    BAO
  </div>
);

type Language = "ko" | "en" | "zh";

const I18N = {
  ko: {
    home: "홈", wallet: "지갑", products: "게임기", game: "게임", network: "조직도", settings: "설정",
    miningStatus: "게임기 구동 현황", dailyYield: "일일 수익률", gaugeTitle: "보너스 한도 달성률 (200% ~ 300%)",
    usdtBalance: "USDT 잔액", urcBalance: "URC 잔액", urdBalance: "옥구슬 잔액",
    instantSwap: "실시간 스왑", pay: "지불", receive: "수령 (예상)", confirmSwap: "실시간 스왑 실행",
    withdrawUsdt: "USDT 출금 (BSC)", applyWithdraw: "출금 신청", depositUsdt: "USDT 입금 (BSC)",
    gameNodes: "게임기 장비 (구매 시 옥구슬 증정)", startGame: "게임 실행 (1 옥구슬 소모)",
    node100: "상운 ($100 게임기 • 옥구슬 100개)", node500: "자광 ($500 게임기 • 옥구슬 550개, 홍바오 1개)", node1000: "홍운 ($1,000 게임기 • 옥구슬 1,200개, 홍바오 3개)",
    directRef: "추천 계보", sponsorArch: "후원 계보",
    langSetting: "언어 설정 (Language)", shareRefLink: "내 추천 링크 공유", logout: "로그아웃",
    active: "활성", inactive: "미활성",
    shopTitle: "게임기 상품몰", buyProduct: "게임기 구매하기",
    myActiveNodes: "보유 게임기 현황",
    runningCount: "개 구동 중", runningStatus: "구동 중", cap: "한도", purchaseDate: "구매일", achievement: "달성율",
    node100Name: "상운 게임기", node500Name: "자광 게임기", node1000Name: "홍운 게임기",
    confirmPurchaseTitle: "게임기 상품 구매 확인", confirmPurchaseMsg: "USDT로 선택하신 게임기 상품을 구매하시겠습니까?",
    confirm: "확인 구매", cancel: "취소",
    unpaidMembersTitle: "상품 미구매 추천 회원", unpaidMembersSub: "",
    directTreeSub: "직추천 조직", sponsorTreeSub: "후원 계보 조직",
    bet1minLimit: "마감 1분 전 게임 마감", round: "회차", round1: "1회차", round2: "2회차", round3: "3회차",
    betTime: "참여 가능 시간", aiDraw: "AI 당첨 발표", drawTime: "발표 시각", selectRound: "참여 회차 선택", selectPlayCount: "참여 횟수 선택",
    selectBetCount: "게임 횟수 선택 (회당 옥구슬 1개)", totalCost: "총 소모", manualBetBtn: "게임 참여하기",
    autoBetRounds: "자동 참여 회차 (다중 선택)", dailyRepeat: "매일 반복 자동 참여",
    dailyRepeatSub: "매일 지정 시각에 자동으로 게임 참여",
    saveAutoSettings: "⚡ 자동 게임 세팅 저장 및 시작", stopAutoSettings: "✓ 자동 게임 구동 중 (클릭 시 중지)",
    recentBets: "내 최근 게임 참여 내역", waitingAnnouncement: "대기 중 (발표 예정)",
    holdings: "보유 자산", initialBalance: "최초잔고", totalProfit: "총 수익", yieldRate: "수익률",
    deposit: "입금", withdraw: "출금", swap: "스왑", history: "내역", coinsCount: "2 종목",
    txHistoryTitle: "입출금 및 보너스 내역",
  },
  en: {
    home: "Home", wallet: "Wallet", products: "Shop", game: "Game Zone", network: "Network", settings: "Settings",
    miningStatus: "Game Machine Status", dailyYield: "Daily Yield Rate", gaugeTitle: "Bonus Cap Limit Progress (200% ~ 300%)",
    usdtBalance: "USDT Balance", urcBalance: "URC Balance", urdBalance: "Jade Bead Balance",
    instantSwap: "Instant Swap", pay: "Pay", receive: "Receive (Est.)", confirmSwap: "Execute Swap",
    withdrawUsdt: "Withdraw USDT (BSC)", applyWithdraw: "Request Withdrawal", depositUsdt: "Deposit USDT (BSC)",
    gameNodes: "Game Equipment (Bonus Jade Beads on Purchase)", startGame: "Start Game (Cost 1 Jade Bead)",
    node100: "Shangyun ($100 Machine • 100 Beads)", node500: "Ziguang ($500 Machine • 550 Beads, 1 Hongbao)", node1000: "Hongyun ($1,000 Machine • 1,200 Beads, 3 Hongbao)",
    directRef: "Direct Referral Tree", sponsorArch: "Sponsor Tree",
    langSetting: "Language Settings", shareRefLink: "Share Referral Link", logout: "Log Out",
    active: "Active", inactive: "Inactive",
    shopTitle: "Game Machine Shop", buyProduct: "Buy Game Machine",
    myActiveNodes: "My Active Game Machines",
    runningCount: "Machines Running", runningStatus: "Running", cap: "Cap", purchaseDate: "Purchased", achievement: "Progress",
    node100Name: "Shangyun Machine", node500Name: "Ziguang Machine", node1000Name: "Hongyun Machine",
    confirmPurchaseTitle: "Confirm Game Machine Purchase", confirmPurchaseMsg: "Do you want to purchase the selected game machine with USDT?",
    confirm: "Confirm Purchase", cancel: "Cancel",
    unpaidMembersTitle: "Unpurchased Referral Members", unpaidMembersSub: "",
    directTreeSub: "Direct Referral Tree", sponsorTreeSub: "Sponsor Tree",
    bet1minLimit: "Game closes 1 min before deadline", round: "Round", round1: "Round 1", round2: "Round 2", round3: "Round 3",
    betTime: "Playable Time", aiDraw: "AI Draw Announcement", drawTime: "Draw Time", selectRound: "Select Round", selectPlayCount: "Select Play Count",
    selectBetCount: "Select Game Play Count (1 Jade Bead each)", totalCost: "Total Cost", manualBetBtn: "Join Game",
    autoBetRounds: "Auto Rounds (Multi-select)", dailyRepeat: "Daily Auto Repeat",
    dailyRepeatSub: "Automatically play game at scheduled times daily",
    saveAutoSettings: "⚡ Save & Start Auto Game", stopAutoSettings: "✓ Auto Game Running (Click to stop)",
    recentBets: "My Recent Game Records", waitingAnnouncement: "Waiting for Draw",
    holdings: "Holdings", initialBalance: "Initial Balance", totalProfit: "Total Profit", yieldRate: "Yield Rate",
    deposit: "Deposit", withdraw: "Withdraw", swap: "Swap", history: "History", coinsCount: "2 Assets",
    txHistoryTitle: "Transactions & Bonus History",
  },
  zh: {
    home: "首页", wallet: "钱包", products: "商城", game: "竞技场", network: "团队", settings: "设置",
    miningStatus: "游戏设备运行状态", dailyYield: "日收益率", gaugeTitle: "奖金封顶额度进度 (200% ~ 300%)",
    usdtBalance: "USDT 余额", urcBalance: "URC 余额", urdBalance: "玉珠余额",
    instantSwap: "闪兑", pay: "支付", receive: "获得 (预计)", confirmSwap: "确认兑换",
    withdrawUsdt: "提现 USDT (BSC)", applyWithdraw: "申请提现", depositUsdt: "充值 USDT (BSC)",
    gameNodes: "游戏设备 (购买赠送玉珠)", startGame: "启动游戏 (消耗 1 个玉珠)",
    node100: "祥云 ($100 游戏机 • 100 玉珠)", node500: "紫光 ($500 游戏机 • 550 玉珠, 1 红包)", node1000: "鸿运 ($1,000 游戏机 • 1,200 玉珠, 3 红包)",
    directRef: "直推谱系", sponsorArch: "安置架构",
    langSetting: "语言设置 (Language)", shareRefLink: "分享推荐链接", logout: "退出登录",
    active: "活跃", inactive: "未激活",
    shopTitle: "游戏机商城", buyProduct: "购买游戏机",
    myActiveNodes: "我的运行游戏机",
    runningCount: "台运行中", runningStatus: "运行中", cap: "额度", purchaseDate: "购买日", achievement: "达成率",
    node100Name: "祥云游戏机", node500Name: "紫光游戏机", node1000Name: "鸿运游戏机",
    confirmPurchaseTitle: "确认购买游戏机", confirmPurchaseMsg: "确定使用 USDT 购买所选游戏机吗？",
    confirm: "确认购买", cancel: "取消",
    unpaidMembersTitle: "未购设备推荐会员", unpaidMembersSub: "",
    directTreeSub: "直推谱系团队", sponsorTreeSub: "安置架构团队",
    bet1minLimit: "截止前1分钟停止游戏", round: "轮次", round1: "第1轮", round2: "第2轮", round3: "第3轮",
    betTime: "可游戏时间", aiDraw: "AI 抽奖公布", drawTime: "公布时间", selectRound: "选择游戏轮次",
    selectBetCount: "选择游戏次数 (每轮 1 个玉珠)", totalCost: "总消耗", manualBetBtn: "参与游戏",
    autoBetRounds: "自动参与轮次 (多选)", dailyRepeat: "每日重复自动游戏",
    dailyRepeatSub: "每日在指定时间自动参与游戏",
    saveAutoSettings: "⚡ 保存并启动自动游戏设置", stopAutoSettings: "✓ 自动游戏运行中 (点击停止)",
    recentBets: "我的近期游戏记录", waitingAnnouncement: "等待公布",
    holdings: "持有资产", initialBalance: "初始余额", totalProfit: "总收益", yieldRate: "收益率",
    deposit: "充值", withdraw: "提现", swap: "闪兑", history: "记录", coinsCount: "2 种资产",
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
  const [lang, setLang] = useState<Language>("zh");
  const t = I18N[lang];

  useEffect(() => {
    const saved = localStorage.getItem("urc_lang");
    if (saved === "zh" || saved === "en" || saved === "ko") {
      setLang(saved as Language);
    }
  }, []);

  const changeLang = (l: Language) => {
    setLang(l);
    localStorage.setItem("urc_lang", l);
  };

  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [networkTab, setNetworkTab] = useState<NetworkTabType>("referral");
  const [referralCopied, setReferralCopied] = useState(false);

  // Pending Unpurchased Members List
  const [unpaidMembers, setUnpaidMembers] = useState<UnpaidMember[]>([]);

  const handleDismissUnpaidMember = (id: string) => {
    setUnpaidMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // Notifications Modal & List State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  // Scheduled Game Engine States
  const [gameBetMode, setGameBetMode] = useState<"manual" | "auto">("manual");
  const [manualRound, setManualRound] = useState<number>(1);
  const [dbRounds, setDbRounds] = useState<any[]>([]);
  
  // Organization tree zoom/pinch states
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const touchStartDist = React.useRef<number | null>(null);
  const startScale = React.useRef<number>(1.0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      startScale.current = zoomScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDist.current;
      const newScale = Math.min(Math.max(startScale.current * factor, 0.5), 1.5);
      setZoomScale(Number(newScale.toFixed(2)));
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };
  const [manualBetsCount, setManualBetsCount] = useState<number>(1);
  const [myBets, setMyBets] = useState<GameBetRecord[]>([]);

  // Auto Betting Settings State
  const [autoSettings, setAutoSettings] = useState({
    enabled: false,
    dailyRepeat: true,
    rounds: [1, 2, 3],
    betsCount: 10, // Default 10 times = 10 Jade Beads
  });

  const [historyPage, setHistoryPage] = useState(1);
  const [walletHistoryTab, setWalletHistoryTab] = useState<"tx" | "bonus" | "swap">("tx");
  const [bonusHistoryPage, setBonusHistoryPage] = useState(1);
  const [showGameConfirmModal, setShowGameConfirmModal] = useState(false);
  const [gameStatusTab, setGameStatusTab] = useState<"active" | "waiting" | "ended">("active");
  const [purchaseSuccessEffect, setPurchaseSuccessEffect] = useState<{ show: boolean, level: number, name: string, urdBonus: number } | null>(null);

  // 1단계: 컨펌 팝업 열기
  const handleManualBet = () => {
    const cost = manualBetsCount * 1;
    if (urdBalance < cost) {
      setShowGameConfirmModal(false);
      const notif: GameNotification = {
        id: `n-${Date.now()}`,
        round: `${manualRound}회차`,
        time: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        title: "⚠️ 옥구슬 부족 — 게임 참여 불가",
        resultType: "COIN_WIN",
        rewardText: `보유 옥구슬(${urdBalance}개)이 부족합니다. 필요: ${cost}개`,
        createdAt: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);
      return;
    }
    setShowGameConfirmModal(true);
  };

  // 2단계: 컨펌 후 실제 참여 실행
  const confirmManualBet = async () => {
    const cost = manualBetsCount * 1;
    if (!userId) {
      alert(lang === "ko" ? "로그인 상태를 확인할 수 없습니다." : "User session not found.");
      return;
    }

    const roundObj = dbRounds.find(r => r.round_number === manualRound);
    if (!roundObj) {
      alert(lang === "ko" ? "유효하지 않은 회차입니다." : "Invalid round.");
      return;
    }

    setShowGameConfirmModal(false);

    try {
      const res = await fetch("/api/game-rounds/participate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, round_id: roundObj.id, tickets_count: manualBetsCount })
      });
      const data = await res.json();
      
      if (!data.success) {
        alert((lang === "ko" ? "참여 실패: " : "Error: ") + data.error);
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
      
      // 벨 알림으로 참여 완료 통보
      const notif: GameNotification = {
        id: `n-${Date.now()}`,
        round: `${manualRound}회차`,
        time: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        title: `🎮 ${manualRound}회차 게임 참여 완료`,
        resultType: "COIN_WIN",
        rewardText: `${manualBetsCount}회 참여 · 옥구슬 ${cost}개 소모 · AI 발표 대기 중`,
        createdAt: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
        read: false,
      };
      setNotifications((prev) => [notif, ...prev]);
    } catch (err) {
      console.error(err);
      alert(lang === "ko" ? "서버 통신 오류가 발생했습니다." : "Network error.");
    }
  };

  const handleToggleAutoSettings = () => {
    const autoCost = autoSettings.betsCount * 1;
    if (!autoSettings.enabled) {
      if (urdBalance < autoCost) {
        alert(`⚡ 옥구슬이 부족하여 자동 게임을 시작할 수 없습니다! (필요: ${autoCost}개, 보유: ${urdBalance}개)`);
        // Add Bead Depletion Notification to Bell
        const notif: GameNotification = {
          id: `n-${Date.now()}`,
          round: "자동 게임",
          time: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
          title: "⚠️ 옥구슬 소진으로 자동 게임 중단",
          resultType: "COIN_WIN",
          rewardText: `옥구슬이 소진되어 자동 게임 참여가 중단되었습니다. (필요: ${autoCost}개)`,
          createdAt: new Date().toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit" }),
          read: false,
        };
        setNotifications((prev) => [notif, ...prev]);
        return;
      }

      setAutoSettings((prev) => ({ ...prev, enabled: true }));
      setUrdBalance((prev) => prev - autoCost);
      alert(`⚡ 자동 게임 세팅이 활성화되었습니다!\n회당 ${autoSettings.betsCount}회 (옥구슬 ${autoCost}개 소모)로 매일 지정 회차에 자동으로 실행됩니다.`);
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
  const [myMachines, setMyMachines] = useState<ActiveMachine[]>([]);

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

    // 구매 성공 이펙트 실행 (기존 alert 대체)
    setPurchaseSuccessEffect({ show: true, level, name: nodeName, urdBonus });
    
    // 3.5초 후 자동 닫기
    setTimeout(() => {
      setPurchaseSuccessEffect(null);
    }, 3500);
  };
  const [directTree] = useState<any[]>([]);
  const [sponsorTree] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState("user@bao369.com");
  const [userNickname, setUserNickname] = useState("User");
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editNicknameValue, setEditNicknameValue] = useState("");
  const [nicknameUpdateLoading, setNicknameUpdateLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [countdown, setCountdown] = useState("");
  const [urdBalance, setUrdBalance] = useState(0);
  const [hongbaoCount, setHongbaoCount] = useState(0);
  const [baoBalance, setBaoBalance] = useState(0);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [urcBalance, setUrcBalance] = useState(0);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isUsdtToUrc, setIsUsdtToUrc] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawToken, setWithdrawToken] = useState<"USDT" | "URC">("USDT");
  const [depositToken, setDepositToken] = useState<"USDT" | "URC">("USDT");
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  
  const [userDepositAddress, setUserDepositAddress] = useState("");
  const [addressCopied, setAddressCopied] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

  const openDepositModal = async () => {
    setShowDepositModal(true);
    if (!userDepositAddress && userId) {
      setWalletLoading(true);
      try {
        const res = await fetch("/api/wallet/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });
        const data = await res.json();
        if (res.ok && data.address) {
          setUserDepositAddress(data.address);
        } else {
          console.error("Wallet generation failed:", data.error);
        }
      } catch (err) {
        console.error("Wallet generation error:", err);
      } finally {
        setWalletLoading(false);
      }
    }
  };

  const copyDepositAddress = () => {
    navigator.clipboard.writeText(userDepositAddress);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [txHistory, setTxHistory] = useState<any[]>([]);
  const [txHistoryLoading, setTxHistoryLoading] = useState(false);

  const loadTxHistory = async () => {
    if (!userId) return;
    setTxHistoryLoading(true);
    try {
      const res = await fetch(`/api/user/history?userId=${userId}`);
      const data = await res.json();
      if (data.success) setTxHistory(data.entries || []);
    } catch (e) { console.error(e); }
    setTxHistoryLoading(false);
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


  const handleUpdateNickname = async () => {
    if (!editNicknameValue.trim()) return;
    setNicknameUpdateLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { nickname: editNicknameValue }
      });
      if (error) throw error;
      setUserNickname(editNicknameValue);
      setIsEditingNickname(false);
    } catch (e: any) {
      alert("Failed to update nickname: " + e.message);
    } finally {
      setNicknameUpdateLoading(false);
    }
  };

  const handlePlayGame = (betAmount: number = 100) => {
    if (usdtBalance < 100) {
      alert(lang === "ko" ? "USDT 잔액이 부족합니다! (필요: 100 USDT)" : lang === "en" ? "Insufficient USDT! (Required: 100 USDT)" : "USDT 余额不足！(需要 100 USDT)");
      return;
    }
    if (urdBalance < 1) {
      alert(lang === "ko" ? "옥구슬이 부족합니다! (필요: 1개)" : lang === "en" ? "Insufficient Jade Beads! (Required: 1)" : "玉珠不足！(需要 1 个)");
      return;
    }

    setIsPlayingGame(true);
    setUsdtBalance((prev) => prev - 100);
    setUrdBalance((prev) => prev - 1);

    setTimeout(() => {
      // 90% chance for USDT_WIN (금전당첨: 102 USDT), 10% chance for COIN_WIN (옥보당첨: 80 USDT + 40 Jade Beads)
      const isUsdtWin = Math.random() < 0.9;

      if (isUsdtWin) {
        const rewardUsdt = 102; // 102% payout
        setUsdtBalance((prev) => prev + rewardUsdt);
        setGameResultModal({
          show: true,
          type: "USDT_WIN",
          usdtAmount: rewardUsdt,
        });
      } else {
        const rewardUsdt = 80;
        const rewardBeads = 40;
        setUsdtBalance((prev) => prev + rewardUsdt);
        setUrdBalance((prev) => prev + rewardBeads);
        setGameResultModal({
          show: true,
          type: "COIN_WIN",
          usdtAmount: rewardUsdt,
          urdAmount: rewardBeads,
        });
      }
      setIsPlayingGame(false);
    }, 1200);
  };

  const [balancesLoading, setBalancesLoading] = useState(false);

  const loadBalances = async (uid: string) => {
    if (!uid) return;
    setBalancesLoading(true);
    try {
      const res = await fetch(`/api/user/balance?userId=${uid}`);
      const data = await res.json();
      if (data.success && data.balances) {
        setUsdtBalance(data.balances.USDT ?? 0);
        setUrcBalance(data.balances.URC ?? 0);
        setBaoBalance(data.balances.URC ?? 0); // DB의 URC 잔고를 UI의 BAO 잔고에 매핑
        setUrdBalance(data.balances.JADE ?? 0);
      }
    } catch (e) {
      console.error("Failed to load balances:", e);
    } finally {
      setBalancesLoading(false);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserEmail(session.user.email || "Unknown");
        setUserId(session.user.id);
        if (session.user.user_metadata?.nickname) {
          setUserNickname(session.user.user_metadata.nickname);
        }
        loadBalances(session.user.id);
      }
    };
    const fetchGameRounds = async () => {
      try {
        const res = await fetch("/api/game-rounds");
        const data = await res.json();
        if (data.success && data.rounds) {
          setDbRounds(data.rounds);
          if (data.rounds.length > 0) {
            setManualRound(data.rounds[0].round_number);
            setAutoSettings(prev => ({ ...prev, rounds: data.rounds.map((r: any) => r.round_number) }));
          }
        }
      } catch (e) {
        console.error("Failed to load game rounds", e);
      }
    };
    fetchUser();
    fetchGameRounds();
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
    const refCode = userId ? `BAO-${userId.substring(0, 8).toUpperCase()}` : "BAO369";
    navigator.clipboard.writeText(`${origin}/register?ref=${refCode}`);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const parsedWithdraw = parseFloat(withdrawAmount) || 0;
  const withdrawFee = parsedWithdraw * 0.03;
  const withdrawFinal = parsedWithdraw * 0.97;
  const totalAssetValuation = usdtBalance;

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
        <div className="flex items-center h-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="URC369" className="h-5 w-auto object-contain mix-blend-lighten" />
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

      {/* ── LOGO BANNER ── */}
      {activeTab === "home" && (
        <div className="w-full bg-[#0B0E11] flex items-center justify-center py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="U彩宝369"
            className="w-[85%] h-auto object-contain"
            style={{ mixBlendMode: "lighten" }}
          />
        </div>
      )}


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
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-[#1E2329] flex items-center justify-center font-black text-[#FCD535]">
                    {userNickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0ECB81] rounded-full border-2 border-[#0B0E11] flex items-center justify-center">
                    <Check size={8} className="text-[#0B0E11]" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-extrabold text-[#EAECEF] truncate max-w-[120px]">{userNickname}</h1>
                  <StarBadge level={0} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#848E9C]">邀请码</p>
                <button onClick={copyReferral} className="flex items-center space-x-1 bg-[#1E2329] px-2.5 py-1.5 rounded mt-0.5">
                  <span className="text-[10px] text-[#FCD535] font-mono font-bold">{userId ? `BAO-${userId.substring(0, 8).toUpperCase()}` : "BAO369"}</span>
                  {referralCopied ? <Check size={10} className="text-[#0ECB81]" /> : <Copy size={10} className="text-[#848E9C]" />}
                </button>
              </div>
            </div>

            {/* Balance Card */}
            <div className="rounded-xl p-5 bg-[#1E2329] border border-[#2B3139]">
              <div className="flex justify-between items-center">
                <p className="text-xs text-[#848E9C] font-medium">
                  {lang === "ko" ? "총 자산 평가액" : lang === "en" ? "Total Valuation" : "总资产估值"}
                </p>
                <button
                  onClick={() => userId && loadBalances(userId)}
                  disabled={balancesLoading}
                  className="p-1 hover:bg-[#2B3139] rounded transition-all text-[#848E9C] hover:text-[#EAECEF] cursor-pointer disabled:opacity-50"
                  title="새로고침"
                >
                  <RefreshCw size={12} className={balancesLoading ? "animate-spin text-[#FCD535]" : ""} />
                </button>
              </div>
              <h2 className="text-3xl font-black text-[#EAECEF] mt-1 tracking-tight font-mono">
                ${totalAssetValuation.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              <div className="flex items-center space-x-1.5 text-[#0ECB81] text-xs font-bold mt-1.5">
                <TrendingUp size={12} />
                <span>0.00% (24h)</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-[#2B3139]">
                <div>
                  <p className="text-[10px] text-[#848E9C]">USDT</p>
                  <p className="text-sm font-bold font-mono text-[#EAECEF] mt-0.5">
                    {usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#848E9C]">{lang === "ko" ? "옥구슬" : lang === "en" ? "Jade Beads" : "玉珠"}</p>
                  <p className="text-sm font-bold font-mono text-[#FCD535] mt-0.5">
                    {urdBalance.toLocaleString()} {lang === "ko" ? "개" : lang === "en" ? "Bead(s)" : "个"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#848E9C]">{lang === "ko" ? "홍바오" : lang === "en" ? "Hongbao" : "红包"}</p>
                  <p className="text-sm font-bold font-mono text-[#F6465D] mt-0.5">
                    {hongbaoCount.toLocaleString()} {lang === "ko" ? "개" : lang === "en" ? "Env(s)" : "个"}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Menu 3x2 Grid */}
            {(() => {
              const menuItems = [
                {
                  label: lang === "ko" ? "마이페이지" : lang === "en" ? "My Page" : "我的页面",
                  icon: "👤",
                  tab: "home" as TabType,
                },
                {
                  label: lang === "ko" ? "게임기구매" : lang === "en" ? "Buy Machine" : "购买游戏机",
                  icon: "🛒",
                  tab: "products" as TabType,
                },
                {
                  label: lang === "ko" ? "게임참여" : lang === "en" ? "Play Game" : "参与游戏",
                  icon: "🎮",
                  tab: "game" as TabType,
                },
                {
                  label: lang === "ko" ? "지갑" : lang === "en" ? "Wallet" : "钱包",
                  icon: "💰",
                  tab: "wallet" as TabType,
                },
                {
                  label: lang === "ko" ? "보너스내역" : lang === "en" ? "Bonus History" : "奖金记录",
                  icon: "🎁",
                  tab: "wallet" as TabType,
                  action: () => { setWalletHistoryTab("bonus"); setShowHistoryModal(true); loadTxHistory(); }
                },
                {
                  label: lang === "ko" ? "조직도" : lang === "en" ? "Network" : "组织图",
                  icon: "🌐",
                  tab: "network" as TabType,
                },
              ];
              return (
                <div className="grid grid-cols-3 gap-2.5">
                  {menuItems.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => item.action ? item.action() : setActiveTab(item.tab)}
                      style={{
                        background: "linear-gradient(135deg, #FCD535 0%, #F0B90B 100%)",
                        boxShadow: "0 2px 8px rgba(252,213,53,0.35)",
                      }}
                      className="flex items-center justify-center rounded-2xl py-4 px-2 transition-all duration-200 active:scale-95 hover:brightness-110"
                    >
                      <span className="text-[#0B0E11] font-black text-xs leading-tight text-center">{item.label}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

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
                        <div key={m.id} className="bg-[#1E2329] border border-[#2B3139] hover:border-[#FCD535]/50 rounded-xl p-3.5 flex items-center space-x-3 transition-all relative overflow-hidden">
                          {/* Mini Chinese Character Badge - Premium Image */}
                          <div className={`w-12 h-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border-2 ${
                            m.level === 1 ? "bg-[#0B0E11]/80 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5),inset_0_0_10px_rgba(34,211,238,0.2)]" :
                            m.level === 2 ? "bg-[#0B0E11]/80 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5),inset_0_0_10px_rgba(217,70,239,0.2)]" :
                            "bg-[#0B0E11]/80 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5),inset_0_0_10px_rgba(239,68,68,0.2)]"
                          }`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={m.level === 1 ? "/badges/xiangyun.jpg" : m.level === 2 ? "/badges/ziguang.jpg" : "/badges/hongyun.jpg"} 
                              alt={m.level === 1 ? "祥云" : m.level === 2 ? "紫光" : "鸿运"} 
                              className="w-full h-full object-cover mix-blend-lighten" 
                            />
                          </div>

                          {/* Right Content */}
                          <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-black text-[#FCD535] bg-[#FCD535]/10 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                                  {m.level === 1 ? t.node100Name : m.level === 2 ? t.node500Name : t.node1000Name}
                                </span>
                                <span className="text-[10px] text-[#0ECB81] font-bold shrink-0">● {t.runningStatus}</span>
                              </div>
                              <span className="text-[10px] font-mono text-[#848E9C] shrink-0">
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



            {/* Today's Bonus */}
            <div className="bg-[#1E2329] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap size={14} className="text-[#FCD535]" />
                  <span className="text-xs font-bold text-[#EAECEF]">{lang === "ko" ? "오늘의 보너스" : lang === "en" ? "Today's Bonus" : "今日奖金"}</span>
                </div>
                <button 
                  onClick={() => { setWalletHistoryTab("bonus"); setShowHistoryModal(true); loadTxHistory(); }}
                  className="text-[10px] text-[#848E9C] hover:text-[#EAECEF] font-bold bg-[#2B3139] hover:bg-[#3A424D] px-2 py-1 rounded transition-colors"
                >
                  {lang === "ko" ? "내역" : lang === "en" ? "History" : "记录"}
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { label: lang === "ko" ? "직추천 보너스" : lang === "en" ? "Direct Bonus" : "直推奖", value: "$0.00" },
                  { label: lang === "ko" ? "육성 보너스" : lang === "en" ? "Mentoring Bonus" : "育人奖", value: "$0.00" },
                  { label: lang === "ko" ? "엄마 보너스" : lang === "en" ? "Mother Bonus" : "母体奖", value: "$0.00" },
                  { label: lang === "ko" ? "직급 보너스" : lang === "en" ? "Rank Bonus" : "平级奖", value: "$0.00" },
                ].map((b) => (
                  <div key={b.label} className="flex justify-between text-xs">
                    <span className="text-[#848E9C]">{b.label}</span>
                    <span className="font-bold text-[#0ECB81]">{b.value}</span>
                  </div>
                ))}
                <div className="border-t border-[#2B3139] pt-2 flex justify-between text-xs font-bold">
                  <span>{lang === "ko" ? "오늘 총 보너스" : lang === "en" ? "Today's Total" : "今日总计"}</span>
                  <span className="text-[#FCD535]">$0.00</span>
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
                  <p className="text-xs font-bold text-[#EAECEF] mt-1">$0.00</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#848E9C]">{t.totalProfit}</p>
                  <p className="text-xs font-bold text-[#0ECB81] mt-1">$0.00</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#848E9C]">{t.yieldRate}</p>
                  <p className="text-xs font-bold text-[#0ECB81] mt-1">0.00%</p>
                </div>
              </div>

              {/* 3 Action Buttons: Deposit, Withdraw, History */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => openDepositModal()}
                  className="bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#FCD535] py-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all group"
                >
                  <ArrowDownLeft size={24} strokeWidth={2.5} className="text-[#0ECB81] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#EAECEF]">{t.deposit}</span>
                </button>

                <button
                  onClick={() => setShowWithdrawModal(true)}
                  className="bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#FCD535] py-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all group"
                >
                  <ArrowUpRight size={24} strokeWidth={2.5} className="text-[#F6465D] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-[#EAECEF]">{t.withdraw}</span>
                </button>

                <button
                  onClick={() => { setShowHistoryModal(true); loadTxHistory(); }}
                  className="bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] hover:border-[#FCD535] py-3 rounded-xl flex flex-col items-center justify-center space-y-2 transition-all group"
                >
                  <FileText size={24} strokeWidth={2.5} className="text-[#848E9C] group-hover:scale-110 transition-transform" />
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

                {/* Token 2: BAO Token */}
                <div className="bg-[#1E2329] border border-[#2B3139] hover:border-[#F5A623]/60 rounded-2xl p-4 flex justify-between items-center transition-all">
                  <div className="flex items-center space-x-3">
                    <BaoLogo />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-extrabold text-[#EAECEF]">BAO</span>
                        <span className="text-[9px] font-extrabold text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/30 px-1.5 py-0.5 rounded">
                          TOKEN
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#848E9C] mt-0.5">
                        {baoBalance.toLocaleString()} {lang === "ko" ? "개" : lang === "en" ? "Token(s)" : "个"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold font-mono text-[#EAECEF]">-</p>
                    <p className="text-[10px] font-bold text-[#848E9C] mt-0.5">PLAY ITEM</p>
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
                  USDT {lang === "ko" ? "입금 (BSC)" : lang === "en" ? "Deposit (BSC)" : "充值 (BSC)"}
                </h3>
              </div>

              {/* USDT only — URC deposit removed */}
              <div className="bg-[#0B0E11] py-2 px-4 rounded-xl border border-[#26A17B]/40 text-center">
                <span className="text-xs font-bold text-[#26A17B]">USDT (Tether) · BSC BEP-20</span>
              </div>

              {/* Dynamic QR Code Image */}
              <div className="w-40 h-40 bg-white rounded-xl mx-auto p-2.5 flex items-center justify-center shadow-lg">
                {walletLoading ? (
                  <div className="flex flex-col items-center space-y-2">
                    <RefreshCw size={24} className="text-[#848E9C] animate-spin" />
                    <span className="text-[10px] text-[#848E9C] font-bold">{lang === "ko" ? "지갑 생성 중..." : lang === "en" ? "Generating..." : "生成中..."}</span>
                  </div>
                ) : userDepositAddress ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${userDepositAddress}`}
                    alt={`${depositToken} BSC Deposit QR Code`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-[#848E9C] font-bold text-center">{lang === "ko" ? "지갑 생성 실패.\n다시 시도하세요." : "Failed. Try again."}</span>
                )}
              </div>

              {/* Deposit Address Display */}
              <div className="space-y-2">

                <div className="bg-[#0B0E11] p-3 rounded-lg border border-[#2B3139] flex justify-between items-center space-x-2">
                  <span className="text-[10px] font-mono text-[#EAECEF] break-all select-all">
                    {walletLoading ? (lang === "ko" ? "지갑 주소 생성 중..." : "Generating address...") : userDepositAddress || (lang === "ko" ? "주소 없음" : "No address")}
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
                  USDT {lang === "ko" ? "출금 (BSC)" : lang === "en" ? "Withdrawal (BSC)" : "提现 (BSC)"}
                </h3>
              </div>

              <div className="space-y-3">
                {/* Select Coin to Withdraw (USDT only, URC/URD excluded) */}
                <div>
                  <label className="text-xs text-[#848E9C] font-bold">
                    {lang === "ko" ? "출금 자산" : lang === "en" ? "Withdrawal Asset" : "提现资产"}
                  </label>
                  <div className="w-full mt-1 bg-[#0B0E11] border border-[#2B3139] rounded-xl px-3 py-2.5 text-xs text-[#FCD535] font-bold">
                    USDT (Tether) - BSC BEP20
                  </div>
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
                      placeholder={
                        lang === "ko" 
                          ? "0x로 시작하는 BSC 지갑 주소 입력" 
                          : lang === "en" 
                          ? "Enter BSC address starting with 0x" 
                          : "请输入以 0x 开头的 BSC 钱包地址"
                      }
                      className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-xl px-3 py-2.5 text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] font-mono"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setWithdrawAddress(text);
                        } catch (e) {
                          alert(lang === "ko" ? "클립보드 주소를 읽어올 수 없습니다." : "Unable to read clipboard address.");
                        }
                      }}
                      className="p-2.5 bg-[#2B3139] hover:bg-[#FCD535] hover:text-[#0B0E11] text-[#FCD535] rounded-xl border border-[#2B3139] transition-all flex items-center justify-center flex-shrink-0"
                      title={lang === "ko" ? "클립보드 주소 붙여넣기" : lang === "en" ? "Paste address" : "粘贴地址"}
                    >
                      <ClipboardPaste size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-[#848E9C] font-bold">
                      {lang === "ko" ? "출금 금액 (USDT)" : "Amount (USDT)"}
                    </label>
                    <span className="text-[#848E9C] text-[10px]">
                      {lang === "ko" ? "보유" : "Bal"}: {usdtBalance.toFixed(2)} USDT
                    </span>
                  </div>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={
                      lang === "ko" 
                        ? "최소 30 USDT" 
                        : lang === "en" 
                        ? "Min 30 USDT" 
                        : "最少 30 USDT"
                    }
                    className="w-full mt-1 bg-[#0B0E11] border border-[#2B3139] rounded-xl px-3 py-2.5 text-xs text-[#EAECEF] focus:outline-none focus:border-[#FCD535] font-mono"
                  />
                </div>

                <div className="bg-[#0B0E11] rounded-xl p-3 border border-[#2B3139] space-y-1 text-xs">
                  <div className="flex justify-between text-[#848E9C]">
                    <span>{lang === "ko" ? "출금 수수료 (3%)" : lang === "en" ? "Fee (3%)" : "手续费 (3%)"}</span>
                    <span>{withdrawFee.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#EAECEF] pt-1 border-t border-[#2B3139]">
                    <span>{lang === "ko" ? "실제 수령 금액" : lang === "en" ? "You Receive" : "实际到账"}</span>
                    <span className="text-[#0ECB81]">{withdrawFinal.toFixed(2)} USDT</span>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const amountVal = Number(withdrawAmount);
                    if (!withdrawAmount || amountVal < 30) {
                      alert(lang === "ko" ? "최소 출금 금액은 30 USDT입니다." : "Minimum withdrawal amount is 30 USDT.");
                      return;
                    }
                    if (amountVal > usdtBalance) {
                      alert(lang === "ko" ? "USDT 잔액이 부족합니다." : "Insufficient USDT balance.");
                      return;
                    }
                    if (!withdrawAddress.trim()) {
                      alert(lang === "ko" ? "BSC 출금 지갑 주소를 입력해주세요." : "Please enter BSC withdrawal address.");
                      return;
                    }

                    try {
                      const res = await fetch("/api/withdraw", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userId,
                          amount: amountVal,
                          address: withdrawAddress.trim()
                        })
                      });
                      const data = await res.json();
                      if (!data.success) {
                        throw new Error(data.error || "출금 신청 중 오류가 발생했습니다.");
                      }

                      // Update local balance and close modal
                      setUsdtBalance((prev) => prev - amountVal);
                      setWithdrawAmount("");
                      setWithdrawAddress("");
                      setShowWithdrawModal(false);
                      alert(`✅ ${amountVal} USDT ${lang === "ko" ? "출금 신청이 성공적으로 접수되었습니다. (네트워크 승인 후 지급)" : "withdrawal request submitted successfully."}`);
                    } catch (e: any) {
                      alert(lang === "ko" ? `❌ 출금 신청 실패: ${e.message}` : `❌ Withdrawal failed: ${e.message}`);
                    }
                  }}
                  className="w-full py-3 bg-[#FCD535] text-[#0B0E11] font-black rounded-xl text-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  {t.applyWithdraw}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* History Modal Popup */}
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center sm:items-center p-0 sm:p-4">
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl relative flex flex-col" style={{ maxHeight: "90vh" }}>
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#2B3139] flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <FileText size={16} className="text-[#FCD535]" />
                  <h3 className="text-sm font-extrabold text-[#EAECEF]">
                    {lang === "ko" ? "내역 조회" : lang === "en" ? "History" : "历史记录"}
                  </h3>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-[#848E9C] hover:text-[#EAECEF] p-1.5 hover:bg-[#2B3139] rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* 3 Sub-tabs */}
              <div className="flex px-5 pt-3 gap-1 flex-shrink-0">
                {([
                  { id: "tx" as const,    label: lang === "ko" ? "입출금" : lang === "en" ? "Transactions" : "充提" },
                  { id: "bonus" as const, label: lang === "ko" ? "보너스 내역" : lang === "en" ? "Bonus History" : "奖金记录" },
                  { id: "swap" as const,  label: lang === "ko" ? "스왑" : lang === "en" ? "Swap" : "兑换" },
                ] as { id: "tx" | "bonus" | "swap"; label: string }[]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setWalletHistoryTab(tab.id); setBonusHistoryPage(1); setHistoryPage(1); }}
                    className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${
                      walletHistoryTab === tab.id
                        ? "bg-[#FCD535] text-[#0B0E11]"
                        : "bg-[#0B0E11] text-[#848E9C] hover:text-[#EAECEF] border border-[#2B3139]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="overflow-y-auto flex-1 px-5 pb-5 pt-3" style={{ scrollbarWidth: "none" }}>

                {/* ── 입출금 탭 ── */}
                {walletHistoryTab === "tx" && (() => {
                  const getTxLabel = (txType: string, status: string) => {
                    if (txType === "WITHDRAW") {
                      if (status === "PENDING") return lang === "ko" ? "⏳ 출금준비중" : lang === "en" ? "⏳ Pending Withdrawal" : "⏳ 提现准备中";
                      if (status === "COMPLETED" || status === "APPROVED") return lang === "ko" ? "✅ 출금완료" : lang === "en" ? "✅ Withdrawn" : "✅ 已提现";
                      if (status === "REJECTED") return lang === "ko" ? "❌ 출금거절" : lang === "en" ? "❌ Rejected" : "❌ 已拒绝";
                      return lang === "ko" ? "출금" : "Withdraw";
                    }
                    if (txType === "DEPOSIT" || txType === "RECHARGE") return lang === "ko" ? "💰 충전" : lang === "en" ? "💰 Deposit" : "💰 充值";
                    if (txType === "GAME_WIN") return lang === "ko" ? "🎮 게임 당첨" : "🎮 Game Win";
                    if (txType === "GAME_BET") return lang === "ko" ? "🎮 게임 참여" : "🎮 Game Bet";
                    if (txType === "REFUND") return lang === "ko" ? "🔄 환불" : "🔄 Refund";
                    return txType;
                  };
                  const getStatusBadge = (txType: string, status: string) => {
                    if (txType === "WITHDRAW" && status === "PENDING") return { text: lang === "ko" ? "심사중" : "Pending", color: "text-[#F0B90B] bg-[#F0B90B]/10 border-[#F0B90B]/30" };
                    if (txType === "WITHDRAW" && (status === "COMPLETED" || status === "APPROVED")) return { text: lang === "ko" ? "완료" : "Done", color: "text-[#0ECB81] bg-[#0ECB81]/10 border-[#0ECB81]/30" };
                    if (txType === "WITHDRAW" && status === "REJECTED") return { text: lang === "ko" ? "거절" : "Rejected", color: "text-[#F6465D] bg-[#F6465D]/10 border-[#F6465D]/30" };
                    if (status === "COMPLETED") return { text: lang === "ko" ? "완료" : "Done", color: "text-[#0ECB81] bg-[#0ECB81]/10 border-[#0ECB81]/30" };
                    return { text: status, color: "text-[#848E9C] bg-[#848E9C]/10 border-[#848E9C]/30" };
                  };
                  const pp = 10;
                  const tp = Math.max(1, Math.ceil(txHistory.length / pp));
                  const items = txHistory.slice((historyPage - 1) * pp, historyPage * pp);
                  return (
                    <div className="space-y-3">
                      {txHistoryLoading ? (
                        <div className="text-center py-8 text-[#848E9C] text-xs">로딩 중...</div>
                      ) : txHistory.length === 0 ? (
                        <div className="text-center py-8 text-[#848E9C] text-xs">
                          {lang === "ko" ? "입출금 내역이 없습니다." : "No transaction history."}
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {items.map((tx) => {
                              const isPlus = tx.amount > 0;
                              const badge = getStatusBadge(tx.txType, tx.status);
                              const addr = tx.details?.address;
                              return (
                                <div key={tx.id} className="bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139]">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="text-xs font-bold text-[#EAECEF]">{getTxLabel(tx.txType, tx.status)}</p>
                                      <p className="text-[10px] text-[#848E9C] mt-0.5 font-mono">{new Date(tx.createdAt).toLocaleString()}</p>
                                      {addr && <p className="text-[9px] text-[#848E9C] mt-0.5 font-mono truncate max-w-[180px]">→ {addr}</p>}
                                    </div>
                                    <div className="text-right">
                                      <p className={`text-xs font-mono font-bold ${isPlus ? "text-[#0ECB81]" : "text-[#F6465D]"}`}>
                                        {isPlus ? "+" : ""}{Math.abs(tx.amount).toFixed(2)} {tx.symbol}
                                      </p>
                                      <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.color}`}>{badge.text}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {tp > 1 && (
                            <div className="flex justify-between items-center pt-2 border-t border-[#2B3139]">
                              <button disabled={historyPage === 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))} className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${historyPage === 1 ? "opacity-40 cursor-not-allowed bg-[#0B0E11] border-[#2B3139] text-[#848E9C]" : "bg-[#2B3139] border-[#2B3139] text-[#EAECEF] hover:bg-[#FCD535] hover:text-[#0B0E11]"}`}>◀ {lang === "ko" ? "이전" : "Prev"}</button>
                              <span className="text-[11px] font-mono text-[#848E9C]"><strong className="text-[#FCD535]">{historyPage}</strong> / {tp}</span>
                              <button disabled={historyPage === tp} onClick={() => setHistoryPage((p) => Math.min(tp, p + 1))} className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${historyPage === tp ? "opacity-40 cursor-not-allowed bg-[#0B0E11] border-[#2B3139] text-[#848E9C]" : "bg-[#2B3139] border-[#2B3139] text-[#EAECEF] hover:bg-[#FCD535] hover:text-[#0B0E11]"}`}>{lang === "ko" ? "다음" : "Next"} ▶</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ── 보너스 내역 탭 ── */}
                {walletHistoryTab === "bonus" && (() => {
                  type BonusTypeKey = "direct" | "mentor" | "mother" | "rank";
                  const bonusTypeColor: Record<BonusTypeKey, string> = {
                    direct: "text-[#FCD535] bg-[#FCD535]/10 border-[#FCD535]/30",
                    mentor: "text-[#0ECB81] bg-[#0ECB81]/10 border-[#0ECB81]/30",
                    mother: "text-[#F0B90B] bg-[#F0B90B]/10 border-[#F0B90B]/30",
                    rank:   "text-[#9B59B6] bg-[#9B59B6]/10 border-[#9B59B6]/30",
                  };
                  const bonusTypeLabel: Record<BonusTypeKey, string> = {
                    direct: lang === "ko" ? "직추천 보너스" : lang === "en" ? "Direct Bonus" : "直推奖",
                    mentor: lang === "ko" ? "육성 보너스"   : lang === "en" ? "Mentoring Bonus" : "育人奖",
                    mother: lang === "ko" ? "엄마 보너스"   : lang === "en" ? "Mother Bonus" : "母体奖",
                    rank:   lang === "ko" ? "직급 보너스"   : lang === "en" ? "Rank Bonus" : "平级奖",
                  };
                  const bonusList: { id: string; type: BonusTypeKey; fromName: string; fromId: string; reason: string; amount: string; time: string; }[] = [];
                  const pp = 8;
                  const tp = Math.ceil(bonusList.length / pp);
                  const items = bonusList.slice((bonusHistoryPage - 1) * pp, bonusHistoryPage * pp);
                  const totalBonus = bonusList.reduce((s, b) => s + parseFloat(b.amount.replace("+", "")), 0);
                  return (
                    <div className="space-y-3">
                      {/* Summary Bar */}
                      <div className="bg-[#0B0E11] rounded-xl p-3 border border-[#FCD535]/20 flex justify-between items-center">
                        <span className="text-[10px] text-[#848E9C] font-bold">
                          {lang === "ko" ? "총 수당 수익" : lang === "en" ? "Total Bonus Earned" : "总奖金收益"}
                        </span>
                        <span className="text-sm font-black text-[#FCD535] font-mono">+${totalBonus.toFixed(2)} USDT</span>
                      </div>

                      {/* Bonus Items */}
                      <div className="space-y-2">
                        {items.map((b) => (
                          <div key={b.id} className="bg-[#0B0E11] rounded-xl border border-[#2B3139] hover:border-[#FCD535]/30 transition-all overflow-hidden">
                            {/* Top row: type badge + amount */}
                            <div className="flex justify-between items-center px-3 pt-3 pb-2">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${bonusTypeColor[b.type]}`}>
                                {bonusTypeLabel[b.type]}
                              </span>
                              <span className="text-sm font-black text-[#0ECB81] font-mono">+{b.amount} USDT</span>
                            </div>
                            {/* Divider */}
                            <div className="border-t border-[#2B3139]/60 mx-3" />
                            {/* From member info */}
                            <div className="px-3 py-2 flex justify-between items-center">
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 rounded-full bg-[#1E2329] border border-[#2B3139] flex items-center justify-center text-[10px] font-black text-[#FCD535]">
                                  {b.fromName.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-[#EAECEF]">{b.fromName}</p>
                                  <p className="text-[9px] font-mono text-[#848E9C]">{b.fromId}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] text-[#848E9C]">{b.reason}</p>
                                <p className="text-[9px] font-mono text-[#848E9C] mt-0.5">{b.time}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {tp > 1 && (
                        <div className="flex justify-between items-center pt-2 border-t border-[#2B3139]">
                          <button disabled={bonusHistoryPage === 1} onClick={() => setBonusHistoryPage((p) => Math.max(1, p - 1))} className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${bonusHistoryPage === 1 ? "opacity-40 cursor-not-allowed bg-[#0B0E11] border-[#2B3139] text-[#848E9C]" : "bg-[#2B3139] border-[#2B3139] text-[#EAECEF] hover:bg-[#FCD535] hover:text-[#0B0E11]"}`}>◀ {lang === "ko" ? "이전" : "Prev"}</button>
                          <span className="text-[11px] font-mono text-[#848E9C]"><strong className="text-[#FCD535]">{bonusHistoryPage}</strong> / {tp} {lang === "ko" ? "페이지" : "Page"}</span>
                          <button disabled={bonusHistoryPage === tp} onClick={() => setBonusHistoryPage((p) => Math.min(tp, p + 1))} className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${bonusHistoryPage === tp ? "opacity-40 cursor-not-allowed bg-[#0B0E11] border-[#2B3139] text-[#848E9C]" : "bg-[#2B3139] border-[#2B3139] text-[#EAECEF] hover:bg-[#FCD535] hover:text-[#0B0E11]"}`}>{lang === "ko" ? "다음" : "Next"} ▶</button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── 스왑 탭 ── */}
                {walletHistoryTab === "swap" && (
                  <div className="space-y-2">
                    {([] as { id: string, from: string, to: string, rate: string, time: string, status: string }[]).map((s) => (
                      <div key={s.id} className="bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139]">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-[#F6465D] font-mono">-{s.from}</span>
                            <span className="text-[#848E9C] text-xs">➔</span>
                            <span className="text-xs font-bold text-[#0ECB81] font-mono">+{s.to}</span>
                          </div>
                          <span className="text-[9px] font-bold text-[#0ECB81] bg-[#0ECB81]/10 px-2 py-0.5 rounded border border-[#0ECB81]/30">{s.status}</span>
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[9px] text-[#848E9C]">{s.rate}</span>
                          <span className="text-[9px] font-mono text-[#848E9C]">{s.time}</span>
                        </div>
                      </div>
                    ))}
                    {/* Empty state placeholder if no swap */}
                  </div>
                )}

              </div>
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
                        <span className="font-extrabold text-[#FCD535] bg-[#FCD535]/10 px-2 py-0.5 rounded">
                          {n.round === "자동 게임" 
                            ? (lang === "ko" ? "자동 게임" : lang === "en" ? "Auto Game" : "自动游戏") 
                            : `${n.round.replace(/[^0-9]/g, "")}${lang === "ko" ? "회차" : lang === "en" ? " Round" : "轮"}`}
                        </span>
                        <span className="text-[#848E9C] font-mono">{n.time} ({n.createdAt})</span>
                      </div>
                      <p className="text-xs font-bold text-[#EAECEF] pt-0.5">
                        {n.title.includes("당첨 결과 발표")
                          ? `${n.title.startsWith("🎉") ? "🎉" : "🪙"} ${n.title.match(/\d+/)?.[0] || ""}${lang === "ko" ? "회차 AI 당첨 결과 발표" : lang === "en" ? " Round AI Draw Result" : "轮 AI 抽奖公布"}`
                          : n.title.includes("게임 참여 불가")
                            ? (lang === "ko" ? "⚠️ 옥구슬 부족 — 게임 참여 불가" : lang === "en" ? "⚠️ Insufficient Beads — Cannot Join" : "⚠️ 玉珠不足 — 无法参与")
                            : n.title.includes("자동 게임 중단")
                              ? (lang === "ko" ? "⚠️ 옥구슬 소진으로 자동 게임 중단" : lang === "en" ? "⚠️ Auto Game Stopped (No Beads)" : "⚠️ 因玉珠耗尽自动游戏停止")
                              : n.title}
                      </p>
                      <p className={`text-[11px] font-semibold ${n.resultType === "USDT_WIN" ? "text-[#0ECB81]" : "text-[#FCD535]"}`}>
                        {n.rewardText.includes("금전 당첨!")
                          ? (lang === "ko" ? "금전 당첨! (+102.00 USDT 지불 완료)" : lang === "en" ? "Cash Win! (+102.00 USDT Paid)" : "现金中奖！(+102.00 USDT 已支付)")
                          : n.rewardText.includes("옥보 당첨!")
                            ? (lang === "ko" ? "옥보 당첨! (+80.00 USDT, +40 옥구슬 지급 완료)" : lang === "en" ? "Jade Win! (+80.00 USDT, +40 Beads Paid)" : "玉宝中奖！(+80.00 USDT, +40 玉珠已支付)")
                            : n.rewardText.includes("보유 옥구슬")
                              ? (lang === "ko" ? n.rewardText : lang === "en" ? `Insufficient beads. Need: ${n.rewardText.match(/\d+/g)?.[1] || 0}` : `玉珠不足。需要: ${n.rewardText.match(/\d+/g)?.[1] || 0}`)
                              : n.rewardText.includes("자동 게임 참여가 중단")
                                ? (lang === "ko" ? n.rewardText : lang === "en" ? `Auto game stopped due to depleted beads.` : `因玉珠耗尽，自动游戏已停止。`)
                                : n.rewardText}
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
                    {lang === "ko" ? "보너스 옥구슬:" : lang === "en" ? "Bonus Jade Beads:" : "赠送玉珠:"}
                  </span>
                  <span className="font-bold text-[#0ECB81]">+{confirmPurchaseModal.urdBonus.toLocaleString()} {lang === "ko" ? "개" : lang === "en" ? "Bead(s)" : "个"}</span>
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
                onClick={() => { setActiveTab("wallet"); openDepositModal(); }}
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
                  urdBonus: 100, 
                  capRate: 2.0, 
                  capUsd: "$200 (200%)", 
                  desc: lang === "ko" ? "옥구슬 100개 증정 • 수당 캡 200% 달성 시 소멸" : lang === "en" ? "Bonus 100 Jade Beads • Expires at 200% Payout Cap" : "赠送 100 个玉珠 • 200% 封顶",
                  badgeZh: "祥云",
                  imgSrc: "/badges/xiangyun.jpg",
                  badgeTheme: "border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5),inset_0_0_10px_rgba(34,211,238,0.2)]",
                  badgeBgGlow: "from-cyan-500 to-cyan-700",
                  badgeText: "text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,1)]"
                },
                { 
                  level: 2, 
                  price: 500, 
                  urdBonus: 550, 
                  capRate: 2.5, 
                  capUsd: "$1,250 (250%)", 
                  desc: lang === "ko" ? "옥구슬 550개, 홍바오 1개 증정 • 수당 캡 250% 달성 시 소멸" : lang === "en" ? "Bonus 550 Jade Beads, 1 Hongbao • Expires at 250% Payout Cap" : "赠送 550 个玉珠, 1 个红包 • 250% 封顶",
                  badgeZh: "紫光",
                  imgSrc: "/badges/ziguang.jpg",
                  badgeTheme: "border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5),inset_0_0_10px_rgba(217,70,239,0.2)]",
                  badgeBgGlow: "from-fuchsia-500 to-fuchsia-700",
                  badgeText: "text-fuchsia-300 drop-shadow-[0_0_10px_rgba(217,70,239,1)]"
                },
                { 
                  level: 3, 
                  price: 1000, 
                  urdBonus: 1200, 
                  capRate: 3.0, 
                  capUsd: "$3,000 (300%)", 
                  desc: lang === "ko" ? "옥구슬 1,200개, 홍바오 3개 증정 • 수당 캡 300% 달성 시 소멸" : lang === "en" ? "Bonus 1,200 Jade Beads, 3 Hongbao • Expires at 300% Payout Cap" : "赠送 1,200 个玉珠, 3 个红包 • 300% 封顶",
                  badgeZh: "鸿运",
                  imgSrc: "/badges/hongyun.jpg",
                  badgeTheme: "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5),inset_0_0_10px_rgba(239,68,68,0.2)]",
                  badgeBgGlow: "from-red-500 to-red-700",
                  badgeText: "text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,1)]"
                },
              ].map((p) => (
                <div key={p.level} className="bg-[#1E2329] border border-[#2B3139] hover:border-[#FCD535] rounded-2xl p-5 space-y-4 transition-all shadow-lg overflow-hidden relative">
                  
                  {/* Background Glow Effect */}
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${p.badgeBgGlow} opacity-10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none`} />

                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center space-x-3">
                      {/* Chinese Character Badge - Premium Image */}
                      <div className={`w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center bg-[#0B0E11]/80 border-2 ${p.badgeTheme}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imgSrc} alt={p.badgeZh} className="w-full h-full object-cover mix-blend-lighten" />
                      </div>
                      
                      <div>
                        <span className="text-2xl font-black text-[#FCD535]">${p.price.toLocaleString()}</span>
                        <h4 className="text-sm font-bold text-[#EAECEF] mt-1">{p.level === 1 ? t.node100Name : p.level === 2 ? t.node500Name : t.node1000Name}</h4>
                      </div>
                    </div>
                    
                    <span className="bg-[#0ECB81]/10 text-[#0ECB81] border border-[#0ECB81]/30 text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap">
                      {t.cap}: {p.capUsd}
                    </span>
                  </div>

                  <p className="text-xs text-[#848E9C] bg-[#0B0E11] p-3 rounded-xl border border-[#2B3139] relative z-10">
                    {p.desc}
                  </p>

                  <button 
                    onClick={() => handleRequestPurchase(p.level, p.price, p.urdBonus, p.capRate)}
                    className="w-full py-3 bg-[#FCD535] text-[#0B0E11] font-black rounded-xl text-sm hover:opacity-90 active:scale-95 transition-all shadow-[0_0_20px_rgba(252,213,53,0.2)] flex items-center justify-center space-x-1.5 relative z-10"
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

              {/* Jade Balance */}
              <div className="bg-[#1E2329] rounded-xl p-4 border border-[#2B3139]">
                <p className="text-xs font-bold text-[#848E9C]">{lang === "ko" ? "옥구슬 보유량" : lang === "en" ? "Jade Beads Balance" : "玉珠持有量"}</p>
                <h2 className="text-xl font-extrabold text-[#FCD535] mt-1 tracking-tight">
                  {urdBalance.toLocaleString()} <span className="text-xs font-normal text-[#EAECEF]">{lang === "ko" ? "개" : lang === "en" ? "Bead(s)" : "个"}</span>
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
                    {(dbRounds.length > 0 ? dbRounds : [
                      { round_number: 1, start_time: "11:00:00", end_time: "12:00:00", draw_time: "12:30:00" },
                      { round_number: 2, start_time: "14:00:00", end_time: "15:00:00", draw_time: "15:30:00" },
                      { round_number: 3, start_time: "17:00:00", end_time: "18:00:00", draw_time: "18:30:00" }
                    ]).map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#2B3139]/40 transition-colors">
                        <td className="py-2.5 font-bold text-[#FCD535]">
                          {item.round_number}
                          {lang === "ko" ? "회차" : lang === "en" ? " Round" : "轮"}
                        </td>
                        <td className="py-2.5 text-[#EAECEF] font-mono">
                          {item.start_time.substring(0, 5)} ~ {item.end_time.substring(0, 5)}
                        </td>
                        <td className="py-2.5 text-[#0ECB81] font-semibold">{t.aiDraw}</td>
                        <td className="py-2.5 font-mono text-[#FCD535] font-bold">{item.draw_time.substring(0, 5)}</td>
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
                      {(dbRounds.length > 0 ? dbRounds.map(r => r.round_number) : [1, 2, 3]).map((rNum) => (
                        <button
                          key={rNum}
                          onClick={() => setManualRound(rNum)}
                          className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                            manualRound === rNum
                              ? "bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535]"
                              : "bg-[#0B0E11] border-[#2B3139] text-[#848E9C]"
                          }`}
                        >
                          {rNum}
                          {lang === "ko" ? "회차" : lang === "en" ? " Round" : "轮"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#848E9C] font-bold">
                        {lang === "ko" ? "회당 참여 횟수 (1회당 옥구슬 1개)" : lang === "en" ? "Play Count (1 Jade Bead each)" : "每轮参与次数 (每轮 1 个玉珠)"}
                      </span>
                      <span className="text-[#FCD535] font-bold text-[11px]">
                        {lang === "ko" ? "소모" : lang === "en" ? "Cost" : "消耗"}: {manualBetsCount} {lang === "ko" ? "옥구슬" : lang === "en" ? "Jade" : "玉"}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* 감소 버튼 */}
                      <button
                        type="button"
                        onClick={() => setManualBetsCount((prev) => Math.max(1, prev - 1))}
                        className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#0B0E11] border border-[#2B3139] text-[#EAECEF] font-black text-lg hover:border-[#FCD535] hover:text-[#FCD535] transition-all active:scale-90 flex items-center justify-center"
                      >
                        −
                      </button>

                      {/* 숫자 입력 */}
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={manualBetsCount}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1 && v <= 100) {
                              setManualBetsCount(v);
                            } else if (e.target.value === "") {
                              setManualBetsCount(1);
                            }
                          }}
                          className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-[#FCD535] rounded-xl py-2.5 text-center text-lg font-black text-[#FCD535] outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 inset-y-0 flex items-center text-[10px] text-[#848E9C] font-bold pointer-events-none">
                          {lang === "ko" ? "회" : lang === "en" ? "×" : "次"}
                        </span>
                      </div>

                      {/* 증가 버튼 */}
                      <button
                        type="button"
                        onClick={() => setManualBetsCount((prev) => Math.min(100, prev + 1))}
                        className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#0B0E11] border border-[#2B3139] text-[#EAECEF] font-black text-lg hover:border-[#FCD535] hover:text-[#FCD535] transition-all active:scale-90 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    {/* 빠른 선택 칩 */}
                    <div className="flex space-x-2">
                      {[1, 5, 10, 30, 50].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setManualBetsCount(n)}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                            manualBetsCount === n
                              ? "bg-[#FCD535]/20 border-[#FCD535] text-[#FCD535]"
                              : "bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50 hover:text-[#EAECEF]"
                          }`}
                        >
                          {n}
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
                      {manualRound}
                      {lang === "ko" ? "회차" : lang === "en" ? " Round" : "轮"} {t.manualBetBtn} ({manualBetsCount * 1} {lang === "ko" ? "옥구슬 소모" : lang === "en" ? "Jade Bead(s)" : "个玉珠"})
                    </span>
                  </button>

                  {/* ── 게임 참여 컨펌 팝업 ── */}
                  {showGameConfirmModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-[#1E2329] border border-[#FCD535]/40 rounded-2xl w-full max-w-xs p-6 space-y-5 shadow-[0_0_40px_rgba(252,213,53,0.25)] relative">
                        {/* 닫기 */}
                        <button
                          onClick={() => setShowGameConfirmModal(false)}
                          className="absolute top-3 right-3 text-[#848E9C] hover:text-[#EAECEF] p-1.5 hover:bg-[#2B3139] rounded-lg transition-colors"
                        >
                          ✕
                        </button>

                        {/* 헤더 */}
                        <div className="text-center space-y-1">
                          <div className="w-14 h-14 rounded-full bg-[#FCD535]/10 border border-[#FCD535]/30 flex items-center justify-center mx-auto">
                            <Gamepad2 size={28} className="text-[#FCD535]" />
                          </div>
                          <h3 className="text-base font-black text-[#EAECEF] pt-1">
                            {lang === "ko" ? "게임 참여 확인" : lang === "en" ? "Confirm Game Entry" : "确认参与游戏"}
                          </h3>
                          <p className="text-xs text-[#848E9C]">
                            {lang === "ko" ? "아래 내용을 확인하고 참여하세요" : lang === "en" ? "Please review before joining" : "请确认以下信息后参与"}
                          </p>
                        </div>

                        {/* 참여 정보 */}
                        <div className="bg-[#0B0E11] rounded-xl border border-[#2B3139] divide-y divide-[#2B3139]">
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-xs text-[#848E9C] font-bold">
                              {lang === "ko" ? "참여 회차" : lang === "en" ? "Round" : "参与轮次"}
                            </span>
                            <span className="text-sm font-black text-[#FCD535]">
                              {manualRound}{lang === "ko" ? "회차" : lang === "en" ? " Round" : "轮"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-xs text-[#848E9C] font-bold">
                              {lang === "ko" ? "게임 횟수" : lang === "en" ? "Play Count" : "游戏次数"}
                            </span>
                            <span className="text-sm font-black text-[#EAECEF]">
                              {manualBetsCount}{lang === "ko" ? "회" : lang === "en" ? " Times" : "次"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-xs text-[#848E9C] font-bold">
                              {lang === "ko" ? "소모 옥구슬" : lang === "en" ? "Jade Beads" : "消耗玉珠"}
                            </span>
                            <span className="text-sm font-black text-[#F6465D]">
                              -{manualBetsCount * 1} {lang === "ko" ? "개" : lang === "en" ? "Bead(s)" : "个"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center px-4 py-3">
                            <span className="text-xs text-[#848E9C] font-bold">
                              {lang === "ko" ? "참여 후 잔액" : lang === "en" ? "After Balance" : "参与后余额"}
                            </span>
                            <span className={`text-sm font-black font-mono ${
                              urdBalance - manualBetsCount * 1 >= 0 ? "text-[#0ECB81]" : "text-[#F6465D]"
                            }`}>
                              {Math.max(0, urdBalance - manualBetsCount * 1)}{lang === "ko" ? "개" : lang === "en" ? " Bead(s)" : "个"}
                            </span>
                          </div>
                        </div>

                        {/* 버튼 */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setShowGameConfirmModal(false)}
                            className="py-3 rounded-xl border border-[#2B3139] bg-[#0B0E11] text-[#848E9C] font-bold text-sm hover:border-[#EAECEF] hover:text-[#EAECEF] transition-all active:scale-95"
                          >
                            {lang === "ko" ? "취소" : lang === "en" ? "Cancel" : "取消"}
                          </button>
                          <button
                            onClick={confirmManualBet}
                            className="py-3 rounded-xl bg-[#FCD535] text-[#0B0E11] font-black text-sm hover:opacity-90 transition-all active:scale-95 shadow-[0_0_16px_rgba(252,213,53,0.3)] flex items-center justify-center space-x-1.5"
                          >
                            <Play size={14} />
                            <span>{lang === "ko" ? "참여 확인" : lang === "en" ? "Confirm" : "确认参与"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Auto Game Tab */
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <label className="text-xs text-[#848E9C] font-bold">{t.autoBetRounds}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(dbRounds.length > 0 ? dbRounds.map(r => r.round_number) : [1, 2, 3]).map((rNum) => {
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
                            <span>
                              {rNum}
                              {lang === "ko" ? "회차" : lang === "en" ? " Round" : "轮"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto Bets Count — 숫자 직접 입력 */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#848E9C] font-bold">
                        {lang === "ko" ? "회당 자동 참여 횟수 (1회당 옥구슬 1개)" : lang === "en" ? "Auto Play Count (1 Jade Bead each)" : "每轮自动游戏次数 (每轮 1 个玉珠)"}
                      </span>
                      <span className="text-[#FCD535] font-bold text-[11px]">
                        {lang === "ko" ? "소모" : lang === "en" ? "Cost" : "消耗"}: {autoSettings.betsCount} {lang === "ko" ? "옥구슬" : lang === "en" ? "Jade" : "玉"}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* 감소 버튼 */}
                      <button
                        type="button"
                        onClick={() => setAutoSettings((prev) => ({ ...prev, betsCount: Math.max(1, prev.betsCount - 1) }))}
                        className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#0B0E11] border border-[#2B3139] text-[#EAECEF] font-black text-lg hover:border-[#FCD535] hover:text-[#FCD535] transition-all active:scale-90 flex items-center justify-center"
                      >
                        −
                      </button>

                      {/* 숫자 입력 */}
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={autoSettings.betsCount}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1 && v <= 100) {
                              setAutoSettings((prev) => ({ ...prev, betsCount: v }));
                            } else if (e.target.value === "") {
                              setAutoSettings((prev) => ({ ...prev, betsCount: 1 }));
                            }
                          }}
                          className="w-full bg-[#0B0E11] border border-[#2B3139] focus:border-[#FCD535] rounded-xl py-2.5 text-center text-lg font-black text-[#FCD535] outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="absolute right-3 inset-y-0 flex items-center text-[10px] text-[#848E9C] font-bold pointer-events-none">
                          {lang === "ko" ? "회" : lang === "en" ? "×" : "次"}
                        </span>
                      </div>

                      {/* 증가 버튼 */}
                      <button
                        type="button"
                        onClick={() => setAutoSettings((prev) => ({ ...prev, betsCount: Math.min(100, prev.betsCount + 1) }))}
                        className="w-10 h-10 flex-shrink-0 rounded-xl bg-[#0B0E11] border border-[#2B3139] text-[#EAECEF] font-black text-lg hover:border-[#FCD535] hover:text-[#FCD535] transition-all active:scale-90 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>

                    {/* 빠른 선택 칩 */}
                    <div className="flex space-x-2">
                      {[1, 5, 10, 30, 50].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAutoSettings((prev) => ({ ...prev, betsCount: n }))}
                          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                            autoSettings.betsCount === n
                              ? "bg-[#FCD535]/20 border-[#FCD535] text-[#FCD535]"
                              : "bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50 hover:text-[#EAECEF]"
                          }`}
                        >
                          {n}
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

            {/* ── 게임 상태 탭 섹션 ── */}
            <div className="space-y-3">
              {/* 탭 헤더 */}
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold text-[#EAECEF] flex items-center space-x-1.5">
                  <Gamepad2 size={14} className="text-[#FCD535]" />
                  <span>{lang === "ko" ? "게임 현황" : lang === "en" ? "Game Status" : "游戏状态"}</span>
                </h3>
              </div>

              {/* 3-Tab Selector */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#0B0E11] p-1 rounded-xl border border-[#2B3139]">
                {([
                  { id: "active"  as const, ko: "진행중",  en: "Active",  zh: "进行中", dot: "bg-[#0ECB81]" },
                  { id: "waiting" as const, ko: "대기",    en: "Waiting", zh: "等待中", dot: "bg-[#FCD535]" },
                  { id: "ended"   as const, ko: "종료",    en: "Ended",   zh: "已结束", dot: "bg-[#848E9C]" },
                ] as { id: "active" | "waiting" | "ended"; ko: string; en: string; zh: string; dot: string }[]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setGameStatusTab(tab.id)}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                      gameStatusTab === tab.id
                        ? "bg-[#1E2329] text-[#EAECEF] shadow-sm"
                        : "text-[#848E9C] hover:text-[#EAECEF]"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${tab.dot} ${gameStatusTab === tab.id ? "opacity-100" : "opacity-40"}`} />
                    <span>{lang === "ko" ? tab.ko : lang === "en" ? tab.en : tab.zh}</span>
                  </button>
                ))}
              </div>

              {/* ── 진행중 탭 ── */}
              {gameStatusTab === "active" && (() => {
                const activeGames = [
                  ...myBets.filter(b => b.status === "WAITING"),
                  // 샘플 진행중 데이터 (실서버 연동 전)
                  ...(myBets.length === 0 ? [] : []),
                ];
                return (
                  <div className="space-y-2">
                    {activeGames.length === 0 ? (
                      <div className="bg-[#1E2329] rounded-xl p-5 text-center border border-[#2B3139]">
                        <p className="text-xs text-[#848E9C]">{lang === "ko" ? "현재 진행 중인 게임이 없습니다." : lang === "en" ? "No active games." : "暂无进行中的游戏。"}</p>
                      </div>
                    ) : activeGames.map((b) => (
                      <div key={b.id} className="bg-[#1E2329] border border-[#0ECB81]/30 rounded-xl p-3.5 flex justify-between items-center hover:border-[#0ECB81]/60 transition-all">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81] animate-pulse" />
                            <span className="text-xs font-extrabold text-[#FCD535]">
                              {b.round === 1 ? t.round1 : b.round === 2 ? t.round2 : t.round3}
                            </span>
                            <span className="text-[10px] text-[#848E9C]">({b.betAt})</span>
                          </div>
                          <p className="text-[10px] text-[#848E9C]">
                            {b.betsCount}{lang === "ko" ? "회 참여" : lang === "en" ? " Plays" : "次"} · {b.urdSpent} {lang === "ko" ? "옥구슬" : "Jade"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#0ECB81] bg-[#0ECB81]/10 border border-[#0ECB81]/30 px-2 py-1 rounded-lg">
                            ● {lang === "ko" ? "진행중" : lang === "en" ? "Active" : "进行中"}
                          </span>
                          <p className="text-[9px] text-[#848E9C] mt-1">
                            {lang === "ko" ? "발표" : "Draw"}: {b.round === 1 ? "12:30" : b.round === 2 ? "15:30" : "18:30"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── 대기 탭 ── */}
              {gameStatusTab === "waiting" && (() => {
                const waitingGames: { id: string; round: number; betsCount: number; urdSpent: number; drawTime: string; betAt: string; }[] = [];
                return (
                  <div className="space-y-2">
                    {waitingGames.map((g) => (
                      <div key={g.id} className="bg-[#1E2329] border border-[#FCD535]/20 rounded-xl p-3.5 flex justify-between items-center hover:border-[#FCD535]/50 transition-all">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FCD535]" />
                            <span className="text-xs font-extrabold text-[#FCD535]">
                              {g.round === 1 ? t.round1 : g.round === 2 ? t.round2 : t.round3}
                            </span>
                            <span className="text-[10px] text-[#848E9C]">({g.betAt})</span>
                          </div>
                          <p className="text-[10px] text-[#848E9C]">
                            {g.betsCount}{lang === "ko" ? "회 참여" : lang === "en" ? " Plays" : "次"} · {g.urdSpent} {lang === "ko" ? "옥구슬" : "Jade"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#FCD535] bg-[#FCD535]/10 border border-[#FCD535]/30 px-2 py-1 rounded-lg">
                            ⏳ {lang === "ko" ? "대기" : lang === "en" ? "Waiting" : "等待"}
                          </span>
                          <p className="text-[9px] text-[#848E9C] mt-1">
                            {lang === "ko" ? "발표" : "Draw"}: {g.drawTime}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── 종료 탭 ── */}
              {gameStatusTab === "ended" && (() => {
                const endedGames: { id: string; round: number; betsCount: number; urdSpent: number; betAt: string; result: string; reward: string; date: string; }[] = [];
                return (
                  <div className="space-y-2">
                    {endedGames.map((g) => (
                      <div key={g.id} className={`bg-[#1E2329] border rounded-xl p-3.5 flex justify-between items-center transition-all ${
                        g.result === "WIN" ? "border-[#0ECB81]/20 hover:border-[#0ECB81]/40" : "border-[#2B3139] hover:border-[#848E9C]/40"
                      }`}>
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-extrabold ${ g.result === "WIN" ? "text-[#FCD535]" : "text-[#848E9C]" }`}>
                              {g.round === 1 ? t.round1 : g.round === 2 ? t.round2 : t.round3}
                            </span>
                            <span className="text-[9px] font-mono text-[#848E9C]">{g.date} {g.betAt}</span>
                          </div>
                          <p className="text-[10px] text-[#848E9C]">
                            {g.betsCount}{lang === "ko" ? "회 참여" : lang === "en" ? " Plays" : "次"} · {g.urdSpent} {lang === "ko" ? "옥구슬" : "Jade"}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          {g.result === "WIN" ? (
                            <>
                              <span className="text-[10px] font-bold text-[#0ECB81] bg-[#0ECB81]/10 border border-[#0ECB81]/30 px-2 py-1 rounded-lg block">
                                🏆 {lang === "ko" ? "당첨" : lang === "en" ? "WIN" : "中奖"}
                              </span>
                              <p className="text-xs font-black text-[#0ECB81] font-mono">{g.reward}</p>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-[#848E9C] bg-[#848E9C]/10 border border-[#848E9C]/20 px-2 py-1 rounded-lg">
                              ✕ {lang === "ko" ? "미당첨" : lang === "en" ? "LOSE" : "未中奖"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

            </div>

          </div>
        )}

        {/* ═══════════════ NETWORK ═══════════════ */}
        {activeTab === "network" && (
          <div className="p-5 flex flex-col justify-between min-h-[calc(100vh-140px)]">
            <div className="space-y-4 flex-1 flex flex-col relative">
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

              {/* Floating Zoom Controls */}
              <div className="absolute bottom-4 right-4 bg-[#1E2329]/85 backdrop-blur-md border border-[#2B3139] rounded-xl p-1.5 flex items-center space-x-1 shadow-lg z-10">
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.max(prev - 0.1, 0.5))}
                  className="w-8 h-8 rounded-lg bg-[#0B0E11] hover:bg-[#2B3139] text-[#848E9C] hover:text-[#EAECEF] font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="text-[10px] text-[#EAECEF] font-mono font-bold w-12 text-center select-none">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(prev + 0.1, 1.5))}
                  className="w-8 h-8 rounded-lg bg-[#0B0E11] hover:bg-[#2B3139] text-[#848E9C] hover:text-[#EAECEF] font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(1.0)}
                  className="w-8 h-8 rounded-lg bg-[#0B0E11] hover:bg-[#2B3139] text-[#848E9C] hover:text-[#EAECEF] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
                  title="Reset"
                >
                  ↺
                </button>
              </div>

              {/* Frameless Expanded Tree Canvas (No outer borders, no scrollbars visible) */}
              <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="w-full flex-1 overflow-x-auto overflow-y-auto py-6 flex justify-center items-start [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                <div 
                  className="min-w-[440px] px-2 flex flex-col items-center space-y-6 transition-transform duration-200 ease-out"
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: "top center"
                  }}
                >
                  
                  {/* Root Node: Me (User) */}
                  <div className="relative flex flex-col items-center">
                    <div className="bg-[#FCD535] text-[#0B0E11] rounded-2xl px-6 py-3 shadow-[0_0_25px_rgba(252,213,53,0.35)] text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <span className="text-sm font-black">👑 {userNickname}</span>
                        <StarBadge level={0} />
                      </div>
                      <p className="text-[10px] font-bold opacity-80 mt-0.5">
                        {lang === "ko" ? "본인 계정" : lang === "en" ? "My Account" : "本人账号"}
                      </p>
                    </div>
                    {/* Down Branch Line */}
                    <div className="w-0.5 h-6 bg-[#FCD535]/60" />
                  </div>

                  {/* Level 1 Horizontal Branch Bar */}
                  {networkTab === "referral" ? (
                    /* ── 1. 추천 계보 (Direct Referral Tree) ── */
                    <div className="relative w-full flex justify-center pt-8 pb-4">
                      <p className="text-sm font-bold text-[#848E9C]">{lang === "ko" ? "아직 추천 회원이 없습니다" : lang === "en" ? "No referral members yet" : "暂无推荐会员"}</p>
                    </div>
                  ) : (
                    /* ── 2. 후원 계보 (Sponsor Placement Tree) ── */
                    <div className="relative w-full flex justify-center pt-8 pb-4">
                      <p className="text-sm font-bold text-[#848E9C]">{lang === "ko" ? "아직 후원 회원이 없습니다" : lang === "en" ? "No sponsor members yet" : "暂无赞助会员"}</p>
                    </div>
                  )}

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
                          {m.id} • {m.joinedAt}
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
            <div className="bg-[#1E2329] rounded-xl p-4 flex items-start space-x-3">
              <div className="w-12 h-12 rounded-full bg-[#2B3139] flex justify-center items-center font-bold text-[#FCD535] flex-shrink-0">
                {userNickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#EAECEF] truncate">{userEmail}</p>

                {isEditingNickname ? (
                  <div className="mt-2 flex flex-col space-y-2">
                    <input 
                      type="text" 
                      value={editNicknameValue}
                      onChange={(e) => setEditNicknameValue(e.target.value)}
                      className="w-full bg-[#0B0E11] border border-[#2B3139] rounded px-3 py-2 text-sm text-[#EAECEF] focus:border-[#FCD535] outline-none transition-colors"
                      placeholder="New nickname"
                      maxLength={20}
                    />
                    <div className="flex space-x-2">
                      <button 
                        onClick={handleUpdateNickname}
                        disabled={nicknameUpdateLoading}
                        className="flex-1 py-1.5 bg-[#FCD535] text-[#0B0E11] text-xs font-bold rounded active:scale-95 transition-all disabled:opacity-50"
                      >
                        {nicknameUpdateLoading ? "..." : (lang === "ko" ? "저장" : lang === "en" ? "Save" : "保存")}
                      </button>
                      <button 
                        onClick={() => setIsEditingNickname(false)}
                        className="flex-1 py-1.5 bg-[#2B3139] text-[#EAECEF] text-xs font-bold rounded hover:bg-[#3B424B] active:scale-95 transition-all"
                      >
                        {lang === "ko" ? "취소" : lang === "en" ? "Cancel" : "取消"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-sm text-[#FCD535] font-semibold truncate">{userNickname}</span>
                    <button onClick={() => {
                      setEditNicknameValue(userNickname);
                      setIsEditingNickname(true);
                    }} className="text-[#848E9C] hover:text-[#EAECEF] flex-shrink-0 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                  </div>
                )}

                <button onClick={handleLogout} className="text-xs text-[#F6465D] mt-4 flex items-center hover:opacity-80 transition-opacity">
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
                  { code: "zh", src: "https://flagcdn.com/w40/cn.png", label: "中文" },
                  { code: "en", src: "https://flagcdn.com/w40/gb.png", label: "English" },
                  { code: "ko", src: "https://flagcdn.com/w40/kr.png", label: "한국어" },
                ].map((l) => (
                  <button
                    key={l.code}
                    onClick={() => changeLang(l.code as Language)}
                    className={`flex flex-col items-center justify-center space-y-1.5 py-3 px-2 rounded-lg text-xs font-bold transition-all border ${
                      lang === l.code
                        ? "bg-[#FCD535] text-[#0B0E11] border-[#FCD535] shadow-[0_0_10px_rgba(252,213,53,0.3)]"
                        : "bg-[#0B0E11] text-[#848E9C] border-[#2B3139] hover:text-[#EAECEF] hover:border-[#848E9C]"
                    }`}
                  >
                    <img src={l.src} alt={l.label} className="w-6 h-auto rounded-sm shadow-sm" />
                    <span>{l.label}</span>
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
                  {typeof window !== "undefined" ? window.location.origin : "https://app.urc369.com"}/register?ref={userId ? `BAO-${userId.substring(0, 8).toUpperCase()}` : "BAO369"}
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
        {/* ── PURCHASE SUCCESS FULLSCREEN EFFECT ── */}
        {purchaseSuccessEffect?.show && (
          <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
            onClick={() => setPurchaseSuccessEffect(null)}
          >
            {/* Background Overlay */}
            <div className="absolute inset-0 bg-[#0B0E11]/90 backdrop-blur-md animate-in fade-in duration-300" />
            
            {/* Dynamic Light Rays */}
            <div className={`absolute inset-0 opacity-40 animate-pulse ${
              purchaseSuccessEffect.level === 1 ? "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.4)_0%,transparent_70%)]" :
              purchaseSuccessEffect.level === 2 ? "bg-[radial-gradient(circle_at_center,rgba(192,38,211,0.5)_0%,transparent_70%)]" :
              "bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.6)_0%,transparent_70%)]"
            }`} />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center text-center animate-in zoom-in-50 slide-in-from-bottom-10 duration-500 spring-bounce">
              
              {/* Giant Chinese Character Badge - Neon Style */}
              <div className={`w-40 h-40 rounded-3xl flex items-center justify-center mb-6 border-4 transform rotate-3 shadow-2xl bg-[#0B0E11]/80 ${
                purchaseSuccessEffect.level === 1 ? "border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.6),inset_0_0_20px_rgba(34,211,238,0.3)]" :
                purchaseSuccessEffect.level === 2 ? "border-fuchsia-500 shadow-[0_0_40px_rgba(217,70,239,0.6),inset_0_0_20px_rgba(217,70,239,0.3)]" :
                "border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.6),inset_0_0_20px_rgba(239,68,68,0.3)]"
              }`}>
                <span className={`text-7xl font-black tracking-widest ${
                  purchaseSuccessEffect.level === 1 ? "text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,1)]" :
                  purchaseSuccessEffect.level === 2 ? "text-fuchsia-300 drop-shadow-[0_0_20px_rgba(217,70,239,1)]" :
                  "text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,1)]"
                }`} style={{ fontFamily: "serif" }}>
                  {purchaseSuccessEffect.level === 1 ? "祥云" : purchaseSuccessEffect.level === 2 ? "紫光" : "鸿运"}
                </span>
              </div>

              {/* Title & Rewards */}
              <h1 className="text-3xl font-black text-white mb-2 drop-shadow-lg">
                {lang === "ko" ? "구매 완료!" : lang === "en" ? "Purchase Success!" : "购买成功！"}
              </h1>
              <p className="text-lg font-bold text-[#FCD535] mb-6">
                {purchaseSuccessEffect.name} {lang === "ko" ? "활성화" : lang === "en" ? "Activated" : "已激活"}
              </p>

              <div className="bg-[#1E2329]/80 border border-[#2B3139] rounded-2xl p-4 flex flex-col items-center min-w-[240px] backdrop-blur-sm">
                <span className="text-xs text-[#848E9C] font-bold mb-1">
                  {lang === "ko" ? "지급된 옥구슬" : lang === "en" ? "Bonus Jade Received" : "获得玉珠"}
                </span>
                <span className="text-2xl font-black text-[#0ECB81]">
                  +{purchaseSuccessEffect.urdBonus.toLocaleString()}
                </span>
              </div>

              <p className="text-[#848E9C] text-[10px] mt-10 animate-pulse">
                {lang === "ko" ? "화면을 터치하여 닫기" : lang === "en" ? "Tap anywhere to close" : "点击屏幕关闭"}
              </p>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
