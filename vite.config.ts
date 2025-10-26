import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'icon-192-maskable.png',
        'icon-512-maskable.png'
      ],
      manifest: {
        name: 'BlogCutter',
        short_name: 'blogcutter',
        description: 'Application to fast cut long videos.',
        theme_color: '#2b7fff',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any'
          },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      }
    })
  ],
  // optimizeDeps: {
  //   exclude: [
  //     '@ffmpeg/ffmpeg',
  //     '@ffmpeg/util',
  //     '@ffmpeg/core-mt',  // Agrega '@ffmpeg/core-mt' si usas la versión multi-thread
  //     '@ffmpeg/core'
  //   ]
  // },
  build: {
    outDir: "dist"
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})
