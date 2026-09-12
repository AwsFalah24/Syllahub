import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "unpdf", "web-push"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
