import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['app-icon.svg', 'app-icon-maskable.svg', 'icon-192.svg', 'icon-512.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        id: '/',
        name: "DINOTS - Guru's Tracker",
        short_name: "Tracker",
        description: "Your personal life-OS for tracking activities, money, and mental energy.",
        theme_color: "#E8A830",
        background_color: "#0D0D0B",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait",
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/app-icon-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      }
    })
  ]
});
