"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ArrowRight, Lock, Mail, User, Shield, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [referralCode, setReferralCode] = useState("");
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname,
            // referral_code will be processed by DB trigger later or API
            referred_by: referralCode,
          }
        }
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
        // Supabase requires email verification by default, depending on settings
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto bg-[#0A0A0C] min-h-screen flex flex-col justify-center items-center text-center p-6 border-x border-[#1C1C21]">
        <div className="w-16 h-16 bg-[#30D5C8]/10 rounded-full flex items-center justify-center text-[#30D5C8] mb-4">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Registration Successful</h2>
        <p className="text-sm text-[#8E8E93] mb-8">
          Please check your email to verify your account, then log in to continue.
        </p>
        <Link href="/login" className="px-6 py-3 bg-[#00D2FF] text-black font-bold rounded-xl active:scale-95 transition-all">
          Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-[#0A0A0C] min-h-screen flex flex-col justify-center relative shadow-2xl border-x border-[#1C1C21] font-sans p-6 py-12">
      <div className="absolute top-0 right-0 w-full h-64 bg-gradient-to-b from-[#BF5AF2]/10 to-transparent pointer-events-none" />
      
      <div className="mb-8 text-center relative z-10">
        <h1 className="text-2xl font-black text-white tracking-tight">Create Account</h1>
        <p className="text-sm text-[#8E8E93] mt-2">Join the 369 Pass-up system today</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4 relative z-10">
        {error && (
          <div className="p-3 bg-[#FF453A]/10 border border-[#FF453A]/30 rounded-xl flex items-start space-x-2 text-[#FF453A]">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-1">Email Address</label>
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
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#BF5AF2] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-1">Nickname</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8E8E93]">
              <User size={16} />
            </div>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              placeholder="Your preferred name"
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#BF5AF2] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-1">Password</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8E8E93]">
              <Lock size={16} />
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Min 8 characters"
              minLength={8}
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#BF5AF2] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-[#8E8E93] uppercase font-bold ml-1">Referral Code (Optional)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8E8E93]">
              <Shield size={16} />
            </div>
            <input 
              type="text" 
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="e.g. URC883920"
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#BF5AF2] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors uppercase"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3.5 mt-6 bg-gradient-to-r from-[#BF5AF2] to-[#9A3FD0] text-white font-black rounded-xl text-sm flex items-center justify-center space-x-2 active:scale-95 transition-transform shadow-[0_0_20px_rgba(191,90,242,0.4)] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span>Sign Up</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-xs text-[#8E8E93] relative z-10 pb-6">
        Already have an account?{" "}
        <Link href="/login" className="text-[#BF5AF2] font-bold hover:underline">
          Log in
        </Link>
      </div>
    </div>
  );
}
