"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Calculator,
  LayoutDashboard,
  Send,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/client";
import { isSuperAdmin } from "@/lib/admin-access";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  restricted?: boolean;
  activeClassName: string;
  inactiveClassName: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "대시보드",
    icon: LayoutDashboard,
    activeClassName: "border border-[#00D2FF]/20 bg-[#00D2FF]/10 text-[#00D2FF]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#00D2FF]/10 hover:text-[#00D2FF]",
  },
  {
    href: "/withdrawals",
    label: "출금 승인 심사 관리",
    icon: ArrowUpRight,
    restricted: true,
    activeClassName: "border border-[#FF9F0A]/20 bg-[#FF9F0A]/10 text-[#FF9F0A]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FF9F0A]",
  },
  {
    href: "/users",
    label: "회원 관리",
    icon: Users,
    activeClassName: "border border-[#30D5C8]/20 bg-[#30D5C8]/10 text-[#30D5C8]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF]",
  },
  {
    href: "/wallet",
    label: "지갑 & 모으기 관리",
    icon: Wallet,
    restricted: true,
    activeClassName: "border border-[#00D2FF]/20 bg-[#00D2FF]/10 text-[#00D2FF]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF]",
  },
  {
    href: "/bnb-transfer",
    label: "BNB 송금",
    icon: Send,
    restricted: true,
    activeClassName: "border border-[#F0B90B]/20 bg-[#F0B90B]/10 text-[#F0B90B]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#F0B90B]",
  },
  {
    href: "/transactions",
    label: "전체 거래 내역 (장부)",
    icon: Activity,
    activeClassName: "border border-[#30D5C8]/20 bg-[#30D5C8]/10 text-[#30D5C8]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF]",
  },
  {
    href: "/allowances",
    label: "배당내역",
    icon: Calculator,
    activeClassName: "border border-[#00D2FF]/20 bg-[#00D2FF]/10 text-[#00D2FF]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#00D2FF]",
  },
  {
    href: "/settings",
    label: "시스템 환경 설정",
    icon: Settings,
    restricted: true,
    activeClassName: "border border-[#BF5AF2]/20 bg-[#BF5AF2]/10 text-[#BF5AF2]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF]",
  },
  {
    href: "/settings/rounds",
    label: "게임 회차 설정",
    icon: LayoutDashboard,
    activeClassName: "border border-[#BF5AF2]/20 bg-[#BF5AF2]/10 text-[#BF5AF2]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#BF5AF2]",
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href;
}

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [canViewRestrictedMenu, setCanViewRestrictedMenu] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadAdminRole() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();

      if (mounted) {
        setCanViewRestrictedMenu(isSuperAdmin(data.user));
      }
    }

    loadAdminRole().catch(() => {
      if (mounted) {
        setCanViewRestrictedMenu(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoginPage) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  const navItems = NAV_ITEMS.filter((item) => canViewRestrictedMenu || !item.restricted);

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
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 rounded-xl px-4 py-3 font-semibold transition-all ${
                  active ? item.activeClassName : item.inactiveClassName
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
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
