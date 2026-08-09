import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'BranchBack',
        short_name: 'BranchBack',
        description: 'Local-first decision replay laboratory',
        theme_color: '#0b6e63',
        background_color: '#eef1ec',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Single fork + no isolate: avoids Windows worker-start timeouts after npm ci
    // (AV scan / path-with-spaces flakiness when spawning a new worker per file).
    pool: 'forks',
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
