"use client";

import React, { useState, useEffect } from "react";
import { Users, Search, Activity, PowerOff, Copy, Check, FileText, X, Gamepad2, Ticket, Gift } from "lucide-react";
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
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [detailsTab, setDetailsTab] = useState<"machines" | "games" | "bonuses">("machines");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<any>(null);

  const fetchUserDetails = async (user: UserProfile) => {
    setSelectedUser(user);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/details`);
      const data = await res.json();
      if (data.success) {
        setUserDetails(data.details);
      }
    } catch (e) {
      console.error("Failed to fetch user details", e);
    } finally {
      setDetailsLoading(false);
    }
  };

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
                  <td className="py-3 px-4 text-center flex items-center justify-center space-x-1.5 h-[80px]">
                    <button 
                      onClick={() => fetchUserDetails(user)}
                      className="px-2 py-1 bg-[#1C1C21] border border-[#26262B] hover:border-[#BF5AF2] hover:text-[#BF5AF2] text-[#EAECEF] text-[10px] font-bold rounded transition-colors flex items-center space-x-1"
                    >
                      <FileText size={10} />
                      <span>상세</span>
                    </button>
                    <button className="px-2 py-1 bg-[#1C1C21] border border-[#26262B] hover:border-[#00D2FF] hover:text-[#00D2FF] text-[#EAECEF] text-[10px] font-bold rounded transition-colors">
                      조직도
                    </button>
                    <button onClick={() => handleDeleteUser(user.id, user.nickname)} className="px-2 py-1 bg-[#F6465D]/10 hover:bg-[#F6465D] hover:text-white text-[#F6465D] text-[10px] font-bold rounded transition-colors">
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

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#16161A] border border-[#26262B] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#26262B]">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>{selectedUser.nickname}</span>
                  <span className="text-[#8E8E93] text-sm font-normal">({selectedUser.email})</span>
                  <span className="bg-[#BF5AF2]/20 text-[#BF5AF2] text-[10px] px-2 py-0.5 rounded border border-[#BF5AF2]/30 uppercase font-mono">
                    {selectedUser.code}
                  </span>
                </h3>
                <p className="text-xs text-[#8E8E93] mt-1">상세 활동 내역 및 이력 조회</p>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-[#26262B] rounded-lg text-[#8E8E93] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex px-5 pt-3 border-b border-[#26262B] space-x-6">
              <button 
                onClick={() => setDetailsTab("machines")}
                className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-colors relative ${detailsTab === 'machines' ? 'text-white' : 'text-[#8E8E93] hover:text-white'}`}
              >
                <Gamepad2 size={16} className={detailsTab === 'machines' ? 'text-[#0ECB81]' : ''} />
                <span>게임기 구매 현황</span>
                {detailsTab === 'machines' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0ECB81] rounded-t-full" />}
              </button>
              <button 
                onClick={() => setDetailsTab("games")}
                className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-colors relative ${detailsTab === 'games' ? 'text-white' : 'text-[#8E8E93] hover:text-white'}`}
              >
                <Ticket size={16} className={detailsTab === 'games' ? 'text-[#00D2FF]' : ''} />
                <span>게임 참여 내역</span>
                {detailsTab === 'games' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00D2FF] rounded-t-full" />}
              </button>
              <button 
                onClick={() => setDetailsTab("bonuses")}
                className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-colors relative ${detailsTab === 'bonuses' ? 'text-white' : 'text-[#8E8E93] hover:text-white'}`}
              >
                <Gift size={16} className={detailsTab === 'bonuses' ? 'text-[#BF5AF2]' : ''} />
                <span>수당/보너스 수령액</span>
                {detailsTab === 'bonuses' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BF5AF2] rounded-t-full" />}
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 bg-[#0B0E11]/50 min-h-[300px]">
              {detailsLoading ? (
                <div className="flex h-full items-center justify-center text-[#8E8E93] animate-pulse text-sm">
                  데이터를 불러오는 중...
                </div>
              ) : !userDetails ? (
                <div className="flex h-full items-center justify-center text-[#8E8E93] text-sm">
                  데이터가 없습니다.
                </div>
              ) : (
                <>
                  {/* Tab 1: Machines */}
                  {detailsTab === "machines" && (
                    <div className="space-y-4">
                      {userDetails.machines.length === 0 ? (
                        <div className="text-center text-[#8E8E93] py-10 text-sm">구매한 게임기가 없습니다.</div>
                      ) : (
                        userDetails.machines.map((machine: any) => (
                          <div key={machine.id} className="bg-[#1C1C21] p-4 rounded-xl border border-[#26262B] flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-white font-bold text-sm">
                                  {machine.package_level === 1 ? "$100 Package" : machine.package_level === 2 ? "$500 Package" : "$1,000 Package"}
                                </h4>
                                <span className="text-[10px] text-[#8E8E93] font-mono">{new Date(machine.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="text-xs text-[#8E8E93] mt-1">
                                총 티켓: {machine.total_entry_limit}장 (사용: {machine.used_entries}장)
                              </div>
                            </div>
                            
                            <div className="flex-1 max-w-sm w-full bg-[#0B0E11] rounded-lg p-3 border border-[#26262B]/50">
                              <div className="flex justify-between text-xs mb-1.5">
                                <span className="text-[#8E8E93]">수당 캡 (Payout Cap)</span>
                                <span className="font-mono text-[#0ECB81] font-bold">
                                  ${machine.accumulated_payout_usd.toLocaleString()} / ${machine.payout_limit_usd.toLocaleString()}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-[#26262B] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#0ECB81] to-[#30D5C8]" 
                                  style={{ width: `${Math.min(machine.payoutPercentage, 100)}%` }}
                                />
                              </div>
                              <div className="text-right mt-1 text-[10px] text-[#8E8E93]">
                                {machine.payoutPercentage.toFixed(1)}% 달성
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab 2: Games */}
                  {detailsTab === "games" && (
                    <div className="overflow-hidden rounded-xl border border-[#26262B]">
                      <table className="w-full text-left text-xs border-collapse bg-[#1C1C21]">
                        <thead>
                          <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold bg-[#26262B]/30">
                            <th className="py-2.5 px-4">참여 일시</th>
                            <th className="py-2.5 px-4">회차 (Round ID)</th>
                            <th className="py-2.5 px-4 text-center">배팅 티켓수</th>
                            <th className="py-2.5 px-4 text-center">당첨 티켓</th>
                            <th className="py-2.5 px-4 text-center">낙첨 티켓</th>
                            <th className="py-2.5 px-4 text-center">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDetails.games.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-[#8E8E93]">게임 참여 내역이 없습니다.</td></tr>
                          ) : (
                            userDetails.games.map((g: any) => (
                              <tr key={g.id} className="border-b border-[#26262B]/40 hover:bg-[#26262B]/40">
                                <td className="py-2.5 px-4 text-[#8E8E93]">{new Date(g.created_at).toLocaleString()}</td>
                                <td className="py-2.5 px-4 text-white font-mono font-bold">Round #{g.round_id}</td>
                                <td className="py-2.5 px-4 text-center text-[#00D2FF] font-mono font-bold">{g.tickets_count}장</td>
                                <td className="py-2.5 px-4 text-center text-[#0ECB81] font-mono">{g.won_tickets > 0 ? `${g.won_tickets}장` : '-'}</td>
                                <td className="py-2.5 px-4 text-center text-[#FF453A] font-mono">{g.lost_tickets > 0 ? `${g.lost_tickets}장` : '-'}</td>
                                <td className="py-2.5 px-4 text-center">
                                  {g.ticket_status === 'COMPLETED' ? <span className="text-[#30D5C8]">종료</span> : <span className="text-[#FF9F0A]">대기중</span>}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab 3: Bonuses */}
                  {detailsTab === "bonuses" && (
                    <div className="overflow-hidden rounded-xl border border-[#26262B]">
                      <table className="w-full text-left text-xs border-collapse bg-[#1C1C21]">
                        <thead>
                          <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold bg-[#26262B]/30">
                            <th className="py-2.5 px-4">지급 일시</th>
                            <th className="py-2.5 px-4">보너스 유형</th>
                            <th className="py-2.5 px-4 text-right">지급 수량</th>
                            <th className="py-2.5 px-4">관련 정보</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDetails.bonuses.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-8 text-[#8E8E93]">보너스 수령 내역이 없습니다.</td></tr>
                          ) : (
                            userDetails.bonuses.map((b: any) => (
                              <tr key={b.id} className="border-b border-[#26262B]/40 hover:bg-[#26262B]/40">
                                <td className="py-2.5 px-4 text-[#8E8E93]">{new Date(b.created_at).toLocaleString()}</td>
                                <td className="py-2.5 px-4 text-[#EAECEF] font-bold">{b.tx_type}</td>
                                <td className={`py-2.5 px-4 text-right font-mono font-bold ${b.asset === 'USDT' ? 'text-[#0ECB81]' : 'text-[#30D5C8]'}`}>
                                  +{b.amount.toLocaleString()} <span className="text-[10px] font-normal text-[#8E8E93]">{b.asset}</span>
                                </td>
                                <td className="py-2.5 px-4 text-[#8E8E93] text-[10px] truncate max-w-[200px]" title={JSON.stringify(b.details)}>
                                  {b.details ? JSON.stringify(b.details) : "-"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
