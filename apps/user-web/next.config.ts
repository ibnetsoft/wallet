import type { NextConfig } from "next";

const adminOrigin = process.env.ADMIN_APP_ORIGIN?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_BUILD: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  },
  async rewrites() {
    if (!adminOrigin) {
      return [];
    }

    return [
      {
        source: "/admin",
        destination: `${adminOrigin}/admin`,
      },
      {
        source: "/admin/:path*",
        destination: `${adminOrigin}/admin/:path*`,
      },
    ];
  },
};

export default nextConfig;
