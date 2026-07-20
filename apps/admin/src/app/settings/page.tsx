"use client";

import React, { useState } from "react";
import { Settings, Shield, UserPlus, Trash2, Key } from "lucide-react";

export default function SettingsPage() {
  const [subAdmins, setSubAdmins] = useState([
    { id: 1, email: "manager_kim@urc369.com", role: "SUB_ADMIN", permissions: ["WITHDRAWAL_APPROVE", "USER_VIEW"], createdAt: "2024-03-01" },
    { id: 2, email: "cs_team@urc369.com", role: "SUB_ADMIN", permissions: ["USER_VIEW"], createdAt: "2024-05-15" },
  ]);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [perms, setPerms] = useState({ withdraw: false, wallet: false, users: true });

  const handleAddSubAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;

    const newPerms = ["USER_VIEW"];
    if (perms.withdraw) newPerms.push("WITHDRAWAL_APPROVE");
    if (perms.wallet) newPerms.push("WALLET_SWEEP");

    setSubAdmins([...subAdmins, {
      id: Date.now(),
      email: newEmail,
      role: "SUB_ADMIN",
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
        <h2 className="text-2xl font-bold text-white tracking-tight">시스템 설정 (System Settings)</h2>
        <p className="text-sm text-[#8E8E93] mt-1">마스터 관리자 전용 설정 페이지입니다. 서브 관리자 계정을 생성하고 권한을 부여할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
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
