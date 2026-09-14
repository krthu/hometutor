/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Offline support is built but only wired up when explicitly enabled -- see
// src/pwa.ts for why a service worker stays off until there is a real HTTPS host.
const pwaEnabled = process.env.VITE_ENABLE_PWA === 'true';

export default defineConfig({
  // Relative base so the built bundle works from any host, any sub-path, or file://
  // without a rebuild. See docs/CONTENT_GUIDE.md.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt" rather than "autoUpdate": a silent reload mid-question would
      // lose her answers.
      registerType: 'prompt',
      injectRegister: null,
      selfDestroying: !pwaEnabled,
      manifest: {
        name: 'HomeTutor',
        short_name: 'HomeTutor',
        description: 'Öva på skolans ämnen med frågor på tre nivåer.',
        lang: 'sv',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
      },
      workbox: {
        // Content packs are inlined into the JS bundle, so precaching the build
        // is enough to make the whole app work offline.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,jpg}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // jsdom for the component tests; the pure engine tests do not care either way.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
});
