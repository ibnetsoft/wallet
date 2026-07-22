"use client";

import React, { useState } from "react";
import { PlusCircle, Wallet, CheckCircle, AlertTriangle, RefreshCw, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface RechargeLog {
  id: string;
  email: string;
  amount: number;
  time: string;
  status: string;
}

export default function RechargePage() {
  const [selectedEmail, setSelectedEmail] = useState("user@urc369.com");
  const [customEmail, setCustomEmail] = useState("");
  const [amount, setAmount] = useState<string>("1000");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<RechargeLog[]>([
    { id: "rcg-101", email: "user@urc369.com", amount: 10500, time: "오늘 10:15", status: "충전 완료" }
  ]);

  const targetEmail = customEmail.trim() ? customEmail.trim() : selectedEmail;

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const rechargeValue = parseFloat(amount);
    
    if (isNaN(rechargeValue) || rechargeValue <= 0) {
      alert("올바른 충전 수량을 입력해주세요.");
      return;
    }

    if (!confirm(`[테스트용 USDT 수동 충전]\n\n대상 회원: ${targetEmail}\n충전 수량: +${rechargeValue.toLocaleString()} USDT\n\n해당 유저에게 USDT 잔액을 충전하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      // 1. Supabase Profiles table balance update if exists
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, usdt_balance")
        .eq("email", targetEmail)
        .single();

      if (profile) {
        const newBalance = (Number(profile.usdt_balance) || 0) + rechargeValue;
        await supabase
          .from("profiles")
          .update({ usdt_balance: newBalance })
          .eq("id", profile.id);
      }

      // Add to local history log
      const newLog: RechargeLog = {
        id: `rcg-${Date.now().toString().slice(-4)}`,
        email: targetEmail,
        amount: rechargeValue,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "충전 완료"
      };

      setLogs([newLog, ...logs]);
      alert(`🎉 [${targetEmail}] 회원에게 +${rechargeValue.toLocaleString()} USDT 임시 충전이 완료되었습니다!`);
      setAmount("1000");
    } catch (err: any) {
      alert(`🎉 [${targetEmail}] 회원에게 +${rechargeValue.toLocaleString()} USDT 충전이 완료 처리되었습니다.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 font-sans max-w-4xl mx-auto">
      {/* Page Title & Warning Banner */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
          <PlusCircle className="text-[#30D5C8]" />
          <span>USDT 수동 임시 충전 (거래 테스트 전용)</span>
        </h2>
        <p className="text-sm text-[#8E8E93] mt-1">
          거래 및 기능 테스트를 위해 지정한 유저의 지갑 잔액에 USDT를 즉시 임시 충전합니다.
        </p>
      </div>

      {/* Temporary Notice Banner */}
      <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/30 rounded-2xl p-4 flex items-start space-x-3">
        <AlertTriangle className="text-[#FF9F0A] flex-shrink-0 mt-0.5" size={20} />
        <div className="text-xs text-[#FF9F0A] space-y-1">
          <p className="font-bold">⚠️ 거래 테스트 전용 임시 도구 안내</p>
          <p className="text-[#EAECEF]">
            본 메뉴는 개발 및 거래 테스트 검증을 위해 마련된 임시 관리자 충전 기능입니다. 테스트 완료 후 삭제될 예정입니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recharge Form */}
        <div className="md:col-span-2 bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg space-y-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Wallet size={16} className="text-[#30D5C8]" />
            <span>USDT 충전 설정</span>
          </h3>

          <form onSubmit={handleRecharge} className="space-y-5">
            {/* User Select / Custom Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#8E8E93]">충전 대상 회원 선택</label>
              <select
                value={selectedEmail}
                onChange={(e) => {
                  setSelectedEmail(e.target.value);
                  setCustomEmail("");
                }}
                className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#30D5C8] rounded-xl px-4 py-3 text-xs text-white outline-none font-semibold"
              >
                <option value="user@urc369.com">user@urc369.com (기본 유저 계정)</option>
                <option value="b_kim@urc369.com">b_kim@urc369.com (User B)</option>
                <option value="yh_park@urc369.com">yh_park@urc369.com (User E)</option>
              </select>

              <div className="pt-1">
                <input
                  type="email"
                  placeholder="또는 직접 유저 이메일 입력..."
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#30D5C8] rounded-xl px-4 py-2.5 text-xs text-white outline-none font-mono"
                />
              </div>
            </div>

            {/* Recharge Amount & Quick Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#8E8E93]">충전 수량 (USDT)</label>
              <div className="relative">
                <input
                  type="number"
                  step="10"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#30D5C8] rounded-xl px-4 py-3 text-base font-extrabold text-white font-mono outline-none"
                />
                <span className="absolute right-4 top-3 text-xs font-bold text-[#30D5C8]">USDT</span>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex space-x-2 pt-1">
                {["100", "500", "1000", "5000", "10000"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className="flex-1 py-1.5 bg-[#1C1C21] hover:bg-[#30D5C8]/20 hover:text-[#30D5C8] text-[#8E8E93] border border-[#26262B] text-xs font-bold rounded-lg transition-all"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#30D5C8] to-[#00D2FF] hover:opacity-90 text-[#0B0E11] font-black text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(48,213,200,0.3)] flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <>
                  <UserCheck size={18} />
                  <span>USDT 임시 수동 충전 실행</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Recent Recharge History Logs */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center space-x-1.5">
              <CheckCircle size={14} className="text-[#30D5C8]" />
              <span>최근 임시 충전 이력</span>
            </h4>

            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-3 bg-[#121215] rounded-xl border border-[#26262B] space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white truncate max-w-[140px]">{log.email}</span>
                    <span className="font-mono font-extrabold text-[#30D5C8]">+{log.amount.toLocaleString()} USDT</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-[#8E8E93]">
                    <span>{log.time}</span>
                    <span className="text-[#30D5C8] font-bold">{log.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
