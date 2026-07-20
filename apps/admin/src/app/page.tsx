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

export default function DashboardPage() {
  // State for mock real-time countdown to daily settlement (00:00 KST)
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      // KST is UTC+9. We calculate the time remaining until the next 00:00 KST.
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const kstTime = new Date(utc + (3600000 * 9));
      
      const nextMidnightKst = new Date(kstTime);
      nextMidnightKst.setHours(24, 0, 0, 0);
      
      const difference = nextMidnightKst.getTime() - kstTime.getTime();
      
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

  // Mock Data aligned with v1.1 Specs
  // Swap fee: 0.1%, Withdraw fee: 5% (min $50, any decimal allowed above $50)
  const [pendingWithdrawals, setPendingWithdrawals] = useState([
    { id: "wd-883", email: "active_whale@example.com", asset: "USDT", amount: 1545.50, target: "0xec65...5a8c", time: "5 mins ago" },
    { id: "wd-882", email: "trader_vip@example.com", asset: "USDT", amount: 73.00, target: "0x91ad...8e00", time: "15 mins ago" },
    { id: "wd-881", email: "crypto_guy@example.com", asset: "USDT", amount: 50.00, target: "0x88c2...fa90", time: "42 mins ago" },
  ]);

  const recentTransactions = [
    { id: "tx-1005", email: "investor@example.com", asset: "USDT", amount: "+250.00", type: "DEPOSIT", hash: "0x5320...3a17", status: "COMPLETED", date: "15:24" },
    { id: "tx-1004", email: "active_whale@example.com", asset: "URC", amount: "-100.00", type: "SWAP_OUT", hash: "Internal", status: "COMPLETED", date: "15:10", details: "Fee: 0.1 URC (0.1%)" },
    { id: "tx-1003", email: "active_whale@example.com", asset: "USDT", amount: "+99.90", type: "SWAP_IN", hash: "Internal", status: "COMPLETED", date: "15:10", details: "Fee: 0.1 USDT (0.1%)" },
    { id: "tx-1002", email: "trader_vip@example.com", asset: "USDT", amount: "-73.00", type: "WITHDRAW", hash: "0x91ad...8e00", status: "PENDING", date: "15:02", details: "Fee: 3.65 USDT (5%)" },
    { id: "tx-1001", email: "min_user@example.com", asset: "USDT", amount: "-50.00", type: "WITHDRAW", hash: "0x88c2...fa90", status: "PENDING", date: "14:42", details: "Fee: 2.50 USDT (5%)" },
    { id: "tx-1000", email: "earner@example.com", asset: "USDT", amount: "+450.00", type: "REFERRAL_BONUS", hash: "Internal", status: "COMPLETED", date: "Yesterday" },
  ];

  const handleApprove = (id: string) => {
    alert(`Withdrawal request ${id} approved. Triggering blockchain hot-wallet sign engine.`);
    setPendingWithdrawals(pendingWithdrawals.filter(w => w.id !== id));
  };

  const handleReject = (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (reason !== null) {
      alert(`Withdrawal request ${id} rejected. Refunding locked balance to user.`);
      setPendingWithdrawals(pendingWithdrawals.filter(w => w.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Dashboard <span className="text-xs text-[#8E8E93] font-normal">v1.1</span></h2>
          <p className="text-sm text-[#8E8E93] mt-1">Real-time asset monitors, 369 game bonus plan logs, and automated settlement cron status.</p>
        </div>
        
        {/* Countdown Timer Widget (v1.1 Daily Settlement) */}
        <div className="flex items-center space-x-4 bg-[#16161A] border border-[#26262B] p-3 px-4 rounded-xl shadow-md">
          <div className="flex items-center space-x-2 text-[#FF9F0A]">
            <Clock size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">Daily Close KST</span>
          </div>
          <div className="border-l border-[#26262B] pl-4">
            <span className="text-base font-mono font-bold text-white">{timeLeft || "Calculating..."}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1: Total Deposit */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Total Deposit Today</p>
            <h3 className="text-2xl font-extrabold text-white">48,250.00 USDT</h3>
            <p className="text-[11px] text-[#30D5C8] font-medium">+18.5% from yesterday</p>
          </div>
          <div className="w-12 h-12 bg-[#30D5C8]/10 rounded-xl flex items-center justify-center text-[#30D5C8]">
            <ArrowDownLeft size={24} />
          </div>
        </div>

        {/* Stat 2: Total Withdrawal */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Total Withdrawal Today</p>
            <h3 className="text-2xl font-extrabold text-white">16,215.50 USDT</h3>
            <p className="text-[11px] text-[#FF453A] font-medium">-1.2% from yesterday</p>
          </div>
          <div className="w-12 h-12 bg-[#FF453A]/10 rounded-xl flex items-center justify-center text-[#FF453A]">
            <ArrowUpRight size={24} />
          </div>
        </div>

        {/* Stat 3: Active Users */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Active Members (Paid)</p>
            <h3 className="text-2xl font-extrabold text-white">842 Users</h3>
            <p className="text-[11px] text-[#8E8E93]">128 Pending (Unpaid)</p>
          </div>
          <div className="w-12 h-12 bg-[#00D2FF]/10 rounded-xl flex items-center justify-center text-[#00D2FF]">
            <Users size={24} />
          </div>
        </div>

        {/* Stat 4: platform earnings */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Accumulated Platform Fees</p>
            <h3 className="text-2xl font-extrabold text-white">2,482.90 USD</h3>
            <p className="text-[11px] text-[#BF5AF2] font-medium">USDT-URC Swap Fee: 0.1%</p>
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
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Daily Asset Flow Trend</h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">Deposit vs Withdrawal (Last 7 Days)</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 bg-[#00D2FF] rounded-full inline-block" />
                <span className="text-[#8E8E93]">Deposit</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 bg-[#BF5AF2] rounded-full inline-block" />
                <span className="text-[#8E8E93]">Withdrawal</span>
              </div>
            </div>
          </div>

          {/* SVG Custom Chart Canvas */}
          <div className="relative w-full h-48 bg-[#121215]/40 rounded-xl border border-[#26262B]/50 flex items-end p-2">
            {/* Background grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 py-8 pointer-events-none">
              <div className="w-full h-[1px] bg-[#26262B]/30" />
              <div className="w-full h-[1px] bg-[#26262B]/30" />
              <div className="w-full h-[1px] bg-[#26262B]/30" />
            </div>
            {/* Custom High-Fidelity SVG Path Chart */}
            <svg viewBox="0 0 600 160" className="w-full h-full">
              {/* Deposit Path (Cyan) */}
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
              {/* Withdraw Path (Violet) */}
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
              {/* Gradients Definition */}
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

        {/* Pending Withdrawals Quick Action Panel (v1.1 Aligned) */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Pending Withdrawals</h4>
              <span className="text-[10px] bg-[#FF9F0A]/10 text-[#FF9F0A] px-2 py-0.5 rounded-full border border-[#FF9F0A]/20">
                Fee: 5%
              </span>
            </div>
            <p className="text-[11px] text-[#8E8E93]">Requires review. Minimum withdrawal: $50.</p>
            
            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
              {pendingWithdrawals.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8E8E93] flex flex-col items-center justify-center space-y-2">
                  <CheckCircle size={24} className="text-[#30D5C8]" />
                  <span>No pending withdrawals left.</span>
                </div>
              ) : (
                pendingWithdrawals.map((wd) => {
                  const fee = wd.amount * 0.05;
                  const finalTransfer = wd.amount - fee;
                  return (
                    <div key={wd.id} className="p-3.5 bg-[#121215]/60 rounded-xl border border-[#26262B] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-white">{wd.email}</span>
                        <span className="text-[10px] text-[#8E8E93]">{wd.time}</span>
                      </div>
                      
                      <div className="flex justify-between items-end bg-[#16161A]/80 p-2 rounded-lg border border-[#26262B]/50">
                        <div>
                          <p className="text-[9px] text-[#8E8E93] uppercase font-semibold">Request Amt</p>
                          <p className="text-sm font-bold text-white">${wd.amount.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-[#FF9F0A] uppercase font-semibold">Fee (5%)</p>
                          <p className="text-xs font-semibold text-[#FF9F0A]">${fee.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-[#30D5C8] uppercase font-semibold">Final Send</p>
                          <p className="text-sm font-bold text-[#30D5C8]">${finalTransfer.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="text-[10px] text-[#8E8E93] flex items-center space-x-1.5">
                        <span className="bg-[#26262B] text-white px-1.5 py-0.5 rounded font-mono text-[9px]">{wd.target}</span>
                      </div>

                      <div className="flex space-x-2 pt-1 border-t border-[#26262B]/50">
                        <button 
                          onClick={() => handleApprove(wd.id)}
                          className="flex-1 py-1.5 bg-[#30D5C8]/10 text-[#30D5C8] hover:bg-[#30D5C8]/20 text-[10px] font-bold rounded-lg transition-all"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleReject(wd.id)}
                          className="flex-1 py-1.5 bg-[#FF453A]/10 text-[#FF453A] hover:bg-[#FF453A]/20 text-[10px] font-bold rounded-lg transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <button className="w-full py-2.5 bg-[#1C1C21] hover:bg-[#26262B] text-xs font-semibold rounded-xl mt-4 flex items-center justify-center space-x-1 text-[#00D2FF] transition-all">
            <span>View All Pending Transactions</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Recent Ledger Entries Grid */}
      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Recent Ledger Activities</h4>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">Real-time system transaction ledger entries (including URC 스왑 및 수수료).</p>
          </div>
          <button className="px-3.5 py-1.5 bg-[#1C1C21] border border-[#26262B] hover:bg-[#26262B] text-[11px] font-semibold rounded-lg text-[#00D2FF] transition-all">
            Audit Ledger
          </button>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider pb-3">
                <th className="py-3 px-4">Tx ID</th>
                <th className="py-3 px-4">User Email</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Details / Fee</th>
                <th className="py-3 px-4">Tx Hash</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Time</th>
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
                    {tx.hash === "Internal" ? (
                      <span className="text-[#8E8E93] italic text-[10px]">Internal Swap</span>
                    ) : (
                      <a href="#" className="text-[#00D2FF] hover:underline flex items-center space-x-1">
                        <span>{tx.hash}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {tx.status === "COMPLETED" && (
                      <span className="flex items-center space-x-1 text-[#30D5C8] font-semibold">
                        <CheckCircle size={12} />
                        <span>Completed</span>
                      </span>
                    )}
                    {tx.status === "PENDING" && (
                      <span className="flex items-center space-x-1 text-[#FF9F0A] font-semibold">
                        <Clock size={12} />
                        <span>Pending</span>
                      </span>
                    )}
                    {tx.status === "FAILED" && (
                      <span className="flex items-center space-x-1 text-[#FF453A] font-semibold">
                        <XCircle size={12} />
                        <span>Failed</span>
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
