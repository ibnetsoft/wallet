import type { Metadata } from "next";
import "./globals.css";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

export const metadata: Metadata = {
  title: "369어드민 관리자 시스템",
  description: "BAO369 바이낸스 스마트 체인 모노레포 관리자 콘솔",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased bg-[#0C0C0E] text-[#F2F2F7] flex min-h-screen">
        <AdminLayoutWrapper>
          {children}
        </AdminLayoutWrapper>
      </body>
    </html>
  );
}
