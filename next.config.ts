import type { NextConfig } from "next";

// The blog is served at https://kriosity.in/blog.
// kriosity.in (repo dhalishiva/kriosity) rewrites /blog/* to this app's Vercel
// deployment, so every route and asset here lives under the /blog base path.
const nextConfig: NextConfig = {
  basePath: "/blog",
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
