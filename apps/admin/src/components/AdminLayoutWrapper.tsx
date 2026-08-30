"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calculator,
  LayoutDashboard,
  Send,
  Settings,
  Users,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/client";
import { SUPER_ADMIN_ROLE } from "@/lib/admin-access";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  superAdminOnly?: boolean;
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
    superAdminOnly: true,
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
    superAdminOnly: true,
    activeClassName: "border border-[#00D2FF]/20 bg-[#00D2FF]/10 text-[#00D2FF]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF]",
  },
  {
    href: "/bnb-transfer",
    label: "BNB 송금",
    icon: Send,
    superAdminOnly: true,
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
    href: "/betting-daily",
    label: "일별 배팅 총액",
    icon: BarChart3,
    activeClassName: "border border-[#26A17B]/20 bg-[#26A17B]/10 text-[#26A17B]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#26A17B]",
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
    superAdminOnly: true,
    activeClassName: "border border-[#BF5AF2]/20 bg-[#BF5AF2]/10 text-[#BF5AF2]",
    inactiveClassName: "text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF]",
  },
  {
    href: "/settings/rounds",
    label: "게임 회차 설정",
    icon: LayoutDashboard,
    superAdminOnly: true,
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
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const resetAdminState = useCallback(() => {
    setAdminRole(null);
    setAdminEmail("");
  }, []);

  const fetchAdminData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/me", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.success || !data.admin) {
        resetAdminState();
        return;
      }

      setAdminRole(data.admin.role);
      setAdminEmail(data.admin.email);
    } catch {
      resetAdminState();
    }
  }, [resetAdminState]);

  // Listen to Supabase auth state changes (login, logout, token refresh)
  useEffect(() => {
    const supabase = createClient();

    // Initial fetch
    fetchAdminData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Re-fetch admin data whenever auth changes
        fetchAdminData();
      } else if (event === "SIGNED_OUT") {
        resetAdminState();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchAdminData, resetAdminState]);

  // Handle mobile bfcache: re-fetch when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isLoginPage) {
        fetchAdminData();
      }
    };

    // pageshow fires when page is restored from bfcache
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !isLoginPage) {
        fetchAdminData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [fetchAdminData, isLoginPage]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  const isSuperAdmin = adminRole === SUPER_ADMIN_ROLE;
  const navItems = NAV_ITEMS.filter((item) => {
    if (isSuperAdmin) {
      return true;
    }
    if (item.superAdminOnly) {
      return false;
    }
    return true;
  });
  const accountLabel = isSuperAdmin ? "최고 관리자" : "관리자";
  const accountDescription = isSuperAdmin
    ? "369어드민 마스터 계정"
    : "제한 권한 운영 계정";
  const accountBadge = isSuperAdmin ? "369" : "SUB";

  return (
    <>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-[#26262B] bg-[#16161A] transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#26262B] px-6">
          <div className="flex items-center">
            <span className="bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] bg-clip-text text-lg font-bold tracking-wider text-transparent">
              369어드민
            </span>
            <span className="ml-2 rounded border border-[#FF9F0A]/20 bg-[#FF9F0A]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#FF9F0A]">
              ADMIN
            </span>
          </div>
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
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

      <div className="flex min-h-screen flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#26262B] bg-[#16161A]/80 px-4 md:px-8 backdrop-blur-md">
          <div className="flex items-center space-x-4">
            <button
              className="md:hidden text-gray-400 hover:text-white mr-2"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-base font-bold text-white hidden sm:block">BAO369 바이낸스 체인 통합 관리 시스템</h1>
            <h1 className="text-base font-bold text-white sm:hidden">BAO369</h1>
          </div>

          <div className="flex items-center space-x-4">
            <button className="relative rounded-lg p-2 text-[#8E8E93] transition-all hover:bg-[#1C1C21] hover:text-white">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#FF453A]" />
            </button>

            <div className="flex items-center space-x-3 border-l border-[#26262B] pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] text-xs font-bold text-white">
                {accountBadge}
              </div>
              <div className="hidden md:block">
                <p className="text-xs font-semibold text-white">{accountLabel}</p>
                <p className="text-[10px] text-[#8E8E93]">
                  {adminEmail || accountDescription}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </>
  );
}
