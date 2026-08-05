"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, AlertCircle, CheckCircle2, Shield } from "lucide-react";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"zh" | "en" | "ko">("zh");

  useEffect(() => {
    const saved = localStorage.getItem("urc_lang");
    if (saved === "zh" || saved === "en" || saved === "ko") {
      setLang(saved);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(
        lang === "ko"
          ? "유효하지 않거나 만료된 링크입니다."
          : lang === "en"
          ? "Invalid or expired link."
          : "链接无效或已过期。"
      );
      return;
    }

    if (password.length < 6) {
      setError(
        lang === "ko"
          ? "비밀번호는 최소 6자 이상이어야 합니다."
          : lang === "en"
          ? "Password must be at least 6 characters."
          : "密码长度 code 必须 & ge; 6位。"
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        lang === "ko"
          ? "비밀번호가 일치하지 않습니다."
          : lang === "en"
          ? "Passwords do not match."
          : "两次输入的密码不一致。"
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "비밀번호 재설정에 실패했습니다.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto bg-[#0B0E11] min-h-screen flex flex-col justify-center items-center text-center p-6 text-[#EAECEF]">
        <div className="w-16 h-16 bg-[#F6465D]/10 rounded-full flex items-center justify-center text-[#F6465D] mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">
          {lang === "ko" ? "잘못된 접근" : lang === "en" ? "Invalid Request" : "无效请求"}
        </h2>
        <p className="text-sm text-[#848E9C] mb-8">
          {lang === "ko"
            ? "비밀번호 재설정 토큰이 누락되었거나 만료되었습니다."
            : lang === "en"
            ? "Password reset token is missing or has expired."
            : "密码重置标记丢失或已过期。"}
        </p>
        <Link
          href="/login"
          className="px-6 py-3 bg-[#FCD535] text-[#0B0E11] font-bold rounded active:scale-95 transition-all"
        >
          {lang === "ko" ? "로그인 페이지로" : lang === "en" ? "Back to Login" : "返回登录"}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto bg-[#0B0E11] min-h-screen flex flex-col justify-center items-center text-center p-6 text-[#EAECEF]">
        <div className="w-16 h-16 bg-[#0ECB81]/10 rounded-full flex items-center justify-center text-[#0ECB81] mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">
          {lang === "ko" ? "재설정 완료" : lang === "en" ? "Password Reset Successfully" : "密码重置成功"}
        </h2>
        <p className="text-sm text-[#848E9C] mb-8">
          {lang === "ko"
            ? "비밀번호가 성공적으로 변경되었습니다. 새로운 비밀번호로 로그인해 주세요."
            : lang === "en"
            ? "Your password has been changed successfully. Please log in with your new password."
            : "您的密码已成功更改。请使用新密码登录。"}
        </p>
        <Link
          href="/login"
          className="px-6 py-3 bg-[#FCD535] text-[#0B0E11] font-bold rounded active:scale-95 transition-all"
        >
          {lang === "ko" ? "로그인하기" : lang === "en" ? "Log In Now" : "立即登录"}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-[#0B0E11] min-h-screen flex flex-col justify-center relative p-6 py-12 text-[#EAECEF]">
      <div className="mb-8 text-center relative z-10">
        <div className="w-16 h-16 bg-[#FCD535]/10 rounded-2xl flex items-center justify-center text-[#FCD535] mb-4 mx-auto border border-[#FCD535]/20 shadow-[0_0_15px_rgba(252,213,53,0.15)]">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl font-black tracking-tight">
          {lang === "ko" ? "비밀번호 재설정" : lang === "en" ? "Reset Password" : "重置密码"}
        </h1>
        <p className="text-sm text-[#848E9C] mt-2">
          {lang === "ko"
            ? "새로운 비밀번호를 입력해 주세요."
            : lang === "en"
            ? "Please enter your new password."
            : "请输入您的新密码。"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
        {error && (
          <div className="p-3 bg-[#F6465D]/10 border border-[#F6465D]/30 rounded flex items-start space-x-2 text-[#F6465D]">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">
            {lang === "ko" ? "새 비밀번호" : lang === "en" ? "New Password" : "新密码"}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#848E9C]">
              <Lock size={16} />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">
            {lang === "ko" ? "새 비밀번호 확인" : lang === "en" ? "Confirm New Password" : "确认新密码"}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#848E9C]">
              <Lock size={16} />
            </div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 mt-4 bg-[#FCD535] hover:bg-[#e5c130] text-[#0B0E11] font-black rounded-xl text-sm flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(252,213,53,0.3)] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <span>{lang === "ko" ? "비밀번호 변경하기" : lang === "en" ? "Change Password" : "确认修改密码"}</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#FCD535]/20 border-t-[#FCD535] rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
