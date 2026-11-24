import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  logging: {
    incomingRequests: { ignore: [
      /^\/(?:api\/(?:public\/)?)?member-invitations\//,
      /^\/(?:invite|api\/public\/invitations)\//,
      /^\/(?:gallery|api\/public\/galleries)\//,
    ] },
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
      "/invite/:token",
      "/api/public/invitations/:token",
      "/api/public/invitations/:token/rsvp",
      "/gallery/:token",
      "/api/public/galleries/:token/:path*",
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
