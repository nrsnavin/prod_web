/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// ══════════════════════════════════════════════════════════════════
//  THE CUSTOMER PORTAL'S OWN BUILD
//
//  portal.baluelastics.com is a separate small app: customers download
//  only the portal's code, never the staff app's. It shares src/ (the
//  design system, the formatters) and the Tailwind theme, and builds to
//  dist-portal/, which Caddy serves on its own host.
//
//    npm run dev:portal     http://localhost:5174, /api proxied
//    npm run build:portal   dist-portal/
// ══════════════════════════════════════════════════════════════════
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here("."), "");
  const proxyTarget = env.VITE_PROXY_TARGET || "https://api.baluelastics.com";
  return {
    root: here("./portal"),
    envDir: here("."),
    publicDir: here("./portal/public"),
    plugins: [react()],
    build: {
      outDir: here("./dist-portal"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-data": ["@tanstack/react-query", "axios"],
          },
        },
      },
    },
    resolve: { alias: { "@": here("./src") } },
    server: {
      port: 5174,
      proxy: { "/api": { target: proxyTarget, changeOrigin: true } },
    },
  };
});
