"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Lock, Mail, User, Shield, AlertCircle } from "lucide-react";
import Link from "next/link";

function RegisterForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [referralCode, setReferralCode] = useState("URC883920");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!referralCode.trim()) {
      setError("邀请码是必填项，没有邀请码无法注册！");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname,
            referred_by: referralCode,
          }
        }
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "发生未知错误");
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
        <Link href="/login" className="px-6 py-3 bg-[#FCD535] text-[#0B0E11] font-bold rounded active:scale-95 transition-all">
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

        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">邮箱地址</label>
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

        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">昵称</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#848E9C]">
              <User size={16} />
            </div>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder="请输入您的昵称"
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">密码</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#848E9C]">
              <Lock size={16} />
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="最少 8 个字符"
              minLength={8}
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[#848E9C] uppercase font-bold ml-1">邀请码 (必填)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#848E9C]">
              <Shield size={16} />
            </div>
            <input 
              type="text" 
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              required
              placeholder="请输入邀请码"
              className="w-full bg-[#1E2329] border border-[#2B3139] focus:border-[#FCD535] pl-11 pr-4 py-3 rounded text-sm text-[#EAECEF] font-semibold outline-none transition-colors uppercase"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3 mt-6 bg-[#FCD535] text-[#0B0E11] font-black rounded text-sm flex items-center justify-center space-x-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-[#0B0E11]/20 border-t-[#0B0E11] rounded-full animate-spin" />
          ) : (
            <>
              <span>注册</span>
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
