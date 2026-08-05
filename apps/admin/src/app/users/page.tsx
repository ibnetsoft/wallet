"use client";

import React, { useState, useEffect } from "react";
import { Users, Search, Activity, PowerOff, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  code: string;
  joinedAt: string;
  lastLoginAt: string;
  starLevel: number;
  walletAddress: string;
  assets: number;
  baoBalance: number;
  jadeBalance: number;
  hongbaoBalance: number;
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
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

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
                <th className="py-3 px-4">회원 정보 (닉네임/직급)</th>
                <th className="py-3 px-4">BSC 지갑 주소</th>
                <th className="py-3 px-4 text-right">보유 자산</th>
                <th className="py-3 px-4 text-center">네트워크 (스폰서/추천/게임)</th>
                <th className="py-3 px-4 text-center">활동 기록 (가입/접속)</th>
                <th className="py-3 px-4 text-center">상태</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8E8E93]">회원 데이터를 불러오는 중...</td>
                </tr>
              ) : filteredUsers.map((user, index) => (
                <tr key={user.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                  <td className="py-3 px-2 text-center text-[#8E8E93] font-mono">{index + 1}</td>
                  
                  {/* 회원 정보 */}
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        user.starLevel >= 3 ? 'bg-[#FF9F0A]/20 text-[#FF9F0A] border border-[#FF9F0A]/30' : 
                        user.starLevel >= 1 ? 'bg-[#0ECB81]/20 text-[#0ECB81] border border-[#0ECB81]/30' :
                        'bg-[#8E8E93]/20 text-[#8E8E93] border border-[#8E8E93]/30'
                      }`}>
                        {user.starLevel > 0 ? `${user.starLevel}성` : '일반'}
                      </span>
                      <span className="font-semibold text-white">{user.nickname}</span>
                      <span className="font-mono text-[#BF5AF2] text-[10px]">({user.code})</span>
                    </div>
                    <div className="text-[10px] text-[#8E8E93] mt-1">{user.email}</div>
                  </td>

                  {/* 지갑 주소 */}
                  <td className="py-3 px-4">
                    {user.walletAddress !== "미발급" ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-[#00D2FF] truncate w-24">
                          {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                        </span>
                        <button 
                          onClick={() => handleCopy(user.walletAddress)}
                          className="p-1 hover:bg-[#26262B] rounded text-[#8E8E93] hover:text-white transition-colors"
                          title="주소 복사"
                        >
                          {copiedAddress === user.walletAddress ? <Check size={12} className="text-[#0ECB81]" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#8E8E93]">미발급</span>
                    )}
                  </td>

                  {/* 보유 자산 */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-col items-end space-y-1">
                      <div className="text-[11px] font-bold text-white font-mono flex items-center justify-end w-full">
                        <span className="text-[9px] text-[#8E8E93] mr-2">USDT</span>
                        ${user.assets.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] font-bold text-[#0ECB81] font-mono flex items-center justify-end w-full">
                        <span className="text-[9px] text-[#8E8E93] mr-2">BAO</span>
                        {user.baoBalance.toLocaleString()}
                      </div>
                      <div className="flex justify-end space-x-2 w-full mt-0.5">
                        <span className="text-[9px] text-[#30D5C8] bg-[#30D5C8]/10 px-1 rounded border border-[#30D5C8]/20">옥구슬: {user.jadeBalance.toLocaleString()}</span>
                        <span className="text-[9px] text-[#FF453A] bg-[#FF453A]/10 px-1 rounded border border-[#FF453A]/20">홍바오: {user.hongbaoBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </td>

                  {/* 네트워크 */}
                  <td className="py-3 px-4 text-center">
                    <div className="text-[10px] text-[#EAECEF]"><span className="text-[#8E8E93]">스폰서:</span> {user.sponsorNickname || "없음"}</div>
                    <div className="text-[10px] text-[#00D2FF] mt-0.5"><span className="text-[#8E8E93]">산하추천:</span> {user.totalReferrals}명</div>
                    <div className="text-[10px] text-[#BF5AF2] mt-0.5"><span className="text-[#8E8E93]">게임진행:</span> {user.usedEntries}회</div>
                  </td>

                  {/* 활동 기록 */}
                  <td className="py-3 px-4 text-center">
                    <div className="text-[10px] text-[#8E8E93]">가입: {user.joinedAt}</div>
                    <div className="text-[10px] text-[#F2F2F7] mt-0.5">접속: {user.lastLoginAt}</div>
                  </td>

                  {/* 상태 */}
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

                  {/* 관리 */}
                  <td className="py-3 px-4 text-center flex items-center justify-center space-x-2 h-[80px]">
                    <button className="px-2.5 py-1 bg-[#1C1C21] border border-[#26262B] hover:border-[#00D2FF] hover:text-[#00D2FF] text-[#EAECEF] text-[10px] font-bold rounded transition-colors">
                      조직도
                    </button>
                    <button onClick={() => handleDeleteUser(user.id, user.nickname)} className="px-2.5 py-1 bg-[#F6465D]/10 hover:bg-[#F6465D] hover:text-white text-[#F6465D] text-[10px] font-bold rounded transition-colors">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8E8E93]">검색 결과가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
