import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "huawei-food-cms.grab.com" },
      { protocol: "https", hostname: "food.grab.com" },
    ],
  },
  reactStrictMode: true,
};

export default nextConfig;
