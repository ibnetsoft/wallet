"use client";

import React, { useState } from "react";
import { Users, Search, Activity, Power, PowerOff, Shield } from "lucide-react";

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Mock data for users
  const [users] = useState([
    { id: 1, email: "active_whale@example.com", nickname: "Whale99", code: "URC883920", joinedAt: "2023-10-12", assets: 1450.50, active: true },
    { id: 2, email: "trader_vip@example.com", nickname: "VipTrader", code: "URC551221", joinedAt: "2023-11-05", assets: 520.00, active: true },
    { id: 3, email: "crypto_guy@example.com", nickname: "CryptoG", code: "URC110992", joinedAt: "2024-01-20", assets: 35.00, active: false },
    { id: 4, email: "new_user99@example.com", nickname: "Newbie", code: "URC994433", joinedAt: "2024-02-15", assets: 100.00, active: true },
  ]);

  const filteredUsers = users.filter(u => u.email.includes(searchTerm) || u.nickname.includes(searchTerm) || u.code.includes(searchTerm));

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">회원 관리 (User Manager)</h2>
        <p className="text-sm text-[#8E8E93] mt-1">전체 가입자 목록 조회 및 활성 상태 관리, 계보도 조회를 지원합니다.</p>
      </div>

      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
            <Users size={16} className="mr-2 text-[#00D2FF]" />
            회원 목록
          </h4>
          
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8E8E93]">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="이메일, 닉네임, 코드 검색..."
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
                <th className="py-3 px-4">유저 식별자</th>
                <th className="py-3 px-4">초대 코드</th>
                <th className="py-3 px-4">가입일</th>
                <th className="py-3 px-4 text-right">보유 자산</th>
                <th className="py-3 px-4 text-center">상태</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{user.nickname}</div>
                    <div className="text-[10px] text-[#8E8E93]">{user.email}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[#BF5AF2]">{user.code}</td>
                  <td className="py-3 px-4 text-[#8E8E93]">{user.joinedAt}</td>
                  <td className="py-3 px-4 text-right font-bold text-white">${user.assets.toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    {user.active ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#30D5C8]/10 text-[#30D5C8]">
                        <Activity size={10} />
                        <span>활성</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#8E8E93]/10 text-[#8E8E93]">
                        <PowerOff size={10} />
                        <span>비활성</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button className="px-3 py-1 bg-[#1C1C21] hover:bg-[#00D2FF] hover:text-[#0B0E11] text-[#00D2FF] text-[10px] font-bold rounded transition-colors mr-2">
                      계보도 보기
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#8E8E93]">검색 결과가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
