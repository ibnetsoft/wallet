"use client";

import { useState } from "react";
import { Shield, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        // Successful login, refresh router to apply middleware
        router.refresh();
        router.push("/");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0C0C0E] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#16161A] border border-[#26262B] rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* 네온 장식 */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2]"></div>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#00D2FF]/10 rounded-2xl flex items-center justify-center text-[#00D2FF] mb-4 border border-[#00D2FF]/20 shadow-[0_0_15px_rgba(0,210,255,0.2)]">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] tracking-wider mb-2">
            369어드민
          </h1>
          <p className="text-sm text-[#8E8E93] font-medium">
            관리자 콘솔 접근 권한이 필요합니다
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3 bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-xl flex items-start space-x-2 text-[#FF453A]">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] text-[#8E8E93] uppercase font-bold ml-1 tracking-wider">
              관리자 이메일
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8E8E93]">
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] focus:border-[#00D2FF] pl-11 pr-4 py-3.5 rounded-xl text-sm text-[#F2F2F7] font-semibold outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-[#8E8E93] uppercase font-bold ml-1 tracking-wider">
              비밀번호
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8E8E93]">
                <Lock size={16} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] focus:border-[#00D2FF] pl-11 pr-4 py-3.5 rounded-xl text-sm text-[#F2F2F7] font-semibold outline-none transition-colors tracking-widest"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-gradient-to-r from-[#00D2FF] to-[#BF5AF2] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center mt-2 shadow-[0_4px_15px_rgba(191,90,242,0.3)]"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : "로그인"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[11px] text-[#48484A]">
            보안을 위해 인가된 관리자만 접근할 수 있습니다.<br/>
            (ADMIN_EMAILS 환경 변수 참조)
          </p>
        </div>
      </div>
    </div>
  );
}
