"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Lock, Mail, User, Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

/* 닉네임 유효성: 영문으로 시작, 영문+숫자, 3~20자 */
const NICKNAME_REGEX = /^[A-Za-z][A-Za-z0-9]{2,19}$/;

function validateNickname(value: string, lang: string): string {
  if (!value) return "";
  if (value.length < 3) return lang === "ko" ? "3자 이상 입력하세요" : lang === "en" ? "At least 3 characters" : "请输入至少3个字符";
  if (value.length > 20) return lang === "ko" ? "20자 이하로 입력하세요" : lang === "en" ? "Max 20 characters" : "最多20个字符";
  if (!/^[A-Za-z]/.test(value)) return lang === "ko" ? "영문으로 시작해야 합니다" : lang === "en" ? "Must start with a letter" : "必须以英文字母开头";
  if (!/^[A-Za-z0-9]+$/.test(value)) return lang === "ko" ? "영문·숫자만 가능합니다" : lang === "en" ? "Only letters & numbers" : "只能使用英文字母和数字";
  return "";
}

function RegisterForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [referralCode, setReferralCode] = useState("URC883920");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState<"zh" | "en" | "ko">("zh");

  useEffect(() => {
    const saved = localStorage.getItem("urc_lang");
    if (saved === "zh" || saved === "en" || saved === "ko") {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref);
  }, [searchParams]);

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNickname(val);
    if (nicknameTouched) setNicknameError(validateNickname(val, lang));
  };

  const handleNicknameBlur = () => {
    setNicknameTouched(true);
    setNicknameError(validateNickname(nickname, lang));
  };

  const isNicknameValid = NICKNAME_REGEX.test(nickname);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 닉네임 최종 검증
    const nickErr = validateNickname(nickname, lang);
    if (nickErr || !isNicknameValid) {
      setNicknameTouched(true);
      setNicknameError(nickErr || (lang === "ko" ? "유효한 닉네임을 입력하세요" : lang === "en" ? "Enter a valid nickname" : "请输入有效的昵称(ID)"));
      return;
    }

    if (password !== confirmPassword) {
      setError(lang === "ko" ? "두 비밀번호가 일치하지 않습니다!" : lang === "en" ? "Passwords do not match!" : "两次输入的密码不一致！");
      return;
    }



    if (!referralCode.trim()) {
      setError(lang === "ko" ? "추천코드는 필수 입력 항목입니다!" : lang === "en" ? "Referral code is required!" : "邀请码是必填项，没有邀请码无法注册！");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nickname, referralCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError((err as Error).message || (lang === "ko" ? "알 수 없는 에러가 발생했습니다" : lang === "en" ? "An unknown error occurred" : "发生未知错误"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto bg-[#0B0E11] min-h-screen flex flex-col justify-center items-center text-center p-6 text-[#EAECEF]">
        <div className="w-16 h-16 bg-[#0ECB81]/10 rounded-full flex items-center justify-center text-[#0ECB81] mb-4">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">
          {lang === "ko" ? "가입 완료" : lang === "en" ? "Registration Successful" : "注册成功"}
        </h2>
        <p className="text-sm text-[#848E9C] mb-8">
          {lang === "ko" ? "회원가입이 완료되었습니다! 로그인해 주세요." : lang === "en" ? "Registration completed! Please log in." : "注册成功！请登录。"}
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

  return (
    <div className="w-full max-w-md mx-auto bg-[#0B0E11] min-h-screen flex flex-col justify-center relative p-6 py-12 text-[#EAECEF]">
      <div className="mb-8 text-center relative z-10">
        <h1 className="text-2xl font-black tracking-tight">
          {lang === "ko" ? "회원가입" : lang === "en" ? "Create Account" : "创建账号"}
        </h1>
        <p className="text-sm text-[#848E9C] mt-2">
          {lang === "ko" ? "지금 369 Pass-up 시스템에 합류하세요" : lang === "en" ? "Join 369 Pass-up system today" : "立即加入 369 Pass-up 系统"}
        </p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4 relative z-10">
        {error && (
          <div className="p-3 bg-[#F6465D]/10 border border-[#F6465D]/30 rounded flex items-start space-x-2 text-[#F6465D]">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        {/* 이메일 */}
        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1 flex items-center gap-1.5">
            {lang === "ko" ? "이메일 주소" : lang === "en" ? "Email Address" : "邮箱地址"}
            <span className="text-[#F6465D] font-black">*</span>
          </label>
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#848E9C]">
              <Mail size={16} />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@example.com"
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        {/* 닉네임(ID) */}
        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1 flex items-center gap-1.5">
            {lang === "ko" ? "닉네임 (ID)" : lang === "en" ? "Nickname (ID)" : "昵称 · ID"}
            <span className="text-[#F6465D] font-black">*</span>
          </label>
          <div className="relative">
            {/* 왼쪽 아이콘 — 상태에 따라 색상 변경 */}
            <div
              className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${
                nicknameTouched
                  ? isNicknameValid
                    ? "text-[#0ECB81]"
                    : "text-[#F6465D]"
                  : "text-[#848E9C]"
              }`}
            >
              <User size={16} />
            </div>
            <input
              type="text"
              value={nickname}
              onChange={handleNicknameChange}
              onBlur={handleNicknameBlur}
              required
              maxLength={21}
              autoComplete="username"
              placeholder={lang === "ko" ? "예: JohnDoe123 (영문으로 시작)" : lang === "en" ? "e.g. JohnDoe123 (Starts with letter)" : "例如: JohnDoe123 (以英文字母开头)"}
              className={`w-full bg-[#1E2329] border pl-11 pr-10 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors ${
                nicknameTouched
                  ? isNicknameValid
                    ? "border-[#0ECB81] focus:border-[#0ECB81]"
                    : "border-[#F6465D] focus:border-[#F6465D]"
                  : "border-[#2B3139] focus:border-[#FCD535]"
              }`}
            />
            {/* 오른쪽 상태 아이콘 */}
            {nicknameTouched && nickname && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {isNicknameValid ? (
                  <CheckCircle2 size={16} className="text-[#0ECB81]" />
                ) : (
                  <AlertCircle size={16} className="text-[#F6465D]" />
                )}
              </div>
            )}
          </div>

          {/* 인라인 에러 메시지 */}
          {nicknameTouched && nicknameError && (
            <p className="text-[11px] text-[#F6465D] font-semibold ml-1 flex items-center gap-1">
              <AlertCircle size={11} className="flex-shrink-0" />
              {nicknameError}
            </p>
          )}

          {/* 조건 안내 — 에러 없을 때만 */}
          {!nicknameError && (
            <p className="text-[10px] text-[#848E9C] ml-1">
              {lang === "ko" ? "영문으로 시작 · 영문+숫자 · 3~20자 · 특수문자 불가" : lang === "en" ? "Starts with letter · Alphanumeric · 3~20 chars" : "以英文字母开头 · 仅限英文字母和数字 · 3~20个字符"}
            </p>
          )}

          {/* 글자 수 카운터 */}
          {nickname.length > 0 && (
            <p
              className={`text-[10px] ml-1 text-right font-mono ${
                nickname.length > 20 ? "text-[#F6465D]" : "text-[#848E9C]"
              }`}
            >
              {nickname.length} / 20
            </p>
          )}
        </div>

        {/* 비밀번호 */}
        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1 flex items-center gap-1.5">
            {lang === "ko" ? "비밀번호" : lang === "en" ? "Password" : "密码"}
            <span className="text-[#F6465D] font-black">*</span>
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
              placeholder={lang === "ko" ? "8자리 이상" : lang === "en" ? "Min 8 characters" : "最少 8 个字符"}
              minLength={8}
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        {/* 비밀번호 확인 */}
        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1 flex items-center gap-1.5">
            {lang === "ko" ? "비밀번호 확인" : lang === "en" ? "Confirm Password" : "确认密码"}
            <span className="text-[#F6465D] font-black">*</span>
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
              placeholder={lang === "ko" ? "비밀번호를 다시 입력해주세요" : lang === "en" ? "Enter password again" : "请再次输入密码"}
              minLength={8}
              className={`w-full bg-[#1E2329] border pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors ${
                confirmPassword && password !== confirmPassword
                  ? "border-[#F6465D] focus:border-[#F6465D]"
                  : "border-[#2B3139] focus:border-[#FCD535]"
              }`}
            />
          </div>
        </div>

        {/* 추천코드 */}
        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1 flex items-center gap-1.5">
            {lang === "ko" ? "추천코드" : lang === "en" ? "Referral Code" : "邀请码"}
            <span className="text-[#F6465D] font-black">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#848E9C]">
              <Shield size={16} />
            </div>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              required
              placeholder={lang === "ko" ? "추천코드 입력" : lang === "en" ? "Enter Referral Code" : "邀请码"}
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 mt-4 bg-[#FCD535] text-[#0B0E11] font-bold rounded-lg text-sm flex items-center justify-center space-x-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#0B0E11]/20 border-t-[#0B0E11] rounded-full animate-spin" />
          ) : (
            <>
              <span>{lang === "ko" ? "회원가입" : lang === "en" ? "Register" : "注册"}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-xs text-[#848E9C] relative z-10 pb-6">
        {lang === "ko" ? "이미 계정이 있으신가요?" : lang === "en" ? "Already have an account?" : "已有账号？"}{" "}
        <Link href="/login" className="text-[#FCD535] font-bold hover:underline">
          {lang === "ko" ? "로그인하기" : lang === "en" ? "Go to Login" : "去登录"}
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B0E11]" />}>
      <RegisterForm />
    </Suspense>
  );
}
