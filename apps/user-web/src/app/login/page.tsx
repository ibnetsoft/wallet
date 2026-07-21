"use client";

import React, { useState } from "react";
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
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#0A0A0C] min-h-screen flex flex-col justify-center relative shadow-2xl border-x border-[#1C1C21] font-sans p-6">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#00D2FF]/10 to-transparent pointer-events-none" />
      
      <div className="mb-10 text-center relative z-10">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#00D2FF] to-[#BF5AF2] flex items-center justify-center text-white font-black text-3xl mb-4 shadow-[0_0_30px_rgba(0,210,255,0.3)]">
          U
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Welcome to URC369</h1>
        <p className="text-sm text-[#8E8E93] mt-2">Log in to manage your assets & 369 games</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4 relative z-10">
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
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#00D2FF] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
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
              placeholder="••••••••"
              className="w-full bg-[#141418] border border-[#26262B] focus:border-[#00D2FF] pl-11 pr-4 py-3.5 rounded-xl text-sm text-white font-semibold focus:outline-none transition-colors"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3.5 mt-4 bg-gradient-to-r from-[#00D2FF] to-[#0099CC] text-black font-black rounded-xl text-sm flex items-center justify-center space-x-2 active:scale-95 transition-transform shadow-[0_0_20px_rgba(0,210,255,0.4)] disabled:opacity-50 disabled:active:scale-100"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              <span>Log In</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-xs text-[#8E8E93] relative z-10">
        Don't have an account?{" "}
        <Link href="/register" className="text-[#00D2FF] font-bold hover:underline">
          Register here
        </Link>
      </div>
    </div>
  );
}
