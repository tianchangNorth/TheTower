import type { NextConfig } from "next";

// Phase 1a：同源代理后端 API 与 SSE。默认指向 @the-tower/api dev 端口。
const apiTarget = process.env.THE_TOWER_API_TARGET ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiTarget}/api/:path*` },
      { source: "/health", destination: `${apiTarget}/health` },
    ];
  },
};

export default nextConfig;
