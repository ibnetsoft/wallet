"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    if (!confirm("정말 로그아웃 하시겠습니까?")) return;
    
    await supabase.auth.signOut();
    router.refresh(); // This will trigger middleware again
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-[#F6465D]/10 hover:text-[#F6465D] text-[#8E8E93] font-semibold transition-all w-full text-left"
    >
      <LogOut size={18} />
      <span>로그아웃</span>
    </button>
  );
}
