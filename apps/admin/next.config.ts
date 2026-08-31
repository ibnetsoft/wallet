import type { NextConfig } from "next";

const adminBasePath = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || "/admin";

const nextConfig: NextConfig = {
  basePath: adminBasePath,
  env: {
    NEXT_PUBLIC_ADMIN_BASE_PATH: adminBasePath,
  },
  async redirects() {
    return [
      {
        source: `${adminBasePath}${adminBasePath}/:path*`,
        destination: `${adminBasePath}/:path*`,
        permanent: false,
        basePath: false,
      },
      {
        source: `${adminBasePath}${adminBasePath}`,
        destination: adminBasePath,
        permanent: false,
        basePath: false,
      },
      {
        source: "/",
        destination: adminBasePath,
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
