"use client";

import React, { useState, useEffect } from "react";
import { Activity, Search, RefreshCw, CheckCircle, ArrowUpRight, ArrowDownLeft, Gift, Coins } from "lucide-react";

interface Transaction {
  id: string;
  userEmail: string;
  userNickname: string;
  asset: string;
  amount: number;
  type: string;
  status: string;
  hash: string | null;
  details: any;
  createdAt: string;
}

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/transactions?limit=200");
      const data = await res.json();
      if (data.success && data.transactions) {
        setTransactions(data.transactions);
      } else {
        setTransactions([]);
      }
    } catch (e) {
      console.error("트랜잭션 내역 조회 실패", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filtered = transactions.filter(tx => 
    tx.userEmail.includes(searchTerm) || 
    tx.userNickname.includes(searchTerm) || 
    tx.type.includes(searchTerm) || 
    tx.asset.includes(searchTerm) ||
    (tx.hash && tx.hash.includes(searchTerm))
  );

  return (
    <div className="space-y-8 font-sans">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">전체 거래 내역 (통합 장부)</h2>
          <p className="text-sm text-[#8E8E93] mt-1">시스템 내 모든 유저의 입출금, 수당, 스왑 및 게임 보상 내역을 실시간으로 확인합니다.</p>
        </div>
        <button 
          onClick={fetchTransactions}
          className="flex items-center space-x-1.5 px-3 py-2 bg-[#26262B] hover:bg-[#3A3A40] text-[#8E8E93] rounded-lg text-xs transition-colors"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>새로고침</span>
        </button>
      </div>

      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
            <Activity size={16} className="mr-2 text-[#00D2FF]" />
            전체 장부 기록 ({filtered.length}건)
          </h4>
          
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8E8E93]">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="이메일, 닉네임, 자산, 해시 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#00D2FF] pl-9 pr-3 py-2 rounded-lg text-xs text-white outline-none transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider pb-3">
                <th className="py-3 px-4">Tx ID</th>
                <th className="py-3 px-4">유저 (닉네임/이메일)</th>
                <th className="py-3 px-4 text-center">자산</th>
                <th className="py-3 px-4 text-right">수량</th>
                <th className="py-3 px-4">유형</th>
                <th className="py-3 px-4">상세 내역</th>
                <th className="py-3 px-4">Tx Hash</th>
                <th className="py-3 px-4 text-center">상태</th>
                <th className="py-3 px-4 text-right">시간</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#8E8E93]">거래 데이터를 불러오는 중...</td>
                </tr>
              ) : filtered.map((tx) => (
                <tr key={tx.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                  <td className="py-4 px-4 font-semibold text-[#8E8E93] font-mono text-[10px]">
                    {tx.id.split('-')[0]}...
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-white">{tx.userNickname}</div>
                    <div className="text-[10px] text-[#8E8E93]">{tx.userEmail}</div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      tx.asset === 'USDT' ? 'bg-[#26A17B]/10 text-[#26A17B] border border-[#26A17B]/20' : 
                      tx.asset === 'BAO' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border border-[#0ECB81]/20' : 
                      tx.asset === 'JADE' ? 'bg-[#30D5C8]/10 text-[#30D5C8] border border-[#30D5C8]/20' : 
                      tx.asset === 'HONGBAO' ? 'bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/20' : 
                      'bg-[#BF5AF2]/10 text-[#BF5AF2] border border-[#BF5AF2]/20'
                    }`}>
                      {tx.asset}
                    </span>
                  </td>
                  <td className={`py-4 px-4 text-right font-bold font-mono ${tx.amount > 0 ? 'text-[#30D5C8]' : 'text-[#FF453A]'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-1">
                      {tx.type === 'DEPOSIT' && <ArrowDownLeft size={12} className="text-[#30D5C8]" />}
                      {tx.type === 'WITHDRAW' && <ArrowUpRight size={12} className="text-[#FF453A]" />}
                      {(tx.type.includes('BONUS') || tx.type === 'GAME_CONSOLATION') && <Gift size={12} className="text-[#BF5AF2]" />}
                      {tx.type.includes('SWAP') && <RefreshCw size={12} className="text-[#FF9F0A]" />}
                      <span className="text-[#EAECEF] text-[10px]">{tx.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#8E8E93] text-[10px] max-w-[150px] truncate" title={JSON.stringify(tx.details)}>
                    {tx.details ? JSON.stringify(tx.details) : "-"}
                  </td>
                  <td className="py-4 px-4">
                    {tx.hash ? (
                      <a href={`https://testnet.bscscan.com/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-[#00D2FF] hover:underline font-mono text-[10px]">
                        {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                      </a>
                    ) : (
                      <span className="text-[#8E8E93] italic text-[10px]">내부 처리</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center">
                    {tx.status === "COMPLETED" ? (
                      <span className="inline-flex items-center space-x-1 text-[#30D5C8] font-bold text-[10px]">
                        <CheckCircle size={10} />
                        <span>완료</span>
                      </span>
                    ) : tx.status === "PENDING" ? (
                      <span className="inline-flex items-center space-x-1 text-[#FF9F0A] font-bold text-[10px]">
                        <RefreshCw size={10} className="animate-spin" />
                        <span>대기</span>
                      </span>
                    ) : (
                      <span className="text-[#F6465D] font-bold text-[10px]">실패</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right text-[10px] text-[#8E8E93]">
                    {tx.createdAt}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#8E8E93]">조회된 거래 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
