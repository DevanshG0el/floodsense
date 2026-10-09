import type { NextConfig } from "next";

// Static export: the whole UI is client-side and talks to the FloodSense API,
// so it can be hosted as plain files on AWS Amplify Hosting (or S3 + CloudFront).
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
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
