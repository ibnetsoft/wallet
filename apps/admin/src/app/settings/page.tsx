"use client";

import React, { useState } from "react";
import { Settings, Shield, UserPlus, Trash2, Key } from "lucide-react";

export default function SettingsPage() {
  const [subAdmins, setSubAdmins] = useState([
    { id: 1, email: "manager_kim@urc369.com", role: "서브 관리자", permissions: ["출금 승인", "회원 조회"], createdAt: "2026-07-01" },
    { id: 2, email: "cs_team@urc369.com", role: "서브 관리자", permissions: ["회원 조회"], createdAt: "2026-07-15" },
  ]);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [perms, setPerms] = useState({ withdraw: false, wallet: false, users: true });

  // Global Fee Settings (Withdrawal Fee Default 3%)
  const [swapFee, setSwapFee] = useState("0.1");
  const [withdrawalFee, setWithdrawalFee] = useState("3.0");
  const [savingFees, setSavingFees] = useState(false);

  const handleSaveFees = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFees(true);
    setTimeout(() => {
      setSavingFees(false);
      alert(`플랫폼 수수료율(출금 수수료 ${withdrawalFee}%)이 성공적으로 업데이트되었습니다.`);
    }, 1000);
  };

  const handleAddSubAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;

    const newPerms = ["회원 조회"];
    if (perms.withdraw) newPerms.push("출금 승인");
    if (perms.wallet) newPerms.push("지갑 모으기");

    setSubAdmins([...subAdmins, {
      id: Date.now(),
      email: newEmail,
      role: "서브 관리자",
      permissions: newPerms,
      createdAt: new Date().toISOString().split('T')[0]
    }]);

    setNewEmail("");
    setNewPassword("");
    alert("서브 관리자가 성공적으로 추가되었습니다.");
  };

  const handleDelete = (id: number) => {
    if (confirm("정말로 이 서브 관리자 계정을 삭제하시겠습니까?")) {
      setSubAdmins(subAdmins.filter(a => a.id !== id));
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">시스템 환경 설정</h2>
        <p className="text-sm text-[#8E8E93] mt-1">369어드민 마스터 전용 설정 페이지입니다. 수수료율과 서브 관리자 계정 권한을 제어합니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="space-y-6">
          {/* Global Fee Settings */}
          <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center mb-6">
              <Settings size={16} className="mr-2 text-[#FCD535]" />
              플랫폼 수수료 설정
            </h4>

            <form onSubmit={handleSaveFees} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-[#8E8E93] uppercase font-bold">스왑 수수료율 (URC ↔ USDT)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    max="100"
                    required
                    value={swapFee}
                    onChange={e => setSwapFee(e.target.value)}
                    className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#FCD535] pl-3 pr-8 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-[#8E8E93] text-sm">%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-[#8E8E93] uppercase font-bold">출금 수수료율 (기본값 3%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={withdrawalFee}
                    onChange={e => setWithdrawalFee(e.target.value)}
                    className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#FCD535] pl-3 pr-8 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-[#8E8E93] text-sm">%</span>
                </div>
              </div>

              <button type="submit" disabled={savingFees} className="w-full py-3 mt-2 bg-[#FCD535] hover:bg-[#F3BA2F] text-[#0B0E11] font-bold rounded-lg transition-colors text-sm disabled:opacity-50">
                {savingFees ? "저장 중..." : "수수료율 설정 저장하기"}
              </button>
            </form>
          </div>

          {/* Add Sub Admin Form */}
          <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center mb-6">
              <UserPlus size={16} className="mr-2 text-[#BF5AF2]" />
              서브 관리자 추가
            </h4>

          <form onSubmit={handleAddSubAdmin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">계정 이메일</label>
              <input 
                type="email" 
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="admin@urc369.com"
                className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#BF5AF2] px-3 py-2.5 rounded-lg text-sm text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">초기 비밀번호</label>
              <input 
                type="password" 
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="********"
                className="w-full bg-[#1C1C21] border border-[#26262B] focus:border-[#BF5AF2] px-3 py-2.5 rounded-lg text-sm text-white outline-none"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-[#26262B]">
              <label className="text-[10px] text-[#8E8E93] uppercase font-bold">권한 설정 (Permissions)</label>
              
              <div className="flex items-center space-x-2">
                <input type="checkbox" checked disabled className="accent-[#BF5AF2]" />
                <span className="text-xs text-[#EAECEF]">유저 조회 (기본)</span>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={perms.withdraw} 
                  onChange={e => setPerms({...perms, withdraw: e.target.checked})} 
                  className="accent-[#BF5AF2]" 
                />
                <span className="text-xs text-[#EAECEF]">출금 승인 및 반려 권한</span>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={perms.wallet} 
                  onChange={e => setPerms({...perms, wallet: e.target.checked})} 
                  className="accent-[#BF5AF2]" 
                />
                <span className="text-xs text-[#EAECEF] font-bold text-[#FF453A]">지갑 모으기 권한 (위험)</span>
              </div>
            </div>

            <button type="submit" className="w-full py-3 mt-4 bg-[#BF5AF2] hover:bg-[#9A3FD0] text-white font-bold rounded-lg transition-colors text-sm">
              계정 생성하기
            </button>
          </form>
        </div>
        </div>

        {/* Sub Admin List */}
        <div className="bg-[#16161A] border border-[#26262B] rounded-2xl p-6 shadow-lg lg:col-span-2">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center mb-6">
            <Shield size={16} className="mr-2 text-[#30D5C8]" />
            관리자 계정 목록
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#26262B] text-[#8E8E93] font-semibold uppercase tracking-wider pb-3">
                  <th className="py-3 px-4">계정 이메일</th>
                  <th className="py-3 px-4">역할</th>
                  <th className="py-3 px-4">보유 권한</th>
                  <th className="py-3 px-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#26262B]/40 bg-[#30D5C8]/5">
                  <td className="py-4 px-4 font-bold text-[#30D5C8] flex items-center space-x-2">
                    <Key size={12} />
                    <span>master@ibnetsoft.com</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF9F0A]/20 text-[#FF9F0A]">SUPER_ADMIN</span>
                  </td>
                  <td className="py-4 px-4 text-[#8E8E93] text-[10px]">ALL_ACCESS</td>
                  <td className="py-4 px-4 text-center text-[#8E8E93] text-[10px]">-</td>
                </tr>
                {subAdmins.map((admin) => (
                  <tr key={admin.id} className="border-b border-[#26262B]/40 hover:bg-[#1C1C21]/30 transition-all">
                    <td className="py-4 px-4 font-medium text-white">{admin.email}</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#BF5AF2]/20 text-[#BF5AF2]">{admin.role}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {admin.permissions.map(p => (
                          <span key={p} className="px-1.5 py-0.5 rounded text-[9px] bg-[#26262B] text-[#EAECEF]">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button onClick={() => handleDelete(admin.id)} className="text-[#FF453A] hover:opacity-80 p-1">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
