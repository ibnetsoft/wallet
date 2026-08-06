"use client";

import { useEffect, useState } from "react";
import { Share, Download } from "lucide-react";

export default function PwaPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    // Check if app is running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;

    // Check if the user has dismissed the prompt before in this session
    const hasDismissed = sessionStorage.getItem("pwa_prompt_dismissed");

    if (!isStandalone && !hasDismissed) {
      setShowPrompt(true);
      
      // Detect iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0C0C0E]/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#FCD535]/20 blur-[50px] rounded-full pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-6 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-[#FCD535] to-[#F5B300] rounded-2xl flex items-center justify-center shadow-lg">
            <Download size={32} className="text-[#0B0E11]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-tight">앱 설치 안내</h2>
            <p className="text-sm text-[#8E8E93] leading-relaxed">
              원활하고 안전한 서비스 이용을 위해<br/>
              <span className="text-[#FCD535] font-bold">홈 화면에 앱을 설치</span>해 주세요.
            </p>
          </div>

          <div className="w-full bg-[#0B0E11] rounded-2xl p-5 border border-[#2C2C2E]">
            {isIOS ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-3 text-sm font-medium text-[#EAECEF]">
                  <span className="w-6 h-6 rounded-full bg-[#2C2C2E] flex items-center justify-center text-xs">1</span>
                  <span>하단의</span>
                  <div className="p-1.5 bg-[#2C2C2E] rounded-lg">
                    <Share size={16} className="text-[#0A84FF]" />
                  </div>
                  <span>공유 버튼 클릭</span>
                </div>
                <div className="w-px h-4 bg-[#2C2C2E]" />
                <div className="flex items-center space-x-3 text-sm font-medium text-[#EAECEF]">
                  <span className="w-6 h-6 rounded-full bg-[#2C2C2E] flex items-center justify-center text-xs">2</span>
                  <span><strong>홈 화면에 추가</strong> 선택</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="flex items-center space-x-3 text-sm font-medium text-[#EAECEF]">
                  <span className="w-6 h-6 rounded-full bg-[#2C2C2E] flex items-center justify-center text-xs">1</span>
                  <span>브라우저 우측 상단 <strong>메뉴(⋮)</strong> 클릭</span>
                </div>
                <div className="w-px h-4 bg-[#2C2C2E]" />
                <div className="flex items-center space-x-3 text-sm font-medium text-[#EAECEF]">
                  <span className="w-6 h-6 rounded-full bg-[#2C2C2E] flex items-center justify-center text-xs">2</span>
                  <span><strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong></span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="text-xs text-[#8E8E93] hover:text-white transition-colors underline underline-offset-4 pt-2"
          >
            건너뛰기 (웹 브라우저로 계속하기)
          </button>
        </div>
      </div>
    </div>
  );
}
