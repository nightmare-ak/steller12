import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["contract"],
  serverExternalPackages: ["@stellar/stellar-sdk"],
};

export default nextConfig;
