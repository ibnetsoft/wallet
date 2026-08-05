"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Lock, Mail, AlertCircle, CheckCircle2, Shield, X } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const supabase = createClient();
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"zh" | "en" | "ko">("zh");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetNickname, setResetNickname] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");
  const router = useRouter();

  const [verifiedMsg, setVerifiedMsg] = useState("");

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetNickname.trim()) return;

    setResetLoading(true);
    setResetError("");
    setResetSuccess(false);

    try {
      const res = await fetch("/api/auth/reset-password-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: resetNickname }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetSuccess(true);
      } else {
        setResetError(data.error || "요청에 실패했습니다.");
      }
    } catch (err: any) {
      setResetError(err.message || "오류가 발생했습니다.");
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("urc_lang");
    if (saved === "zh" || saved === "en" || saved === "ko") {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("verified") === "true") {
        setVerifiedMsg(
          lang === "ko"
            ? "이메일 인증이 완료되었습니다! 로그인해 주세요."
            : lang === "en"
            ? "Email verified successfully! Please log in."
            : "邮箱验证已完成！请登录。"
        );
      }
    }
  }, [lang]);

  const changeLang = (l: "zh" | "en" | "ko") => {
    setLang(l);
    localStorage.setItem("urc_lang", l);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log("handleLogin triggered on client side for:", nickname);
    setError("");
    setVerifiedMsg("");
    setLoading(true);

    try {
      const proxyEmail = `${nickname.trim().toLowerCase()}@sys.hongbou.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: proxyEmail,
        password,
      });

      console.log("signInWithPassword result:", data, error);

      if (error) {
        setError(error.message);
      } else if (data?.user) {
        // Record last login time
        try {
          await fetch('/api/auth/record-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user.id })
          });
        } catch (e) {
          console.error("Failed to record login time", e);
        }

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
          {lang === "ko" ? "BAO369 환영합니다" : lang === "en" ? "Welcome to BAO369" : "欢迎来到 BAO369"}
        </h1>
        <p className="text-sm text-[#8E8E93] mt-2">
          {lang === "ko" ? "자산과 369 게임을 관리하려면 로그인하세요" : lang === "en" ? "Log in to manage your assets & 369 games" : "登录以管理您的资产和 369 游戏"}
        </p>
      </div>

      <div className="space-y-4 relative z-10">
        {verifiedMsg && (
          <div className="p-3 bg-[#0ECB81]/10 border border-[#0ECB81]/30 rounded-xl flex items-start space-x-2 text-[#0ECB81]">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-semibold">{verifiedMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-[#FF453A]/10 border border-[#FF453A]/30 rounded-xl flex items-start space-x-2 text-[#FF453A]">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-1">
            {lang === "ko" ? "닉네임 (ID)" : lang === "en" ? "Nickname (ID)" : "昵称 (ID)"}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8E8E93]">
              <Mail size={16} />
            </div>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder={lang === "ko" ? "닉네임을 입력하세요" : lang === "en" ? "Enter Nickname" : "请输入昵称"}
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#00D2FF] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[10px] text-[#8E8E93] uppercase font-bold">
              {lang === "ko" ? "비밀번호" : lang === "en" ? "Password" : "密码"}
            </label>
            <button 
              type="button"
              onClick={() => {
                setShowResetModal(true);
                setResetError("");
                setResetSuccess(false);
                setResetNickname("");
              }}
              className="text-[10px] text-[#FCD535] font-bold hover:underline bg-transparent border-none cursor-pointer"
            >
              {lang === "ko" ? "비밀번호 분실?" : lang === "en" ? "Forgot Password?" : "忘记密码？"}
            </button>
          </div>
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

      {/* 비밀번호 분실 모달 */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141418] border border-[#26262B] rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-[#8E8E93] hover:text-white p-1 hover:bg-[#26262B] rounded transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-[#FCD535]/10 rounded-xl flex items-center justify-center text-[#FCD535] mb-3 border border-[#FCD535]/20">
                <Shield size={22} />
              </div>
              <h3 className="text-base font-bold text-white">
                {lang === "ko" ? "비밀번호 재설정" : lang === "en" ? "Reset Password" : "重置密码"}
              </h3>
              <p className="text-xs text-[#8E8E93] mt-2 max-w-[280px]">
                {lang === "ko"
                  ? "가입 시 사용한 닉네임(ID)을 입력해 주세요. 연결된 진짜 이메일 주소로 재설정 링크를 보내드립니다."
                  : lang === "en"
                  ? "Please enter your nickname (ID). We will send a reset link to your registered email address."
                  : "请输入您的昵称(ID)。我们将向您绑定的真实邮箱发送重置链接。"}
              </p>
            </div>

            <form onSubmit={handleResetRequest} className="space-y-3 pt-2">
              {resetError && (
                <div className="p-2.5 bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-xl flex items-start space-x-2 text-[#FF453A]">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span className="text-[11px] font-semibold">{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-2.5 bg-[#0ECB81]/10 border border-[#0ECB81]/20 rounded-xl flex items-start space-x-2 text-[#0ECB81]">
                  <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                  <span className="text-[11px] font-semibold">
                    {lang === "ko"
                      ? "비밀번호 재설정 메일이 발송되었습니다! 메일함을 확인해 주세요."
                      : lang === "en"
                      ? "Reset link sent! Please check your email inbox."
                      : "重置邮件已发送！请检查您的邮箱。"}
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <input
                  type="text"
                  required
                  value={resetNickname}
                  onChange={(e) => setResetNickname(e.target.value)}
                  placeholder={lang === "ko" ? "닉네임(ID) 입력" : lang === "en" ? "Enter Nickname" : "输入昵称(ID)"}
                  className="w-full bg-[#1C1C1E] border border-[#2C2C2E] focus:border-[#FCD535] px-4 py-2.5 rounded-xl text-sm text-white font-semibold outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-2.5 mt-2 bg-[#FCD535] hover:bg-[#e5c130] text-[#0B0E11] font-black rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-[0_0_15px_rgba(252,213,53,0.2)] disabled:opacity-50"
              >
                {resetLoading ? (
                  <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <span>{lang === "ko" ? "재설정 링크 받기" : lang === "en" ? "Get Reset Link" : "获取重置链接"}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
