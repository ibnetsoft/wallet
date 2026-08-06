import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaPrompt from "../components/PwaPrompt";

export const metadata: Metadata = {
  title: "U彩宝369",
  description: "Secure multi-token mobile wallet client",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "U彩宝369",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased bg-[#0C0C0E] text-[#F2F2F7] min-h-screen flex flex-col justify-between">
        <PwaPrompt />
        {children}
      </body>
    </html>
  );
}
