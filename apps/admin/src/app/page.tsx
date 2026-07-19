import React from "react";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Users, 
  Percent, 
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  ChevronRight
} from "lucide-react";

export default function DashboardPage() {
  // Mock Data for Ledger
  const recentTransactions = [
    { id: "tx-1002", email: "investor@example.com", asset: "USDT", amount: "+500.00", type: "DEPOSIT", hash: "0x39a1...12ef", status: "COMPLETED", date: "14:24" },
    { id: "tx-1001", email: "trader_kr@example.com", asset: "MYTOKEN", amount: "-10,000.00", type: "SWAP_OUT", hash: "Internal", status: "COMPLETED", date: "12:10" },
    { id: "tx-1000", email: "crypto_guy@example.com", asset: "USDT", amount: "-150.00", type: "WITHDRAW", hash: "0x88c2...fa90", status: "PENDING", date: "11:45" },
    { id: "tx-0999", email: "whale@example.com", asset: "BNB", amount: "+2.50", type: "DEPOSIT", hash: "0x54d1...ff41", status: "COMPLETED", date: "09:12" },
    { id: "tx-0998", email: "beginner@example.com", asset: "USDT", amount: "+100.00", type: "DEPOSIT", hash: "0x77d1...99bb", status: "FAILED", date: "Yesterday" },
  ];

  const pendingWithdrawals = [
    { id: "wd-882", email: "vip_user@example.com", asset: "USDT", amount: "5,000.00", target: "0x991b...772a", time: "10 mins ago" },
    { id: "wd-881", email: "crypto_guy@example.com", asset: "USDT", amount: "150.00", target: "0x88c2...fa90", time: "45 mins ago" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Dashboard</h2>
          <p className="text-sm text-[#8E8E93] mt-1">Real-time assets, ledger flow, and node operation stats.</p>
        </div>
        <div className="flex space-x-3">
          <button className="px-4 py-2 bg-[#1C1C21] border border-[#26262B] text-xs font-semibold rounded-lg hover:bg-[#26262B] transition-all">
            Download CSV Report
          </button>
          <button className="px-4 py-2 bg-[#00D2FF] text-[#0C0C0E] text-xs font-bold rounded-lg hover:opacity-90 shadow-[0_4px_12px_rgba(0,210,255,0.2)] transition-all">
            Force Sweep All
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1 */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Total Deposit Today</p>
            <h3 className="text-2xl font-extrabold text-white">$25,245.00</h3>
            <p className="text-[11px] text-[#30D5C8] font-medium">+14.2% from yesterday</p>
          </div>
          <div className="w-12 h-12 bg-[#30D5C8]/10 rounded-xl flex items-center justify-center text-[#30D5C8]">
            <ArrowDownLeft size={24} />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Total Withdrawal Today</p>
            <h3 className="text-2xl font-extrabold text-white">$12,480.00</h3>
            <p className="text-[11px] text-[#FF453A] font-medium">-2.1% from yesterday</p>
          </div>
          <div className="w-12 h-12 bg-[#FF453A]/10 rounded-xl flex items-center justify-center text-[#FF453A]">
            <ArrowUpRight size={24} />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">New Registrations</p>
            <h3 className="text-2xl font-extrabold text-white">142 Users</h3>
            <p className="text-[11px] text-[#30D5C8] font-medium">+8.5% weekly growth</p>
          </div>
          <div className="w-12 h-12 bg-[#00D2FF]/10 rounded-xl flex items-center justify-center text-[#00D2FF]">
            <Users size={24} />
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 flex items-center justify-between shadow-lg">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">Accumulated Swap Fees</p>
            <h3 className="text-2xl font-extrabold text-white">$2,145.89</h3>
            <p className="text-[11px] text-[#BF5AF2] font-medium">Avg. fee rate: 0.2%</p>
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
                <span className="text-[#8E8E93]">Withdraw</span>
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
            <span>07/13</span>
            <span>07/14</span>
            <span>07/15</span>
            <span>07/16</span>
            <span>07/17</span>
            <span>07/18</span>
            <span>07/19</span>
          </div>
        </div>

        {/* Pending Withdrawals Quick Action Panel */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Pending Approval</h4>
            <p className="text-[11px] text-[#8E8E93]">Actions required for hot wallet release.</p>
            
            <div className="mt-4 space-y-3">
              {pendingWithdrawals.map((wd) => (
                <div key={wd.id} className="p-3.5 bg-[#121215]/60 rounded-xl border border-[#26262B] space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">{wd.email}</span>
                    <span className="text-[10px] text-[#8E8E93]">{wd.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-[#FF9F0A]">{wd.amount} {wd.asset}</span>
                    <span className="text-[10px] bg-[#26262B] text-[#AEAEB2] px-2 py-0.5 rounded font-mono">{wd.target}</span>
                  </div>
                  <div className="flex space-x-2 pt-1.5 border-t border-[#26262B]/50">
                    <button className="flex-1 py-1.5 bg-[#30D5C8]/10 text-[#30D5C8] hover:bg-[#30D5C8]/20 text-[10px] font-bold rounded-lg transition-all">
                      Approve
                    </button>
                    <button className="flex-1 py-1.5 bg-[#FF453A]/10 text-[#FF453A] hover:bg-[#FF453A]/20 text-[10px] font-bold rounded-lg transition-all">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <button className="w-full py-2.5 bg-[#1C1C21] hover:bg-[#26262B] text-xs font-semibold rounded-xl mt-4 flex items-center justify-center space-x-1 text-[#00D2FF] transition-all">
            <span>View All Withdrawals</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Recent Ledger Entries Grid */}
      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Recent Ledger Activities</h4>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">Real-time system transaction ledger entries.</p>
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
                      tx.asset === 'MYTOKEN' ? 'bg-[#BF5AF2]/10 text-[#BF5AF2]' : 
                      'bg-[#F0B90B]/10 text-[#F0B90B]'
                    }`}>
                      {tx.asset}
                    </span>
                  </td>
                  <td className={`py-4 px-4 font-bold ${tx.amount.startsWith('+') ? 'text-[#30D5C8]' : 'text-[#FF9F0A]'}`}>{tx.amount}</td>
                  <td className="py-4 px-4 text-[#8E8E93] font-medium">{tx.type}</td>
                  <td className="py-4 px-4">
                    {tx.hash === "Internal" ? (
                      <span className="text-[#8E8E93] italic">Internal Swap</span>
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
