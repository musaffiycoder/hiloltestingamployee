import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF shriftlari fayl sifatida o'qiladi — serverless bundle'ga qo'shiladi
  outputFileTracingIncludes: { "/hr/natijalar/[id]/pdf": ["./src/assets/fonts/**"] },
  serverExternalPackages: ["@react-pdf/renderer"],
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
