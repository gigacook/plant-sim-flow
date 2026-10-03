import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
