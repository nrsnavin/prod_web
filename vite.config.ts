/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In dev, /api is proxied to the backend so the app runs same-origin
// (no CORS, and the httpOnly auth cookie is accepted on localhost).
// In production builds, set VITE_API_BASE_URL to the real backend URL.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET || "https://api.baluelastics.com";

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          // ── What the main chunk was, and why it was large ────────
          //  Routes are all split out, so the ~500 KB left in index.js
          //  was almost entirely vendor code: React, the router, the
          //  query client, axios, the form/validation stack. It was
          //  paid on every cold load AND re-downloaded in full every
          //  time any application file changed, because one hash
          //  covered the lot.
          //
          //  Splitting it on dependency lifetime rather than on size:
          //  react and react-dom change a few times a year, the app
          //  changes daily. Separating them means a deploy invalidates
          //  the app chunk and leaves the framework cached.
          //
          //  Grouped, not one-chunk-per-package, because dozens of tiny
          //  requests on a slow connection cost more than they save.
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-data": ["@tanstack/react-query", "axios"],
            "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
