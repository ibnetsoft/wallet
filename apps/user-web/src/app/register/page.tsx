"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Lock, Mail, User, Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

/* 닉네임 유효성: 영문으로 시작, 영문+숫자, 3~20자 */
const NICKNAME_REGEX = /^[A-Za-z][A-Za-z0-9]{2,19}$/;

function validateNickname(value: string): string {
  if (!value) return "";
  if (value.length < 3) return "3자 이상 입력하세요 · At least 3 characters";
  if (value.length > 20) return "20자 이하로 입력하세요 · Max 20 characters";
  if (!/^[A-Za-z]/.test(value)) return "영문으로 시작해야 합니다 · Must start with a letter";
  if (!/^[A-Za-z0-9]+$/.test(value)) return "영문·숫자만 사용 가능합니다 · Only letters & numbers";
  return "";
}

function RegisterForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [referralCode, setReferralCode] = useState("URC883920");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref);
  }, [searchParams]);

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNickname(val);
    if (nicknameTouched) setNicknameError(validateNickname(val));
  };

  const handleNicknameBlur = () => {
    setNicknameTouched(true);
    setNicknameError(validateNickname(nickname));
  };

  const isNicknameValid = NICKNAME_REGEX.test(nickname);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 닉네임 최종 검증
    const nickErr = validateNickname(nickname);
    if (nickErr || !isNicknameValid) {
      setNicknameTouched(true);
      setNicknameError(nickErr || "유효한 닉네임(ID)을 입력하세요 · Enter a valid nickname");
      return;
    }

    if (!referralCode.trim()) {
      setError("邀请码是必填项，没有邀请码无法注册！");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname,
            referred_by: referralCode,
          },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: unknown) {
      setError((err as Error).message || "发生未知错误");
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
        <h2 className="text-xl font-bold mb-2">注册成功</h2>
        <p className="text-sm text-[#848E9C] mb-8">
          请检查您的邮箱进行验证，然后登录。
        </p>
        <Link
          href="/login"
          className="px-6 py-3 bg-[#FCD535] text-[#0B0E11] font-bold rounded active:scale-95 transition-all"
        >
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-[#0B0E11] min-h-screen flex flex-col justify-center relative p-6 py-12 text-[#EAECEF]">
      <div className="mb-8 text-center relative z-10">
        <h1 className="text-2xl font-black tracking-tight">创建账号</h1>
        <p className="text-sm text-[#848E9C] mt-2">立即加入 369 Pass-up 系统</p>
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
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">
            邮箱地址 (이메일)
          </label>
          <div className="relative">
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
            昵称 · ID (닉네임)
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
              placeholder="예: JohnDoe123 (영문으로 시작)"
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
              영문으로 시작 · 영문+숫자 · 3~20자 · 특수문자 불가
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
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">
            密码 (비밀번호)
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
              placeholder="8자리 이상 / 最少 8 个字符"
              minLength={8}
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        {/* 추천코드 */}
        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">
            邀请码 (추천코드 - 필수)
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
              placeholder="추천코드 / 邀请码"
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
              <span>注册 (회원가입)</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-xs text-[#848E9C] relative z-10 pb-6">
        已有账号？{" "}
        <Link href="/login" className="text-[#FCD535] font-bold hover:underline">
          去登录
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
