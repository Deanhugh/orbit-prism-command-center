import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the app to this folder. A stray package-lock.json in the home
  // directory otherwise makes Turbopack treat all of ~ as the workspace
  // (slow first load, "Loading…" hang, huge memory).
  turbopack: { root },
  outputFileTracingRoot: root,
  // Preview / Cloudflare tunnels must not be blocked as "cross-origin" by Next.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.trycloudflare.com",
  ],
  // The floating Next.js badge is another long-lived client connection.
  devIndicators: false,
};

export default nextConfig;
