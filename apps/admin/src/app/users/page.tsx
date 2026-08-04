"use client";

import React, { useState, useEffect } from "react";
import { Users, Search, Activity, PowerOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  code: string;
  joinedAt: string;
  assets: number;
  active: boolean;
  totalReferrals: number;
  usedEntries: number;
  sponsorEmail: string;
  sponsorNickname: string;
}

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/users");
        const data = await res.json();

        if (data.success && data.users) {
          setUsers(data.users);
        } else {
          setUsers([]);
        }
      } catch (e) {
        console.error("유저 목록 조회 실패", e);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId: string, nickname: string) => {
    if (!confirm(`정말 '${nickname}' 회원을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 관련 데이터가 모두 삭제됩니다.`)) return;
    
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== userId));
        alert("회원이 성공적으로 삭제되었습니다.");
      } else {
        alert(`삭제 실패: ${data.error}`);
      }
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const filteredUsers = users.filter(u => u.email.includes(searchTerm) || u.nickname.includes(searchTerm) || u.code.includes(searchTerm));

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">회원 관리</h2>
        <p className="text-sm text-[#8E8E93] mt-1">전체 가입자 목록 조회 및 본인 계정 활성화 상태, 조직도를 실시간으로 통합 관리합니다.</p>
      </div>

      <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
            <Users size={16} className="mr-2 text-[#00D2FF]" />
            회원 목록 ({filteredUsers.length}명)
          </h4>
          
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8E8E93]">
              <Search size={14} />
            </div>
            <input
              type="text"
              placeholder="이메일, 닉네임, 추천코드 검색..."
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
                <th className="py-3 px-2 text-center w-10">No.</th>
                <th className="py-3 px-4">유저 회원 정보</th>
                <th className="py-3 px-4 text-center">게임 횟수</th>
                <th className="py-3 px-4 text-center">총추천인</th>
                <th className="py-3 px-4">스폰서</th>
                <th className="py-3 px-4">가입 날짜</th>
                <th className="py-3 px-4 text-right">보유 자산 (USDT)</th>
                <th className="py-3 px-4 text-center">상태</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#8E8E93]">회원 데이터를 불러오는 중...</td>
                </tr>
              ) : filteredUsers.map((user, index) => (
                <tr key={user.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                  <td className="py-3 px-2 text-center text-[#8E8E93] font-mono">{index + 1}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{user.nickname} <span className="font-mono text-[#BF5AF2] text-[10px] ml-1">({user.code})</span></div>
                    <div className="text-[10px] text-[#8E8E93]">{user.email}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-white">{user.usedEntries}회</td>
                  <td className="py-3 px-4 text-center font-mono text-[#00D2FF]">{user.totalReferrals}명</td>
                  <td className="py-3 px-4">
                    <div className="text-xs text-[#EAECEF]">{user.sponsorNickname || "없음"}</div>
                    <div className="text-[10px] text-[#8E8E93]">{user.sponsorEmail !== "없음" ? user.sponsorEmail : ""}</div>
                  </td>
                  <td className="py-3 px-4 text-[#8E8E93]">{user.joinedAt}</td>
                  <td className="py-3 px-4 text-right font-bold text-white font-mono">${user.assets.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="py-3 px-4 text-center">
                    {user.active ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#30D5C8]/10 text-[#30D5C8]">
                        <Activity size={10} />
                        <span>활성</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#8E8E93]/10 text-[#8E8E93]">
                        <PowerOff size={10} />
                        <span>미구매</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center flex items-center justify-center space-x-2">
                    <button className="px-3 py-1 bg-[#1C1C21] hover:bg-[#00D2FF] hover:text-[#0B0E11] text-[#00D2FF] text-[10px] font-bold rounded transition-colors">
                      조직도
                    </button>
                    <button onClick={() => handleDeleteUser(user.id, user.nickname)} className="px-3 py-1 bg-[#F6465D]/10 hover:bg-[#F6465D] hover:text-white text-[#F6465D] text-[10px] font-bold rounded transition-colors">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#8E8E93]">검색 결과가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
