import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || "/admin",
  env: {
    NEXT_PUBLIC_ADMIN_BASE_PATH: process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || "/admin",
  },
};

export default nextConfig;
