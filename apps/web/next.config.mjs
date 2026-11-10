import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for the node:22-alpine Dockerfile (server.js).
  output: "standalone",
  // Pin the workspace root so Turbopack does not pick up lockfiles above the repo.
  turbopack: { root },
};

export default nextConfig;
