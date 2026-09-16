import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icons/apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        name: 'Travel Planner',
        short_name: 'Travel',
        description: 'Plan trips, organize daily itineraries, and keep essential travel information available offline.',
        theme_color: '#16231f',
        background_color: '#f5f4ef',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
    }),
  ],
})
