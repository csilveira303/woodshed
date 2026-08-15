import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/woodshed/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "WoodShed",
        short_name: "WoodShed",
        description: "Guitar practice — rhythm, scales, chord theory, and voicing exercises",
        theme_color: "#0d0d0d",
        background_color: "#0d0d0d",
        display: "standalone",
        orientation: "portrait",
        scope: "/woodshed/",
        start_url: "/woodshed/",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        runtimeCaching: [],
      },
    }),
  ],
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
  },
});
