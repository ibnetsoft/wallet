import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { 
  LayoutDashboard, 
  Users, 
  ArrowDownUp, 
  TrendingUp, 
  Settings, 
  Wallet, 
  ShieldAlert,
  Bell
} from "lucide-react";

export const metadata: Metadata = {
  title: "Wallet Admin Backoffice",
  description: "Centralized multi-token wallet control dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0C0C0E] text-[#F2F2F7] flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-[#16161A] border-r border-[#26262B] flex flex-col fixed h-full z-10">
          <div className="h-16 flex items-center px-6 border-b border-[#26262B]">
            <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] tracking-wider">
              WALLET MASTER
            </span>
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-[#FF9F0A]/10 text-[#FF9F0A] rounded border border-[#FF9F0A]/20">
              ADMIN
            </span>
          </div>

          {/* Sidebar Menu */}
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            <Link href="/" className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-[#00D2FF]/10 hover:text-[#00D2FF] text-[#8E8E93] font-semibold transition-all">
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </Link>
            <Link href="/users" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF] transition-all">
              <Users size={18} />
              <span>User Manager</span>
            </Link>
            <Link href="/wallet" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF] transition-all">
              <Wallet size={18} />
              <span>Wallet Sweep</span>
            </Link>
            <Link href="/settings" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-[#8E8E93] hover:bg-[#1C1C21] hover:text-[#FFFFFF] transition-all">
              <Settings size={18} />
              <span>System Settings</span>
            </Link>
          </nav>

          {/* Sidebar Footer (Wallet Monitors) */}
          <div className="p-4 border-t border-[#26262B] bg-[#121215]/50 space-y-3">
            <div className="flex items-center justify-between text-xs text-[#8E8E93] font-semibold uppercase tracking-wider mb-1">
              <span>On-Chain Status</span>
            </div>
            {/* Master Vault */}
            <div className="p-2.5 bg-[#1C1C21] rounded-lg border border-[#26262B]">
              <div className="flex items-center space-x-2 text-[11px] text-[#8E8E93] mb-1">
                <Wallet size={12} color="#00D2FF" />
                <span className="font-medium text-[#F2F2F7]">Master Vault</span>
              </div>
              <p className="text-xs font-bold text-white">1,452,000 USDT</p>
              <p className="text-[10px] text-[#8E8E93] mt-0.5">120.45 BNB</p>
            </div>
            {/* Hot Wallet */}
            <div className="p-2.5 bg-[#1C1C21] rounded-lg border border-[#26262B]">
              <div className="flex items-center space-x-2 text-[11px] text-[#8E8E93] mb-1">
                <ShieldAlert size={12} color="#FF9F0A" />
                <span className="font-medium text-[#F2F2F7]">Hot Wallet</span>
              </div>
              <p className="text-xs font-bold text-white">25,480 USDT</p>
              <p className="text-[10px] text-[#FF9F0A] mt-0.5">Alert Level: 14.50 BNB</p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 pl-64 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-[#26262B] bg-[#16161A]/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
            <div className="flex items-center space-x-4">
              <h1 className="text-base font-bold text-white">BSC Multi-Token Centralized System</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 text-[#8E8E93] hover:text-white rounded-lg hover:bg-[#1C1C21] relative transition-all">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF453A] rounded-full" />
              </button>
              
              {/* Profile */}
              <div className="flex items-center space-x-3 pl-4 border-l border-[#26262B]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] flex items-center justify-center font-bold text-xs text-white">
                  AD
                </div>
                <div className="hidden md:block">
                  <p className="text-xs font-semibold text-white">Administrator</p>
                  <p className="text-[10px] text-[#8E8E93]">Super Admin Account</p>
                </div>
              </div>
            </div>
          </header>

          {/* Children View */}
          <main className="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
