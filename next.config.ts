import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  logging: {
    incomingRequests: { ignore: [/^\/(?:api\/(?:public\/)?)?member-invitations\//] },
  },
  async headers() {
    const protectedInvitationHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      "/member-invitations/:token",
      "/api/public/member-invitations/:token",
      "/api/member-invitations/:token/accept",
    ].map((source) => ({ source, headers: protectedInvitationHeaders }));
  },
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
