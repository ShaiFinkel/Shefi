import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon-32.png",
        "favicon-64.png",
        "apple-touch-icon.png",
        "icon.svg",
      ],
      manifest: {
        name: "Shefi & Co.",
        short_name: "Shefi",
        description: "מערכת ניהול משאבי אנוש ורווחה — Shefi & Co.",
        theme_color: "#7c5cff",
        background_color: "#0b0d12",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/me",
        lang: "he",
        dir: "rtl",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "בקשת ציוד חדשה",
            short_name: "בקשה חדשה",
            url: "/me/new-request",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }],
          },
          {
            name: "ההיסטוריה שלי",
            short_name: "היסטוריה",
            url: "/me/history",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        // Don't cache the API or websocket — they're dynamic
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/orgchart\.html/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false, // keep dev runs lightweight; build still produces PWA
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // forward cookies for the session
      },
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
