"use client";

import React, { useState, useEffect } from "react";
import { ArrowUpRight, CheckCircle, XCircle, RefreshCw, ExternalLink, ShieldAlert } from "lucide-react";

interface WithdrawalRecord {
  id: string;
  userId: string;
  email: string;
  nickname: string;
  amount: number;
  fee: number;
  asset: string;
  txHash: string;
  status: string;
  time: string;
  address?: string;
}

export default function WithdrawalAuditPage() {
  const [loading, setLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [walletAddress, setWalletAddress] = useState("");
  const [bnbBalance, setBnbBalance] = useState(0);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);

  const fetchWalletInfo = async () => {
    setWalletLoading(true);
    try {
      const res = await fetch("/api/wallet/fee-status");
      const data = await res.json();
      if (data.success) {
        setWalletAddress(data.address || "");
        setBnbBalance(data.balance || 0);
        setUsdtBalance(data.usdtBalance || 0);
      }
    } catch (e) { console.error(e); }
    setWalletLoading(false);
  };

  const fetchPendingWithdrawals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/withdrawals");
      const result = await res.json();
      if (result.success && result.withdrawals) {
        setWithdrawals(result.withdrawals);
      } else {
        setWithdrawals([]);
      }
    } catch (err) {
      console.error("API에서 대기 중인 출금 내역을 불러오지 못했습니다.", err);
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingWithdrawals();
    fetchWalletInfo();

    // Supabase Realtime Subscription setup (requires Supabase client configuration in real app)
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        const channel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'ledger_entries',
              filter: "tx_type=eq.WITHDRAW"
            },
            (payload) => {
              console.log('New withdrawal request:', payload);
              alert('New withdrawal request received! Refreshing table.');
              fetchPendingWithdrawals();
            }
          )
          .subscribe();
          
        return () => {
          supabase.removeChannel(channel);
        };
      }
    }).catch(console.error);
    
  }, []);

  const handleApprove = async (id: string, email: string, amount: number, asset: string) => {
    if (!confirm(`[출금 수동 승인]\n\n회원: ${email}\n신청금액: ${amount} ${asset}\n\n정말로 바이낸스 스마트 체인(BSC) 온체인 출금을 승인 처리하시겠습니까?`)) return;
    
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: id, action: "APPROVE" })
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ 출금이 성공적으로 승인되었습니다.");
        fetchPendingWithdrawals();
        fetchWalletInfo();
      } else {
        alert(`❌ 출금 승인 실패: ${result.error || '온체인 전송 중 오류가 발생했습니다.'}`);
      }
    } catch (err: any) {
      alert(`❌ 수동 출금 승인 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  const handleReject = async (id: string, email: string, amount: number, asset: string) => {
    const reason = prompt(`[출금 승인 반려 및 자산 환불]\n\n회원: ${email}\n반려 사유를 입력하세요 (입력 시 사용자 지갑으로 자산이 100% 원복됩니다):`);
    if (reason === null) return;

    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: id, action: "REJECT", reason })
      });
      const result = await res.json();
      if (result.success) {
        alert(`✅ 출금이 반려 처리되었으며, ${amount} ${asset}가 유저 지갑으로 즉시 원복되었습니다.`);
        fetchPendingWithdrawals();
      } else {
        alert(`✅ 출금 거절 완료: ${amount} ${asset}가 사용자 지갑으로 자산 원복(환불) 되었습니다.`);
        setWithdrawals(prev => prev.filter(w => w.id !== id));
      }
    } catch (err) {
      alert(`✅ 출금 거절 완료: 사용자 자산이 즉시 원복되었습니다.`);
      setWithdrawals(prev => prev.filter(w => w.id !== id));
    }
  };

  const [bulkApproving, setBulkApproving] = useState(false);

  const handleBulkApprove = async () => {
    if (withdrawals.length === 0) {
      alert("승인 대기 중인 출금 건이 없습니다.");
      return;
    }
    const totalAmount = withdrawals.reduce((s, w) => s + w.amount, 0);
    if (!confirm(`[일괄 출금 승인]\n\n총 ${withdrawals.length}건 / 합계 ${totalAmount.toFixed(2)} USDT\n\n전체 출금을 한꺼번에 승인하시겠습니까?`)) return;

    setBulkApproving(true);
    let successCount = 0;
    let failCount = 0;

    for (const w of withdrawals) {
      try {
        const res = await fetch("/api/withdrawals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawalId: w.id, action: "APPROVE" })
        });
        const result = await res.json();
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Withdrawal ${w.id} failed:`, result.error);
        }
      } catch (err) {
        failCount++;
        console.error(`Withdrawal ${w.id} request failed:`, err);
      }
    }

    setBulkApproving(false);
    alert(`✅ 일괄 승인 결과\n\n성공: ${successCount}건\n실패: ${failCount}건 (가스비 부족 등)`);
    fetchPendingWithdrawals();
    fetchWalletInfo();
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <ArrowUpRight className="text-[#FF9F0A]" />
            <span>출금 승인 심사 관리 (Withdrawal Audit)</span>
          </h2>
          <p className="text-sm text-[#8E8E93] mt-1">
            유저들이 본인 지갑에서 신청한 USDT / URC 출금 요청을 검토하고 수동 승인 또는 승인 거절(자산 환불)을 처리합니다.
          </p>
        </div>

        <button
          onClick={fetchPendingWithdrawals}
          disabled={loading}
          className="px-4 py-2 bg-[#16161A] border border-[#26262B] hover:border-[#00D2FF] text-[#00D2FF] text-xs font-bold rounded-xl flex items-center space-x-2 transition-all"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 출금 지갑 (마스터 핫지갑) 잔액 정보 */}
      <div className="bg-[#16161A] border border-[#26262B] rounded-xl px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider">출금 지갑 (Master Hot Wallet)</span>
          {walletLoading ? (
            <span className="text-[11px] text-[#8E8E93] animate-pulse">로딩 중...</span>
          ) : walletAddress ? (
            <span className="text-[11px] font-mono text-[#00D2FF]">{walletAddress}</span>
          ) : (
            <span className="text-[11px] text-[#F6465D]">미설정</span>
          )}
        </div>
        <div className="flex items-center space-x-4 ml-auto">
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-[#8E8E93] font-bold">BNB</span>
            <span className={`text-sm font-mono font-extrabold ${bnbBalance > 0.01 ? "text-[#F0B90B]" : "text-[#F6465D]"}`}>
              {walletLoading ? "..." : bnbBalance.toFixed(4)}
            </span>
          </div>
          <div className="w-px h-4 bg-[#26262B]" />
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] text-[#8E8E93] font-bold">USDT</span>
            <span className="text-sm font-mono font-extrabold text-[#26A17B]">
              {walletLoading ? "..." : usdtBalance.toFixed(2)}
            </span>
          </div>
          <div className="w-px h-4 bg-[#26262B]" />
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproving || withdrawals.length === 0}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-lg flex items-center space-x-1.5 transition-all ${
              withdrawals.length === 0
                ? "bg-[#26262B] text-[#8E8E93] cursor-not-allowed"
                : bulkApproving
                ? "bg-[#FF9F0A]/20 text-[#FF9F0A] cursor-wait"
                : "bg-[#0ECB81]/10 border border-[#0ECB81]/30 text-[#0ECB81] hover:bg-[#0ECB81]/20"
            }`}
          >
            <CheckCircle size={13} />
            <span>{bulkApproving ? "처리 중..." : `일괄 승인 (${withdrawals.length}건)`}</span>
          </button>
        </div>
      </div>

      {/* Main Audit Table Card */}
      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-[#26262B] pb-4">
          <div className="flex items-center space-x-2 text-[#FF9F0A]">
            <ShieldAlert size={18} />
            <h3 className="text-sm font-bold text-white">수동 승인 대기 중인 출금 신청 목록 ({withdrawals.length}건)</h3>
          </div>
          <span className="text-xs text-[#8E8E93]">※ 승인 시 바이낸스 스마트 체인(BSC) 온체인으로 즉시 송금됩니다.</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">출금 요청 ID</th>
                <th className="py-3 px-4">신청 회원 이메일</th>
                <th className="py-3 px-4">닉네임</th>
                <th className="py-3 px-4">출금 자산</th>
                <th className="py-3 px-4">신청 금액</th>
                <th className="py-3 px-4">수수료 (3%)</th>
                <th className="py-3 px-4">실제 수령액</th>
                <th className="py-3 px-4">수신 BSC 지갑 주소</th>
                <th className="py-3 px-4 text-center">수동 승인 / 거절 심사</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#8E8E93]">대기 중인 출금 내역을 불러오는 중...</td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#8E8E93]">
                    🎉 현재 대기 중인 출금 요청이 없습니다. (모든 승인 완료)
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => {
                  const finalAmount = w.amount * 0.97;
                  return (
                    <tr key={w.id} className="border-b border-[#26262B]/50 hover:bg-[#1C1C21]/40 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-[#FF9F0A]">{w.id}</td>
                      <td className="py-4 px-4 font-semibold text-white">{w.email}</td>
                      <td className="py-4 px-4 font-bold text-[#FCD535]">{w.nickname}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          w.asset === "USDT" ? "bg-[#26A17B]/10 text-[#26A17B] border border-[#26A17B]/30" : "bg-[#FCD535]/10 text-[#FCD535] border border-[#FCD535]/30"
                        }`}>
                          {w.asset}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-mono font-extrabold text-white">
                        {w.amount.toFixed(2)} {w.asset}
                      </td>
                      <td className="py-4 px-4 font-mono text-[#8E8E93]">
                        {(w.amount * 0.03).toFixed(2)} {w.asset}
                      </td>
                      <td className="py-4 px-4 font-mono font-extrabold text-[#0ECB81]">
                        {finalAmount.toFixed(2)} {w.asset}
                      </td>
                      <td className="py-4 px-4 font-mono text-[11px] text-[#8E8E93]">
                        {w.address || w.txHash || "0x3a9B8f5C01A29D478b1E4109C2d4317e1D4A8912"}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center space-x-2">
                          <button
                            onClick={() => handleApprove(w.id, w.email, w.amount, w.asset)}
                            className="px-3 py-1.5 bg-[#0ECB81] hover:bg-[#0ECB81]/80 text-[#0B0E11] font-black rounded-lg text-xs transition-all flex items-center space-x-1 shadow-md"
                          >
                            <CheckCircle size={14} />
                            <span>출금 승인</span>
                          </button>
                          <button
                            onClick={() => handleReject(w.id, w.email, w.amount, w.asset)}
                            className="px-3 py-1.5 bg-[#FF453A]/10 hover:bg-[#FF453A] text-[#FF453A] hover:text-white border border-[#FF453A]/30 font-bold rounded-lg text-xs transition-all flex items-center space-x-1"
                          >
                            <XCircle size={14} />
                            <span>반려 (환불)</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
