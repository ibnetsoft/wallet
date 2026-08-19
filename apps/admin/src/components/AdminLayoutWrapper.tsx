"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bell,
  LayoutDashboard,
  Send,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <div className="w-full min-h-screen">{children}</div>;
  }

  return (
    <>
      <aside className="fixed z-10 flex h-full w-64 flex-col border-r border-[#26262B] bg-[#16161A]">
        <div className="flex h-16 items-center border-b border-[#26262B] px-6">
          <span className="bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] bg-clip-text text-lg font-bold tracking-wider text-transparent">
            369어드민
          </span>
          <span className="ml-2 rounded border border-[#FF9F0A]/20 bg-[#FF9F0A]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#FF9F0A]">
            ADMIN
          </span>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
          <Link href="/" className="flex items-center space-x-3 rounded-xl px-4 py-3 font-semibold text-[#8E8E93] transition-all hover:bg-[#00D2FF]/10 hover:text-[#00D2FF]">
            <LayoutDashboard size={18} />
            <span>대시보드</span>
          </Link>
          <Link href="/withdrawals" className="flex items-center space-x-3 rounded-xl border border-[#FF9F0A]/20 bg-[#FF9F0A]/10 px-4 py-3 font-bold text-[#FF9F0A] transition-all hover:bg-[#FF9F0A]/20">
            <ArrowUpRight size={18} />
            <span>출금 승인 심사 관리</span>
          </Link>
          <Link href="/users" className="flex items-center space-x-3 rounded-xl px-4 py-3 text-[#8E8E93] transition-all hover:bg-[#1C1C21] hover:text-[#FFFFFF]">
            <Users size={18} />
            <span>회원 관리</span>
          </Link>
          <Link href="/wallet" className="flex items-center space-x-3 rounded-xl px-4 py-3 text-[#8E8E93] transition-all hover:bg-[#1C1C21] hover:text-[#FFFFFF]">
            <Wallet size={18} />
            <span>지갑 & 모으기 관리</span>
          </Link>
          <Link
            href="/bnb-transfer"
            className={`flex items-center space-x-3 rounded-xl px-4 py-3 font-semibold transition-all ${
              pathname === "/bnb-transfer"
                ? "border border-[#F0B90B]/20 bg-[#F0B90B]/10 text-[#F0B90B]"
                : "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#F0B90B]"
            }`}
          >
            <Send size={18} />
            <span>BNB 송금</span>
          </Link>
          <Link href="/transactions" className="flex items-center space-x-3 rounded-xl px-4 py-3 text-[#8E8E93] transition-all hover:bg-[#1C1C21] hover:text-[#FFFFFF]">
            <Activity size={18} />
            <span>전체 거래 내역 (장부)</span>
          </Link>
          <Link href="/settings" className="flex items-center space-x-3 rounded-xl px-4 py-3 text-[#8E8E93] transition-all hover:bg-[#1C1C21] hover:text-[#FFFFFF]">
            <Settings size={18} />
            <span>시스템 환경 설정</span>
          </Link>
          <Link href="/settings/rounds" className="flex items-center space-x-3 rounded-xl border border-[#BF5AF2]/20 bg-[#BF5AF2]/10 px-4 py-3 font-bold text-[#BF5AF2] transition-all hover:bg-[#BF5AF2]/20">
            <LayoutDashboard size={18} />
            <span>게임 회차 설정</span>
          </Link>
        </nav>

        <div className="mt-auto border-t border-[#26262B] p-4">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#26262B] bg-[#16161A]/80 px-8 backdrop-blur-md">
          <div className="flex items-center space-x-4">
            <h1 className="text-base font-bold text-white">BAO369 바이낸스 체인 통합 관리 시스템</h1>
          </div>

          <div className="flex items-center space-x-4">
            <button className="relative rounded-lg p-2 text-[#8E8E93] transition-all hover:bg-[#1C1C21] hover:text-white">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#FF453A]" />
            </button>

            <div className="flex items-center space-x-3 border-l border-[#26262B] pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] text-xs font-bold text-white">
                369
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-white">최고 관리자</p>
                <p className="text-[10px] text-[#8E8E93]">369어드민 마스터 계정</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">{children}</main>
      </div>
    </>
  );
}
