"use client";

import React, { useState, useEffect } from "react";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Users, 
  Percent, 
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface PendingWithdrawal {
  id: string;
  userId: string;
  email: string;
  amount: number;
  fee: number;
  asset: string;
  txHash: string;
  status: string;
  time: string;
}

export default function DashboardPage() {
  const [timeLeft, setTimeLeft] = useState("");
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([
    { id: "wd-883", userId: "u1", email: "active_whale@example.com", asset: "USDT", amount: 1545.50, fee: 77.28, txHash: "0xec65...5a8c", status: "PENDING", time: "5분 전" },
    { id: "wd-882", userId: "u2", email: "trader_vip@example.com", asset: "USDT", amount: 73.00, fee: 3.65, txHash: "0x91ad...8e00", status: "PENDING", time: "15분 전" },
    { id: "wd-881", userId: "u3", email: "crypto_guy@example.com", asset: "USDT", amount: 50.00, fee: 2.50, txHash: "0x88c2...fa90", status: "PENDING", time: "42분 전" },
  ]);

  // Fetch KST Countdown
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const cstTime = new Date(utc + (3600000 * 8)); // UTC+8
      
      const nextMidnightCst = new Date(cstTime);
      nextMidnightCst.setHours(24, 0, 0, 0);
      
      const difference = nextMidnightCst.getTime() - cstTime.getTime();
      
      if (difference <= 0) {
        setTimeLeft("00:00:00");
        return;
      }
      
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      
      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Pending Withdrawals from DB
  const fetchPendingWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const res = await fetch("/api/withdrawals");
      const result = await res.json();
      if (result.success && result.withdrawals && result.withdrawals.length > 0) {
        setPendingWithdrawals(result.withdrawals);
      }
    } catch (err) {
      console.error("API에서 대기 중인 출금 내역을 불러오지 못했습니다.", err);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  useEffect(() => {
    fetchPendingWithdrawals();
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm(`출금 요청 ${id}을(를) 승인하시겠습니까?`)) return;
    
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: id, action: "APPROVE" })
      });
      const result = await res.json();
      if (result.success) {
        alert("성공적으로 승인되었습니다.");
        fetchPendingWithdrawals();
      } else {
        alert(`승인 실패: ${result.error}`);
      }
    } catch (err) {
      alert("API 요청에 실패했습니다.");
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("사용자 잔고 반환을 위한 반려 사유를 입력하세요:");
    if (reason === null) return;

    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: id, action: "REJECT", reason })
      });
      const result = await res.json();
      if (result.success) {
        alert("성공적으로 반려 및 반환 처리되었습니다.");
        fetchPendingWithdrawals();
      } else {
        alert(`반려 실패: ${result.error}`);
      }
    } catch (err) {
      alert("API 요청에 실패했습니다.");
    }
  };

  const recentTransactions = [
    { id: "tx-1005", email: "investor@example.com", asset: "USDT", amount: "+250.00", type: "입금 (DEPOSIT)", hash: "0x5320...3a17", status: "완료", date: "15:24" },
    { id: "tx-1004", email: "active_whale@example.com", asset: "URC", amount: "-100.00", type: "스왑 아웃", hash: "내부 처리", status: "완료", date: "15:10", details: "수수료: 0.1 URC (0.1%)" },
    { id: "tx-1003", email: "active_whale@example.com", asset: "USDT", amount: "+99.90", type: "스왑 인", hash: "내부 처리", status: "완료", date: "15:10", details: "수수료: 0.1 USDT (0.1%)" },
    { id: "tx-1002", email: "trader_vip@example.com", asset: "USDT", amount: "-73.00", type: "출금 (WITHDRAW)", hash: "0x91ad...8e00", status: "대기 중", date: "15:02", details: "수수료: 3.65 USDT (5%)" },
    { id: "tx-1001", email: "min_user@example.com", asset: "USDT", amount: "-50.00", type: "출금 (WITHDRAW)", hash: "0x88c2...fa90", status: "대기 중", date: "14:42", details: "수수료: 2.50 USDT (5%)" },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">시스템 대시보드 <span className="text-xs text-[#8E8E93] font-normal">v1.1</span></h2>
          <p className="text-sm text-[#8E8E93] mt-1">실시간 자산 모니터링, 369 게임 보너스 플랜 로그 및 자동 정산 크론 상태</p>
        </div>
        
        {/* Countdown Timer Widget (v1.1 Daily Settlement) */}
        <div className="flex items-center space-x-4 bg-[#16161A] border border-[#26262B] p-3 px-4 rounded-xl shadow-md">
          <div className="flex items-center space-x-2 text-[#FF9F0A]">
            <Clock size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">일일 마감 (CST)</span>
          </div>
          <div className="border-l border-[#26262B] pl-4">
            <span className="text-base font-mono font-bold text-white">{timeLeft || "계산 중..."}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1: Total Deposit */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">금일 총 입금액</p>
            <h3 className="text-2xl font-extrabold text-white">48,250.00 USDT</h3>
            <p className="text-[11px] text-[#30D5C8] font-medium">전일 대비 +18.5%</p>
          </div>
          <div className="w-12 h-12 bg-[#30D5C8]/10 rounded-xl flex items-center justify-center text-[#30D5C8]">
            <ArrowDownLeft size={24} />
          </div>
        </div>

        {/* Stat 2: Total Withdrawal */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">금일 총 출금액</p>
            <h3 className="text-2xl font-extrabold text-white">16,215.50 USDT</h3>
            <p className="text-[11px] text-[#FF453A] font-medium">전일 대비 -1.2%</p>
          </div>
          <div className="w-12 h-12 bg-[#FF453A]/10 rounded-xl flex items-center justify-center text-[#FF453A]">
            <ArrowUpRight size={24} />
          </div>
        </div>

        {/* Stat 3: Active Users */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">활성 회원 수 (결제 완료)</p>
            <h3 className="text-2xl font-extrabold text-white">842 명</h3>
            <p className="text-[11px] text-[#8E8E93]">128명 대기 중 (미결제)</p>
          </div>
          <div className="w-12 h-12 bg-[#00D2FF]/10 rounded-xl flex items-center justify-center text-[#00D2FF]">
            <Users size={24} />
          </div>
        </div>

        {/* Stat 4: platform earnings */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">누적 플랫폼 수수료 수익</p>
            <h3 className="text-2xl font-extrabold text-white">2,482.90 USD</h3>
            <p className="text-[11px] text-[#BF5AF2] font-medium">USDT-URC 스왑 수수료: 0.1%</p>
          </div>
          <div className="w-12 h-12 bg-[#BF5AF2]/10 rounded-xl flex items-center justify-center text-[#BF5AF2]">
            <Percent size={24} />
          </div>
        </div>
      </div>

      {/* Analytics & Verification Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Custom Trend Chart Card */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 lg:col-span-2 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">일일 자산 흐름 추이</h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">입금 vs 출금 (최근 7일)</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 bg-[#00D2FF] rounded-full inline-block" />
                <span className="text-[#8E8E93]">입금</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 bg-[#BF5AF2] rounded-full inline-block" />
                <span className="text-[#8E8E93]">출금</span>
              </div>
            </div>
          </div>

          {/* SVG Custom Chart Canvas */}
          <div className="relative w-full h-48 bg-[#121215]/40 rounded-xl border border-[#26262B]/50 flex items-end p-2">
            <div className="absolute inset-0 flex flex-col justify-between p-4 py-8 pointer-events-none">
              <div className="w-full h-[1px] bg-[#26262B]/30" />
              <div className="w-full h-[1px] bg-[#26262B]/30" />
              <div className="w-full h-[1px] bg-[#26262B]/30" />
            </div>
            <svg viewBox="0 0 600 160" className="w-full h-full">
              <path
                d="M 0 130 Q 100 110, 200 80 T 400 40 T 600 20"
                fill="none"
                stroke="#00D2FF"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M 0 130 Q 100 110, 200 80 T 400 40 T 600 20 L 600 160 L 0 160 Z"
                fill="url(#gradient-cyan)"
                opacity="0.08"
              />
              <path
                d="M 0 145 Q 100 135, 200 120 T 400 90 T 600 70"
                fill="none"
                stroke="#BF5AF2"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M 0 145 Q 100 135, 200 120 T 400 90 T 600 70 L 600 160 L 0 160 Z"
                fill="url(#gradient-violet)"
                opacity="0.05"
              />
              <defs>
                <linearGradient id="gradient-cyan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D2FF" />
                  <stop offset="100%" stopColor="#00D2FF" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gradient-violet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#BF5AF2" />
                  <stop offset="100%" stopColor="#BF5AF2" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="flex justify-between text-[10px] text-[#8E8E93] font-medium mt-3 px-2">
            <span>07/14</span>
            <span>07/15</span>
            <span>07/16</span>
            <span>07/17</span>
            <span>07/18</span>
            <span>07/19</span>
            <span>07/20</span>
          </div>
        </div>

        {/* Pending Withdrawals Action Panel */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">출금 대기 목록</h4>
              <button 
                onClick={fetchPendingWithdrawals}
                disabled={loadingWithdrawals}
                className="text-[#00D2FF] hover:opacity-85"
              >
                <RefreshCw size={14} className={loadingWithdrawals ? "animate-spin" : ""} />
              </button>
            </div>
            <p className="text-[11px] text-[#8E8E93]">관리자 승인이 필요합니다. (최소 출금액: $50)</p>
            
            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
              {pendingWithdrawals.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8E8E93] flex flex-col items-center justify-center space-y-2">
                  <CheckCircle size={24} className="text-[#30D5C8]" />
                  <span>대기 중인 출금 요청이 없습니다.</span>
                </div>
              ) : (
                pendingWithdrawals.map((wd) => {
                  const finalTransfer = wd.amount - wd.fee;
                  return (
                    <div key={wd.id} className="p-3.5 bg-[#121215]/60 rounded-xl border border-[#26262B] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white block truncate w-[130px]">{wd.email}</span>
                        <span className="text-[10px] text-[#8E8E93]">{wd.time}</span>
                      </div>
                      
                      <div className="flex justify-between items-end bg-[#16161A]/80 p-2 rounded-lg border border-[#26262B]/50">
                        <div>
                          <p className="text-[9px] text-[#8E8E93] uppercase font-semibold">요청 금액</p>
                          <p className="text-xs font-bold text-white">${wd.amount.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-[#FF9F0A] uppercase font-semibold">수수료 (5%)</p>
                          <p className="text-[10px] font-semibold text-[#FF9F0A]">${wd.fee.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-[#30D5C8] uppercase font-semibold">실 지급액</p>
                          <p className="text-xs font-bold text-[#30D5C8]">${finalTransfer.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="text-[10px] text-[#8E8E93] flex items-center space-x-1.5">
                        <span className="bg-[#26262B] text-white px-1.5 py-0.5 rounded font-mono text-[9px] truncate block max-w-full">{wd.txHash}</span>
                      </div>

                      <div className="flex space-x-2 pt-1 border-t border-[#26262B]/50">
                        <button 
                          onClick={() => handleApprove(wd.id)}
                          className="flex-1 py-1.5 bg-[#30D5C8]/10 text-[#30D5C8] hover:bg-[#30D5C8]/20 text-[10px] font-bold rounded-lg transition-all"
                        >
                          승인
                        </button>
                        <button 
                          onClick={() => handleReject(wd.id)}
                          className="flex-1 py-1.5 bg-[#FF453A]/10 text-[#FF453A] hover:bg-[#FF453A]/20 text-[10px] font-bold rounded-lg transition-all"
                        >
                          반려
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <button className="w-full py-2.5 bg-[#1C1C21] hover:bg-[#26262B] text-xs font-semibold rounded-xl mt-4 flex items-center justify-center space-x-1 text-[#00D2FF] transition-all">
            <span>대기 중인 모든 거래 보기</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Recent Ledger Entries Grid */}
      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">최근 원장(Ledger) 내역</h4>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">실시간 시스템 트랜잭션 기록 (URC 스왑 및 수수료 포함)</p>
          </div>
          <button className="px-3.5 py-1.5 bg-[#1C1C21] border border-[#26262B] hover:bg-[#26262B] text-[11px] font-semibold rounded-lg text-[#00D2FF] transition-all">
            원장 감사(Audit)
          </button>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider pb-3">
                <th className="py-3 px-4">Tx ID</th>
                <th className="py-3 px-4">사용자 이메일</th>
                <th className="py-3 px-4">자산</th>
                <th className="py-3 px-4">금액</th>
                <th className="py-3 px-4">유형</th>
                <th className="py-3 px-4">상세 내역 / 수수료</th>
                <th className="py-3 px-4">Tx 해시</th>
                <th className="py-3 px-4">상태</th>
                <th className="py-3 px-4 text-right">시간</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                  <td className="py-4 px-4 font-semibold text-white">{tx.id}</td>
                  <td className="py-4 px-4 text-white font-medium">{tx.email}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      tx.asset === 'USDT' ? 'bg-[#26A17B]/10 text-[#26A17B]' : 
                      tx.asset === 'URC' ? 'bg-[#BF5AF2]/10 text-[#BF5AF2]' : 
                      'bg-[#F0B90B]/10 text-[#F0B90B]'
                    }`}>
                      {tx.asset}
                    </span>
                  </td>
                  <td className={`py-4 px-4 font-bold ${tx.amount.startsWith('+') ? 'text-[#30D5C8]' : 'text-[#FF9F0A]'}`}>{tx.amount}</td>
                  <td className="py-4 px-4 text-[#8E8E93] font-medium">{tx.type}</td>
                  <td className="py-4 px-4 text-[#8E8E93]">{tx.details || "-"}</td>
                  <td className="py-4 px-4">
                    {tx.hash === "내부 처리" ? (
                      <span className="text-[#8E8E93] italic text-[10px]">내부 처리</span>
                    ) : (
                      <a href="#" className="text-[#00D2FF] hover:underline flex items-center space-x-1">
                        <span>{tx.hash}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {tx.status === "완료" && (
                      <span className="flex items-center space-x-1 text-[#30D5C8] font-semibold">
                        <CheckCircle size={12} />
                        <span>완료</span>
                      </span>
                    )}
                    {tx.status === "대기 중" && (
                      <span className="flex items-center space-x-1 text-[#FF9F0A] font-semibold">
                        <Clock size={12} />
                        <span>대기 중</span>
                      </span>
                    )}
                    {tx.status === "실패" && (
                      <span className="flex items-center space-x-1 text-[#FF453A] font-semibold">
                        <XCircle size={12} />
                        <span>실패</span>
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-[#8E8E93] text-right">{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
