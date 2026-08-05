"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"zh" | "en" | "ko">("zh");
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("urc_lang");
    if (saved === "zh" || saved === "en" || saved === "ko") {
      setLang(saved);
    }
  }, []);

  const changeLang = (l: "zh" | "en" | "ko") => {
    setLang(l);
    localStorage.setItem("urc_lang", l);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log("handleLogin triggered on client side for:", email);
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("signInWithPassword result:", data, error);

      if (error) {
        setError(error.message);
      } else {
        console.log("Redirecting to dashboard...");
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      console.error("Login catch error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#0A0A0C] min-h-screen flex flex-col justify-center relative shadow-2xl border-x border-[#1C1C21] font-sans p-6">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#00D2FF]/10 to-transparent pointer-events-none" />
      
      <div className="mb-10 text-center relative z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="U彩宝369"
          className="w-32 h-auto mx-auto mb-4 object-contain"
          style={{ mixBlendMode: "lighten" }}
        />
        <h1 className="text-2xl font-black text-white tracking-tight">
          {lang === "ko" ? "URC369 환영합니다" : lang === "en" ? "Welcome to URC369" : "欢迎来到 URC369"}
        </h1>
        <p className="text-sm text-[#8E8E93] mt-2">
          {lang === "ko" ? "자산과 369 게임을 관리하려면 로그인하세요" : lang === "en" ? "Log in to manage your assets & 369 games" : "登录以管理您的资产和 369 游戏"}
        </p>
      </div>

      <div className="space-y-4 relative z-10">
        {error && (
          <div className="p-3 bg-[#FF453A]/10 border border-[#FF453A]/30 rounded-xl flex items-start space-x-2 text-[#FF453A]">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-1">
            {lang === "ko" ? "이메일 주소" : lang === "en" ? "Email Address" : "邮箱地址"}
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
              placeholder="name@example.com"
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#00D2FF] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-1">
            {lang === "ko" ? "비밀번호" : lang === "en" ? "Password" : "密码"}
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
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#00D2FF] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        <button 
          type="button" 
          onClick={() => handleLogin()}
          disabled={loading}
          className="w-full py-3.5 mt-4 bg-[#FCD535] hover:bg-[#e5c130] text-[#0B0E11] font-black rounded-xl text-sm flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(252,213,53,0.3)] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <span>{lang === "ko" ? "로그인" : lang === "en" ? "Log In" : "登录"}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>

      <div className="mt-8 text-center text-xs text-[#8E8E93] relative z-10">
        {lang === "ko" ? "계정이 없으신가요?" : lang === "en" ? "Don't have an account?" : "还没有账号？"}{" "}
        <Link href="/register" className="text-[#FCD535] font-bold hover:underline">
          {lang === "ko" ? "회원가입" : lang === "en" ? "Register here" : "立即注册"}
        </Link>
      </div>

      {/* 언어 선택 */}
      <div className="mt-8 flex justify-center items-center space-x-6 relative z-10">
        <button onClick={() => changeLang("zh")} className={`transition-all ${lang === "zh" ? "scale-125 grayscale-0 ring-2 ring-[#FCD535] rounded-sm" : "grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:scale-110"}`} title="中文">
          <img src="https://flagcdn.com/w40/cn.png" alt="中文" className="w-7 h-auto rounded-sm shadow-md" />
        </button>
        <button onClick={() => changeLang("en")} className={`transition-all ${lang === "en" ? "scale-125 grayscale-0 ring-2 ring-[#FCD535] rounded-sm" : "grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:scale-110"}`} title="English">
          <img src="https://flagcdn.com/w40/gb.png" alt="English" className="w-7 h-auto rounded-sm shadow-md" />
        </button>
        <button onClick={() => changeLang("ko")} className={`transition-all ${lang === "ko" ? "scale-125 grayscale-0 ring-2 ring-[#FCD535] rounded-sm" : "grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:scale-110"}`} title="한국어">
          <img src="https://flagcdn.com/w40/kr.png" alt="한국어" className="w-7 h-auto rounded-sm shadow-md" />
        </button>
      </div>
    </div>
  );
}
